// app/api/penyusutan/by-asset/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const norm = (s?: string | null) => (s || "").trim();

const normMetode = (s?: string | null) => {
  const x = norm(s).toUpperCase();
  return x === "GARIS_LURUS" || x === "SALDO_MENURUN" ? x : null;
};
const normBasis = (s?: string | null) => {
  const x = norm(s).toUpperCase();
  return x === "TAHUNAN" || x === "BULANAN" ? x : null;
};

// ---- Helper types to avoid implicit any ----
type Grouped = { asetId: number; _max: { periode: Date | null } };

type RowRaw = {
  id: number;
  asetId: number;
  periode: Date | null;
  metode: string;
  basis: string;
  tarif: number | null;
  nilaiAwal: number | null;
  beban: number | null;
  akumulasi: number | null;
  nilaiAkhir: number | null;
  aset: { id: number; nia: string; nama: string; kategori: string; lokasi: string | null } | null;
};

type AggPerAset = { asetId: number; _sum: { beban: number | null } };

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const q = norm(url.searchParams.get("q"));
    const asetId = Number(url.searchParams.get("asetId") || 0) || undefined;
    const metode = normMetode(url.searchParams.get("metode"));
    const basis = normBasis(url.searchParams.get("basis"));
    const dateFrom = norm(url.searchParams.get("dateFrom"));
    const dateTo = norm(url.searchParams.get("dateTo"));

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "20", 10)));
    const skip = (page - 1) * size;

    // WHERE/filter umum
    const where: any = {};
    if (q) {
      where.aset = {
        OR: [
          { nia: { contains: q, mode: "insensitive" } },
          { nama: { contains: q, mode: "insensitive" } },
        ],
      };
    }
    if (asetId) where.asetId = asetId;
    if (metode) where.metode = metode;
    if (basis) where.basis = basis;

    if (dateFrom || dateTo) {
      where.periode = {};
      if (dateFrom) where.periode.gte = new Date(`${dateFrom}T00:00:00`);
      if (dateTo) where.periode.lte = new Date(`${dateTo}T23:59:59`);
    }

    // 1) aset unik + periode terakhir yang lolos filter
    //@ts-ignore
    const groups = (await prisma.penyusutan.groupBy({
      where,
      by: ["asetId"],
      _max: { periode: true },
      orderBy: [{ _max: { periode: "desc" } }],
    })) as Grouped[];

    const count = groups.length;
    if (count === 0) {
      return NextResponse.json({
        rows: [],
        count,
        page,
        size,
        summary: { totalBeban: 0 },
      });
    }

    // paging aset
    const pageGroups: Grouped[] = groups.slice(skip, skip + size);

    // 2) baris “terakhir” per aset (untuk halaman ini)
    const orPairs = pageGroups
      .filter((g: Grouped) => g._max.periode != null)
      .map((g: Grouped) => ({ asetId: g.asetId, periode: g._max.periode as Date }));
    //@ts-ignore
    const rowsRaw = (await prisma.penyusutan.findMany({
      where: { OR: orPairs.length ? orPairs : [{ id: -1 }] },
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
    })) as RowRaw[];

    // urutkan desc by periode agar konsisten
    rowsRaw.sort(
      (a: RowRaw, b: RowRaw) =>
        (b.periode ? b.periode.getTime() : 0) - (a.periode ? a.periode.getTime() : 0)
    );

    // 3) total beban per aset di filter (hanya untuk aset di halaman ini)
    const asetIdsPage = [...new Set(rowsRaw.map((r: RowRaw) => r.asetId))];
    //@ts-ignore
    const perAsetAgg = (await prisma.penyusutan.groupBy({
      where: { ...where, asetId: { in: asetIdsPage } },
      by: ["asetId"],
      _sum: { beban: true },
    })) as AggPerAset[];
    const bebanMap = new Map<number, number>(
      perAsetAgg.map((x: AggPerAset) => [x.asetId, toNum(x._sum?.beban)])
    );

    // 4) total beban semua baris di filter (summary)
    //@ts-ignore
    const agg = await prisma.penyusutan.aggregate({
      where,
      _sum: { beban: true },
    });
    const totalBeban = toNum((agg as any)?._sum?.beban ?? 0);

    // 5) output
    const out = rowsRaw.map((r: RowRaw) => ({
      id: r.id,
      aset: r.aset
        ? {
            id: r.aset.id,
            nia: r.aset.nia,
            nama: r.aset.nama,
            kategori: r.aset.kategori,
            lokasi: r.aset.lokasi,
          }
        : null,
      periode: r.periode ? r.periode.toISOString() : null,
      metode: r.metode,
      basis: r.basis,
      tarif: toNum(r.tarif),
      nilaiAwal: toNum(r.nilaiAwal),
      beban: toNum(r.beban),
      akumulasi: toNum(r.akumulasi),
      nilaiAkhir: toNum(r.nilaiAkhir),
      totalBebanAsetPadaFilter: toNum(bebanMap.get(r.asetId) || 0),
    }));

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
