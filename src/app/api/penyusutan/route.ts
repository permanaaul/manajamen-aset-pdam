// app/api/penyusutan/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/* Helpers */
const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const norm = (s?: string | null) => (s || "").trim();

function normMetode(s?: string | null) {
  const x = norm(s).toUpperCase();
  return x === "GARIS_LURUS" || x === "SALDO_MENURUN" ? x : null;
}
function normBasis(s?: string | null) {
  const x = norm(s).toUpperCase();
  return x === "TAHUNAN" || x === "BULANAN" ? x : null;
}

/* =========================
 * GET /api/penyusutan
 * Query:
 *  q, asetId, metode, basis, dateFrom, dateTo, page, size
 * ========================= */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = norm(url.searchParams.get("q"));
    const asetId = Number(url.searchParams.get("asetId") || 0) || undefined;
    const metode = normMetode(url.searchParams.get("metode"));
    const basis  = normBasis(url.searchParams.get("basis"));
    const dateFrom = norm(url.searchParams.get("dateFrom"));
    const dateTo   = norm(url.searchParams.get("dateTo"));

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "20", 10)));
    const skip = (page - 1) * size;

    const where: any = {};
    if (q) {
      // cari di relasi aset
      where.aset = {
        OR: [
          { nia:  { contains: q, mode: "insensitive" } },
          { nama: { contains: q, mode: "insensitive" } },
        ],
      };
    }
    if (asetId) where.asetId = asetId;
    if (metode) where.metode = metode;
    if (basis)  where.basis  = basis;

    if (dateFrom || dateTo) {
      where.periode = {};
      if (dateFrom) where.periode.gte = new Date(`${dateFrom}T00:00:00`);
      if (dateTo)   where.periode.lte = new Date(`${dateTo}T23:59:59`);
    }

    // Ambil data + hitung total
    // @ts-ignore
    const [count, rows, agg] = await Promise.all([
      // @ts-ignore
      prisma.penyusutan.count({ where }),
      // @ts-ignore
      prisma.penyusutan.findMany({
        where,
        orderBy: [{ periode: "desc" }, { id: "desc" }],
        skip,
        take: size,
        select: {
          id: true,
          asetId: true,
          periode: true,
          metode: true,
          basis: true,
          tarif: true,
          nilaiAwal: true,
          beban: true,
          akumulasi: true,
          nilaiAkhir: true,
          aset: { select: { id: true, nia: true, nama: true, kategori: true, lokasi: true } },
        },
      }),
      // @ts-ignore
      prisma.penyusutan.aggregate({
        where,
        _sum: { beban: true },
      }),
    ]);

    const out = (rows as any[]).map((r: any) => ({
      id: r.id,
      aset: r.aset
        ? { id: r.aset.id, nia: r.aset.nia, nama: r.aset.nama, kategori: r.aset.kategori, lokasi: r.aset.lokasi }
        : null,
      periode: r.periode ? r.periode.toISOString() : null,
      metode: r.metode,               // "GARIS_LURUS" | "SALDO_MENURUN"
      basis: r.basis,                 // "TAHUNAN" | "BULANAN"
      tarif: toNum(r.tarif),          // persen tahunan
      nilaiAwal: toNum(r.nilaiAwal),
      beban: toNum(r.beban),
      akumulasi: toNum(r.akumulasi),
      nilaiAkhir: toNum(r.nilaiAkhir),
    }));

    const totalBeban = toNum((agg as any)?._sum?.beban ?? 0);

    return NextResponse.json({
      rows: out,
      count,
      page,
      size,
      summary: { totalBeban },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
