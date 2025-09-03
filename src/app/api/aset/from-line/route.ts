// app/api/aset/from-line/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/* ========== Helpers ========== */
const toNum = (v: any) => (v == null ? 0 : Number(v) || 0);

type LineRow = {
  id: number;
  itemId: number;
  qty: unknown;
  hargaRp: unknown;
  header: { id: number; nomor: string | null; tanggal: Date | null } | null;
  item: { id: number; kode: string; nama: string } | null;
};

/** Nomor transaksi (untuk ISSUE otomatis) */
async function nextTransNo(prefix = "GUD") {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const base = `${prefix}-${yyyymm}`;
  // @ts-ignore
  const row = await prisma.sequenceCounter.upsert({
    where: { key: base },
    update: { value: { increment: 1 } },
    create: { key: base, value: 1 },
  });
  return `${base}-${String(row.value).padStart(5, "0")}`;
}

/** Pastikan dapat gudangId yang valid, atau buat default "Gudang Utama" bila kosong */
async function resolveGudangId(tx: Prisma.TransactionClient, preferred?: number | null) {
  const p = Number(preferred || 0);
  if (p > 0) {
    //@ts-ignore
    const ok = await tx.gudang.findUnique({ where: { id: p }, select: { id: true } });
    if (ok?.id) return ok.id;
  }//@ts-ignore
  const any = await tx.gudang.findFirst({
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (any?.id) return any.id;
  //@ts-ignore
  const created = await tx.gudang.create({
    data: { kode: "G01", nama: "Gudang Utama" },
    select: { id: true },
  });
  return created.id;
}

/** Nomor aset: AST-YYYYMM-0001 */
async function nextAsetNo(tx: Prisma.TransactionClient) {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = `AST-${ym}`;//@ts-ignore
  const rec = await tx.sequenceCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  const n = String(rec.value).padStart(4, "0");
  return `${key}-${n}`;
}

/* ========== POST: buat aset dari baris transaksi ========== */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lineIds: number[] = Array.isArray(body?.lineIds)
      ? body.lineIds.map((x: any) => Number(x) || 0).filter(Boolean)
      : [];
    const buatIssue: boolean = Boolean(body?.buatIssue);
    const gudangIdInput: number | undefined =
      body?.gudangId ? (Number(body.gudangId) || undefined) : undefined;

    if (lineIds.length === 0) {
      return NextResponse.json({ error: "lineIds wajib" }, { status: 400 });
    }

    // @ts-ignore
    const lines = (await prisma.stokTransaksiLine.findMany({
      where: { id: { in: lineIds } },
      select: {
        id: true,
        itemId: true,
        qty: true,
        hargaRp: true,
        header: { select: { id: true, nomor: true, tanggal: true } },
        item: { select: { id: true, kode: true, nama: true } },
      },
      orderBy: { id: "asc" },
    })) as unknown as LineRow[];

    if (lines.length === 0) {
      return NextResponse.json({ error: "Baris transaksi tidak ditemukan" }, { status: 404 });
    }

    // @ts-ignore
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created: Array<{ id: number; nia: string; nama: string }> = [];
      const lineToAset = new Map<number, number>();

      for (const l of lines) {
        const nia = await nextAsetNo(tx);
        const nilai = toNum(l.hargaRp);
        //@ts-ignore
        const aset = await tx.aset.create({
          data: {
            nia,
            nama: `${l.item?.kode ?? ""} ${l.item?.nama ?? ""}`.trim() || "Aset Baru",
            kategori: "PIPA",
            lokasi: "Gudang",
            tahun: new Date().getFullYear(),
            nilai: nilai,
            kondisi: "BAIK",
            catatan: `Dibuat dari transaksi ${l.header?.nomor ?? ""}, line #${l.id}`,
          },
          select: { id: true, nia: true, nama: true },
        });

        lineToAset.set(l.id, aset.id);
        //@ts-ignore
        await tx.stokTransaksiLine.update({
          where: { id: l.id },
          data: { asetId: aset.id },
        });

        created.push(aset);
      }

      // Opsional: kurangi stok (ISSUE qty 1 per aset)
      if (buatIssue) {
        const gudangId = await resolveGudangId(tx, gudangIdInput);
        const nomor = await nextTransNo("GUD");
        //@ts-ignore
        await tx.stokTransaksi.create({
          data: {
            nomor,                      // <— FIX: nomor wajib
            tipe: "ISSUE",
            status: "POSTED",
            tanggal: new Date(),
            gudangAsalId: gudangId,
            referensi: `Konsumsi untuk pembuatan aset dari ${lines[0]?.header?.nomor ?? "-"}`,
            lines: {
              create: lines.map((l) => ({
                itemId: l.itemId,
                qty: 1,
                hargaRp: toNum(l.hargaRp),
                asetId: lineToAset.get(l.id)!, // pairing 1–1
                catatan: "Jadikan Aset",
              })),
            },
          },
          select: { id: true },
        });
      }

      return created;
    });

    return NextResponse.json({ created: result }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
