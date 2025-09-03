// app/api/gudang/transaksi/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/* =========================== Helpers =========================== */

function mapJenisToTipe(j?: string | null): "RECEIPT" | "ISSUE" | "ADJUSTMENT" | undefined {
  if (!j) return undefined;
  const s = j.toUpperCase();
  if (s === "IN") return "RECEIPT";
  if (s === "OUT") return "ISSUE";
  if (s === "ADJ") return "ADJUSTMENT";
  return undefined;
}

function mapTipeToJenis(t?: string | null): "IN" | "OUT" | "ADJ" | null {
  if (!t) return null;
  const s = t.toUpperCase();
  if (s === "RECEIPT") return "IN";
  if (s === "ISSUE") return "OUT";
  if (s === "ADJUSTMENT") return "ADJ";
  return null;
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const code = e?.code as string | undefined;
    const msg = String(e?.message || "");
    if (code === "P2021" || code === "P2022" || /does not exist/i.test(msg)) return fallback;
    throw e;
  }
}

/** Nomor transaksi incremental per bulan */
async function nextTransNo(prefix = "GUD") {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const base = `${prefix}-${yyyymm}`;

  try {
    // @ts-ignore
    const row = await prisma.sequenceCounter.upsert({
      where: { key: base },
      update: { value: { increment: 1 } },
      create: { key: base, value: 1 },
    });
    return `${base}-${String(row.value).padStart(5, "0")}`;
  } catch {
    try {
      // @ts-ignore
      const last = await prisma.stokTransaksi.findFirst({
        where: { nomor: { startsWith: `${base}-` } },
        orderBy: { nomor: "desc" },
        select: { nomor: true },
      });
      let n = 1;
      if (last?.nomor) {
        const tail = parseInt((last.nomor.split("-").pop() || "0"), 10);
        if (Number.isFinite(tail)) n = tail + 1;
      }
      return `${base}-${String(n).padStart(5, "0")}`;
    } catch {
      const rand = Math.floor(Math.random() * 99999);
      return `${base}-${String(rand).padStart(5, "0")}`;
    }
  }
}

/** Pastikan dapat gudangId yang valid (ada di tabel Gudang) */
async function resolveGudangId(tx: any, preferred?: number | null): Promise<number> {
  const p = Number(preferred || 0);
  if (p > 0) {
    const ok = await safeQuery(() => tx.gudang.findUnique({ where: { id: p }, select: { id: true } }), null as any);
    if (ok?.id) return ok.id;
  }
  const any = await safeQuery(() => tx.gudang.findFirst({ select: { id: true }, orderBy: { id: "asc" } }), null as any);
  if (any?.id) return any.id;

  const created = await safeQuery(
    () => tx.gudang.create({ data: { kode: "G01", nama: "Gudang Utama" }, select: { id: true } }),
    null as any
  );
  if (created?.id) return created.id;

  throw new Error("Gudang belum tersedia. Isi gudang asal/tujuan atau buat gudang terlebih dulu.");
}

/* =========================== GET =========================== */
/** /api/gudang/transaksi?q=&jenis=&tipe=&status=&dateFrom=&dateTo=&page=&size= */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    const legacyJenis = url.searchParams.get("jenis");
    const tipeParam = url.searchParams.get("tipe");
    const statusParam = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "20", 10)));
    const skip = (page - 1) * size;

    const where: any = {};
    if (q) {
      // MySQL sudah case-insensitive (collation *ci*), jadi tanpa { mode: 'insensitive' }
      where.OR = [
        { nomor: { contains: q } },
        { referensi: { contains: q } },
        { catatan: { contains: q } },
      ];
    }
    if (tipeParam) where.tipe = tipeParam.toUpperCase();
    else if (legacyJenis) {
      const m = mapJenisToTipe(legacyJenis);
      if (m) where.tipe = m;
    }
    if (statusParam) where.status = statusParam.toUpperCase();
    if (dateFrom || dateTo) {
      where.tanggal = {};
      if (dateFrom) where.tanggal.gte = new Date(`${dateFrom}T00:00:00`);
      if (dateTo) where.tanggal.lte = new Date(`${dateTo}T23:59:59`);
    }

    const [count, rows] = await Promise.all([
      // @ts-ignore
      safeQuery(() => prisma.stokTransaksi.count({ where }), 0),
      safeQuery(
        () =>
          // @ts-ignore
          prisma.stokTransaksi.findMany({
            where,
            orderBy: { tanggal: "desc" },
            skip,
            take: size,
            select: {
              id: true,
              nomor: true,
              tanggal: true,
              tipe: true,
              status: true,
              referensi: true,
              catatan: true,
              _count: { select: { lines: true } },
            },
          }),
        [] as any[]
      ),
    ]);

    const out = rows.map((r: any) => ({
      id: r.id,
      noTransaksi: r.nomor,
      tanggal: r.tanggal ? r.tanggal.toISOString() : null,
      jenis: mapTipeToJenis(r.tipe),
      referensi: r.referensi,
      keterangan: r.catatan, // tampilkan di kolom Keterangan
      _count: r._count,
    }));

    return NextResponse.json({ rows: out, count, page, size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/* =========================== POST =========================== */
/** body: { tanggal, jenis|tipe, referensi?, catatan?, gudangAsalId?, gudangTujuanId?, lines: [{itemId, qty, hargaRp?, asetId?, pemeliharaanId?, catatan?}, ...] } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tanggal,
      jenis,
      tipe,
      referensi = null,
      catatan = null,
      gudangAsalId = null,
      gudangTujuanId = null,
      lines = [],
    } = body || {};

    if (!tanggal || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "tanggal dan minimal 1 line wajib" }, { status: 400 });
    }

    const tipeFinal: "RECEIPT" | "ISSUE" | "ADJUSTMENT" =
      ((tipe && String(tipe).toUpperCase()) as any) || (mapJenisToTipe(jenis) as any);

    if (!tipeFinal || !["RECEIPT", "ISSUE", "ADJUSTMENT"].includes(tipeFinal)) {
      return NextResponse.json(
        { error: "tipe/jenis tidak valid (pakai tipe enum atau jenis IN/OUT/ADJ)" },
        { status: 400 }
      );
    }

    // validasi struktur tiap baris
    for (const l of lines as any[]) {
      if (!(l?.itemId > 0) || !(Number(l?.qty) > 0)) {
        return NextResponse.json({ error: "tiap line wajib memiliki itemId & qty > 0" }, { status: 400 });
      }
    }

    const nomorBaru = await nextTransNo("GUD");

    // @ts-ignore
    const created = await prisma.$transaction(async (tx) => {
      const header = await tx.stokTransaksi.create({
        data: {
          nomor: nomorBaru,
          tanggal: new Date(tanggal),
          tipe: tipeFinal,
          status: "POSTED",
          referensi,
          catatan,
          gudangAsalId: gudangAsalId ? Number(gudangAsalId) : null,
          gudangTujuanId: gudangTujuanId ? Number(gudangTujuanId) : null,
        },
        select: { id: true, nomor: true },
      });

      for (const l of lines as any[]) {
        const itemId = Number(l.itemId);
        const qty = Number(l.qty);

        const preferred =
          tipeFinal === "RECEIPT"
            ? (Number(gudangTujuanId) || Number(gudangAsalId) || null)
            : (Number(gudangAsalId) || Number(gudangTujuanId) || null);

        const gudangId = await resolveGudangId(tx, preferred);

        // saldo (qty saja; reservedQty/HPP kamu tidak gunakan di schema saldo)
        let saldo = await tx.stokSaldo.findUnique({
          where: { gudangId_itemId: { gudangId, itemId } },
        });

        // --- VALIDASI FK opsional: asetId & pemeliharaanId ---
        let asetId: number | null = null;
        if (l.asetId != null && l.asetId !== "") {
          const aId = Number(l.asetId) || 0;
          if (aId > 0) {
            const a = await tx.aset.findUnique({ where: { id: aId }, select: { id: true } });
            if (a?.id) asetId = a.id; // kalau tidak ada → biarkan null (hindari FK error)
          }
        }
        let pemeliharaanId: number | null = null;
        if (l.pemeliharaanId != null && l.pemeliharaanId !== "") {
          const pId = Number(l.pemeliharaanId) || 0;
          if (pId > 0) {
            const p = await tx.pemeliharaan.findUnique({ where: { id: pId }, select: { id: true } });
            if (p?.id) pemeliharaanId = p.id; // kalau tidak ada → null (hindari FK error)
          }
        }

        if (tipeFinal === "RECEIPT") {
          if (!saldo) {
            saldo = await tx.stokSaldo.create({ data: { gudangId, itemId, qty: 0 } });
          }
          await tx.stokSaldo.update({
            where: { gudangId_itemId: { gudangId, itemId } },
            data: { qty: Number(saldo.qty || 0) + qty },
          });

          await tx.stokTransaksiLine.create({
            data: {
              headerId: header.id,
              itemId,
              qty,
              hargaRp: l.hargaRp != null ? Number(l.hargaRp) : null,
              asetId,
              pemeliharaanId,
              catatan: l.catatan ?? null,
            },
          });
        }

        if (tipeFinal === "ISSUE") {
          if (!saldo || Number(saldo.qty) < qty) {
            throw new Error(`Stok tidak cukup untuk itemId ${itemId} di gudang ${gudangId}. Stok: ${saldo?.qty ?? 0}`);
          }
          await tx.stokSaldo.update({
            where: { gudangId_itemId: { gudangId, itemId } },
            data: { qty: Number(saldo.qty) - qty },
          });

          await tx.stokTransaksiLine.create({
            data: {
              headerId: header.id,
              itemId,
              qty,
              hargaRp: l.hargaRp != null ? Number(l.hargaRp) : null,
              asetId,
              pemeliharaanId,
              catatan: l.catatan ?? null,
            },
          });
        }

        if (tipeFinal === "ADJUSTMENT") {
          const qAbs = Math.abs(qty);
          if (!saldo) {
            saldo = await tx.stokSaldo.create({ data: { gudangId, itemId, qty: 0 } });
          }
          if (qty >= 0) {
            await tx.stokSaldo.update({
              where: { gudangId_itemId: { gudangId, itemId } },
              data: { qty: Number(saldo.qty || 0) + qAbs },
            });
          } else {
            if (Number(saldo.qty) < qAbs) {
              throw new Error(`Adjustment- melebihi stok untuk itemId ${itemId} di gudang ${gudangId}. Stok: ${saldo.qty}`);
            }
            await tx.stokSaldo.update({
              where: { gudangId_itemId: { gudangId, itemId } },
              data: { qty: Number(saldo.qty) - qAbs },
            });
          }

          await tx.stokTransaksiLine.create({
            data: {
              headerId: header.id,
              itemId,
              qty: qAbs,
              hargaRp: l.hargaRp != null ? Number(l.hargaRp) : null,
              catatan: l.catatan ?? (qty >= 0 ? "Adjustment +" : "Adjustment -"),
              // ADJ biasanya tidak berkaitan FK → jangan isi asetId/pemeliharaanId
            },
          });
        }
      }

      return header;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
