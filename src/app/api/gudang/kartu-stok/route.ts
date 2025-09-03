// app/api/gudang/kartu-stok/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/* ========== Helpers ========== */

function mapTipeToJenis(t?: string | null): "IN" | "OUT" | "ADJ" | null {
  if (!t) return null;
  const s = String(t).toUpperCase();
  if (s === "RECEIPT") return "IN";
  if (s === "ISSUE") return "OUT";
  if (s === "ADJUSTMENT") return "ADJ";
  return null;
}

const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);

/** +1 / -1 untuk mutasi; ADJ membaca tanda dari catatan ("Adjustment -" dianggap out) */
function mutasiSign(tipe: string, catatan?: string | null) {
  const t = tipe?.toUpperCase?.() || "";
  if (t === "RECEIPT") return 1;
  if (t === "ISSUE") return -1;
  if (t === "ADJUSTMENT") {
    if (catatan && /-\s*$|adjustment\s*-/i.test(catatan)) return -1;
    return 1;
  }
  return 0;
}

type LineRow = {
  id: number;
  qty: number;
  hargaRp: number | null;
  catatan: string | null;
  header: {
    nomor: string | null;
    tanggal: Date | null;
    tipe: string;
    referensi: string | null;
    gudangAsalId: number | null;
    gudangTujuanId: number | null;
  };
};

/* ========== GET ==========

   /api/gudang/kartu-stok
     ?itemId=... (wajib)
     &dateFrom=YYYY-MM-DD
     &dateTo=YYYY-MM-DD
     &gudangId=1         (opsional, agregat jika header gudang null)
     &page=1&size=50
================================ */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const itemId = Number(url.searchParams.get("itemId") || 0);
    if (!itemId) return NextResponse.json({ error: "itemId wajib" }, { status: 400 });

    const gudangIdParam = url.searchParams.get("gudangId");
    const gudangId = gudangIdParam ? Number(gudangIdParam) : null;

    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(200, Math.max(1, parseInt(url.searchParams.get("size") || "50", 10)));
    const skip = (page - 1) * size;

    // --- Info item
    // @ts-ignore
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, kode: true, nama: true, satuan: true },
    });
    if (!item) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

    // --- Range builder
    const makeDate = (s: string, end = false) =>
      new Date(`${s}${end ? "T23:59:59" : "T00:00:00"}`);

    // Query helper
    const baseSelect = {
      id: true,
      qty: true,
      hargaRp: true,
      catatan: true,
      header: {
        select: {
          nomor: true,
          tanggal: true,
          tipe: true,
          referensi: true,
          gudangAsalId: true,
          gudangTujuanId: true,
        },
      },
    } as const;

    // -------- Saldo awal (qty & Rp) : jalankan FIFO rata-rata dari awal sampai < dateFrom
    let saldoQty = 0;
    let saldoRp = 0;

    if (dateFrom) {
      // @ts-ignore
      const before: LineRow[] = await prisma.stokTransaksiLine.findMany({
        where: {
          itemId,
          header: { tanggal: { lt: makeDate(dateFrom, false) } },
        },
        select: baseSelect,
        orderBy: [{ header: { tanggal: "asc" } }, { id: "asc" }],
      });

      for (const l of before) {
        // filter gudang santun: kalau header punya gudang dan tidak match → lewati
        if (gudangId) {
          const jenis = mapTipeToJenis(l.header.tipe);
          const ga = l.header.gudangAsalId ?? null;
          const gt = l.header.gudangTujuanId ?? null;
          const hasHeaderGudang = ga != null || gt != null;

          const masuk = jenis === "IN" || (jenis === "ADJ" && mutasiSign(l.header.tipe, l.catatan) > 0);
          const keluar = jenis === "OUT" || (jenis === "ADJ" && mutasiSign(l.header.tipe, l.catatan) < 0);

          if (
            hasHeaderGudang &&
            !(
              (masuk && gt === gudangId) ||
              (keluar && ga === gudangId) ||
              (jenis === "ADJ" && (ga === gudangId || gt === gudangId))
            )
          ) {
            continue;
          }
        }

        const qty = toNum(l.qty);
        const jenis = mapTipeToJenis(l.header.tipe) || "IN";
        const sign = mutasiSign(l.header.tipe, l.catatan);
        const avg = saldoQty > 0 ? saldoRp / saldoQty : 0;

        if (jenis === "IN" || (jenis === "ADJ" && sign > 0)) {
          const unit = l.hargaRp != null ? toNum(l.hargaRp) : avg;
          saldoQty += qty;
          saldoRp += qty * unit;
        } else {
          const unit = avg; // keluar selalu pakai average berjalan
          saldoQty -= qty;
          saldoRp -= qty * unit;
        }
      }
    }

    const saldoAwal = saldoQty;
    const saldoAwalRp = saldoRp;
    const hppAwal = saldoQty > 0 ? saldoRp / saldoQty : 0;

    // -------- Mutasi dalam range
    const whereInRange: any = { itemId };
    if (dateFrom || dateTo) {
      whereInRange.header = { tanggal: {} as any };
      if (dateFrom) whereInRange.header.tanggal.gte = makeDate(dateFrom, false);
      if (dateTo) whereInRange.header.tanggal.lte = makeDate(dateTo, true);
    }

    // @ts-ignore
    const linesAll: LineRow[] = await prisma.stokTransaksiLine.findMany({
      where: whereInRange,
      select: baseSelect,
      orderBy: [{ header: { tanggal: "asc" } }, { id: "asc" }],
    });

    // filter gudang "santun" seperti di atas (tidak membuang baris kalau header gudang null)
    const linesFiltered = !gudangId
      ? linesAll
      : linesAll.filter((l: LineRow) => {
          const jenis = mapTipeToJenis(l.header.tipe);
          const ga = l.header.gudangAsalId ?? null;
          const gt = l.header.gudangTujuanId ?? null;
          const hasHeaderGudang = ga != null || gt != null;

          if (!hasHeaderGudang) return true;

          const masuk = jenis === "IN" || (jenis === "ADJ" && mutasiSign(l.header.tipe, l.catatan) > 0);
          const keluar = jenis === "OUT" || (jenis === "ADJ" && mutasiSign(l.header.tipe, l.catatan) < 0);

          if (masuk && gt === gudangId) return true;
          if (keluar && ga === gudangId) return true;
          if (jenis === "ADJ" && (ga === gudangId || gt === gudangId)) return true;
          return false;
        });

    let totalIn = 0,
      totalOut = 0,
      totalAdjPlus = 0,
      totalAdjMinus = 0;
    let totalNilaiIn = 0,
      totalNilaiOut = 0;

    let runningQty = saldoAwal;
    let runningRp = saldoAwalRp;

    const rowsFull = linesFiltered.map((l: LineRow) => {
      const jenis = mapTipeToJenis(l.header.tipe) || "IN";
      const qty = toNum(l.qty);
      const sign = mutasiSign(l.header.tipe, l.catatan);

      const avg = runningQty > 0 ? runningRp / runningQty : 0;

      let inQty = 0,
        outQty = 0,
        hppUnit = 0,
        nilaiMasukRp = 0,
        nilaiKeluarRp = 0;

      if (jenis === "IN") {
        inQty = qty;
        hppUnit = l.hargaRp != null ? toNum(l.hargaRp) : avg;
        nilaiMasukRp = qty * hppUnit;

        runningQty += qty;
        runningRp += nilaiMasukRp;

        totalIn += qty;
        totalNilaiIn += nilaiMasukRp;
      } else if (jenis === "OUT") {
        outQty = qty;
        hppUnit = avg;
        nilaiKeluarRp = qty * hppUnit;

        runningQty -= qty;
        runningRp -= nilaiKeluarRp;

        totalOut += qty;
        totalNilaiOut += nilaiKeluarRp;
      } else {
        if (sign >= 0) {
          inQty = qty;
          hppUnit = l.hargaRp != null ? toNum(l.hargaRp) : avg;
          nilaiMasukRp = qty * hppUnit;

          runningQty += qty;
          runningRp += nilaiMasukRp;

          totalAdjPlus += qty;
          totalNilaiIn += nilaiMasukRp;
        } else {
          outQty = qty;
          hppUnit = avg;
          nilaiKeluarRp = qty * hppUnit;

          runningQty -= qty;
          runningRp -= nilaiKeluarRp;

          totalAdjMinus += qty;
          totalNilaiOut += nilaiKeluarRp;
        }
      }

      return {
        id: l.id,
        tanggal: l.header.tanggal?.toISOString() ?? null,
        nomor: l.header.nomor ?? null,
        jenis,
        referensi: l.header.referensi ?? null,
        catatan: l.catatan ?? null,
        hargaRp: l.hargaRp != null ? toNum(l.hargaRp) : null,
        inQty,
        outQty,
        saldo: runningQty,
        hppUnit,
        nilaiMasukRp,
        nilaiKeluarRp,
        saldoRp: runningRp,
      };
    });

    const count = rowsFull.length;
    const rows = rowsFull.slice(skip, skip + size);

    const saldoAkhir = runningQty;
    const saldoAkhirRp = runningRp;
    const hppAkhir = saldoAkhir > 0 ? saldoAkhirRp / saldoAkhir : 0;

    return NextResponse.json({
      item,
      saldoAwal,
      saldoAwalRp,
      hppAwal,
      saldoAkhir,
      saldoAkhirRp,
      hppAkhir,
      total: {
        in: totalIn,
        out: totalOut,
        adjPlus: totalAdjPlus,
        adjMinus: totalAdjMinus,
        nilaiInRp: totalNilaiIn,
        nilaiOutRp: totalNilaiOut,
      },
      rows,
      count,
      page,
      size,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
