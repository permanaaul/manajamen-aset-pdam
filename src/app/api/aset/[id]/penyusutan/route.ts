// app/api/aset/[id]/penyusutan/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/* ===== Types & helpers ===== */
type BasisIn = "BULANAN" | "TAHUNAN" | "MONTHLY" | "YEARLY";
type BasisOut = "MONTHLY" | "YEARLY";
type Metode = "GARIS_LURUS" | "SALDO_MENURUN";

const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const clamp2 = (n: number) => Math.round(n * 100) / 100;

function addMonths(d: Date, m: number) {
  const t = new Date(d);
  t.setMonth(t.getMonth() + m);
  return t;
}
function addYears(d: Date, y: number) {
  const t = new Date(d);
  t.setFullYear(t.getFullYear() + y);
  return t;
}

function normalizeBasis(b: BasisIn): { in: "M" | "Y"; out: BasisOut } {
  const x = (b || "BULANAN").toString().toUpperCase();
  if (x === "YEARLY" || x === "TAHUNAN") return { in: "Y", out: "YEARLY" };
  return { in: "M", out: "MONTHLY" };
}

/* =========================================================
 * GET /api/aset/[id]/penyusutan
 *   → daftar penyusutan yg SUDAH TERSIMPAN utk 1 aset (paged)
 *   response: { aset, rows, count, page, size, summary }
 * ======================================================= */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id || 0);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "50", 10)));
    const skip = (page - 1) * size;

    // Header aset (untuk judul & info singkat)
    //@ts-ignore
    const aset = await prisma.aset.findUnique({
      where: { id },
      select: {
        id: true,
        nia: true,
        nama: true,
        kategori: true,
        lokasi: true,
        nilai: true,
      },
    });
    if (!aset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });

    // Data penyusutan tersimpan + aggregate ringkas
    const [count, rowsRaw, agg, last] = await Promise.all([
        //@ts-ignore
      prisma.penyusutan.count({ where: { asetId: id } }),
      //@ts-ignore
      prisma.penyusutan.findMany({
        where: { asetId: id },
        orderBy: [{ periode: "asc" }, { id: "asc" }],
        skip,
        take: size,
        select: {
          id: true,
          periode: true,
          metode: true,
          basis: true,
          tarif: true,
          nilaiAwal: true,
          beban: true,
          akumulasi: true,
          nilaiAkhir: true,
        },
      }),
      //@ts-ignore
      prisma.penyusutan.aggregate({
        where: { asetId: id },
        _sum: { beban: true },
      }),
      //@ts-ignore
      prisma.penyusutan.findFirst({
        where: { asetId: id },
        orderBy: [{ periode: "desc" }, { id: "desc" }],
        select: { akumulasi: true, nilaiAkhir: true },
      }),
    ]);

    type RowRaw = {
      id: number;
      periode: Date | null;
      metode: string;
      basis: string;
      tarif: number | null;
      nilaiAwal: number | null;
      beban: number | null;
      akumulasi: number | null;
      nilaiAkhir: number | null;
    };

    const rows = (rowsRaw as RowRaw[]).map((r: RowRaw) => ({
      id: r.id,
      periode: r.periode ? r.periode.toISOString() : null,
      metode: r.metode,
      basis: r.basis,
      tarif: toNum(r.tarif),
      nilaiAwal: toNum(r.nilaiAwal),
      beban: toNum(r.beban),
      akumulasi: toNum(r.akumulasi),
      nilaiAkhir: toNum(r.nilaiAkhir),
    }));

    return NextResponse.json({
      aset: {
        id: aset.id,
        nia: aset.nia,
        nama: aset.nama,
        kategori: aset.kategori,
        lokasi: aset.lokasi,
        nilai: toNum(aset.nilai),
      },
      rows,
      count,
      page,
      size,
      summary: {
        totalBeban: toNum((agg as any)?._sum?.beban ?? 0),
        akumulasi: toNum((last as any)?.akumulasi ?? 0),
        nilaiAkhir: toNum((last as any)?.nilaiAkhir ?? 0),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/* =========================================================
 * POST /api/aset/[id]/penyusutan
 *   → SIMULASI (preview) perhitungan utk aset (tanpa save)
 *   (kode di bawah mengikuti yang kamu kirim)
 * ======================================================= */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id || 0);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const basisNorm = normalizeBasis(body?.basis as BasisIn);
    const metode: Metode = (body?.metodeOverride || "").toUpperCase() as Metode;

    // Ambil aset
    //@ts-ignore
    const aset = await prisma.aset.findUnique({
      where: { id },
      select: {
        id: true,
        nilai: true,
        nilaiResidu: true,
        metodePenyusutan: true,
        tarifCustom: true,
        gunakanTarifCustom: true,
        mulaiPenyusutan: true,
        tanggalOperasi: true,
      },
    });
    if (!aset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });

    // Periode
    const start = new Date(
      body?.from || aset.mulaiPenyusutan || aset.tanggalOperasi || new Date()
    );
    const end = new Date(body?.to || start);

    // Param perhitungan
    const metodeFinal: Metode = (metode || aset.metodePenyusutan || "GARIS_LURUS") as Metode;
    const rate =
      body?.tarifOverride != null
        ? Number(body.tarifOverride)
        : aset.gunakanTarifCustom
        ? Number(aset.tarifCustom)
        : null;

    if (rate == null || isNaN(rate) || rate < 0) {
      return NextResponse.json(
        {
          error:
            "Tarif tahunan (%) tidak tersedia. Isi body.tarifOverride atau aktifkan tarifCustom pada aset.",
        },
        { status: 400 }
      );
    }

    const nilaiResidu = Math.max(0, toNum(aset.nilaiResidu));
    let nilaiAwal = Math.max(0, toNum(aset.nilai));
    if (nilaiAwal <= nilaiResidu) {
      return NextResponse.json({ rows: [] });
    }

    // iterate dari awal 'start' sampai 'end' (inklusif di batas awal bulan/tahun)
    const step = basisNorm.in; // 'M' | 'Y'
    const advance = (d: Date) => (step === "M" ? addMonths(d, 1) : addYears(d, 1));
    const year = start.getFullYear();
    const month = start.getMonth();
    let periode = new Date(year, step === "M" ? month : 0, 1); // lock ke 1st day
    const endKey =
      step === "M" ? `${end.getFullYear()}-${end.getMonth()}` : `${end.getFullYear()}`;

    const rows: Array<{
      periode: string;
      metode: Metode;
      basis: BasisOut;
      tarif: number;
      nilaiAwal: number;
      beban: number;
      akumulasi: number;
      nilaiAkhir: number;
    }> = [];

    let akm = 0;
    let guard = 0;
    const rateAnnual = Math.max(0, Number(rate)) / 100;

    while (guard++ < 2400) {
      const key =
        step === "M"
          ? `${periode.getFullYear()}-${periode.getMonth()}`
          : `${periode.getFullYear()}`;
      if (periode < start) {
        // “burn-in” sebelum rentang, untuk menjaga akumulasi/nilaiAwal realistis
        let beban = 0;
        if (metodeFinal === "GARIS_LURUS") {
          const base = Math.max(0, nilaiAwal - nilaiResidu);
          beban = step === "Y" ? base * rateAnnual : (base * rateAnnual) / 12;
        } else {
          const r = step === "Y" ? rateAnnual : rateAnnual / 12;
          beban = Math.min(nilaiAwal * r, Math.max(0, nilaiAwal - nilaiResidu));
        }
        beban = clamp2(Math.max(0, beban));
        akm = clamp2(akm + beban);
        nilaiAwal = clamp2(Math.max(nilaiResidu, nilaiAwal - beban));
        periode = advance(periode);
        continue;
      }

      // periode berada dalam window yang ingin dipreview
      let beban = 0;
      if (metodeFinal === "GARIS_LURUS") {
        const base = Math.max(0, nilaiAwal - nilaiResidu);
        beban = step === "Y" ? base * rateAnnual : (base * rateAnnual) / 12;
      } else {
        const r = step === "Y" ? rateAnnual : rateAnnual / 12;
        beban = Math.min(nilaiAwal * r, Math.max(0, nilaiAwal - nilaiResidu));
      }
      beban = clamp2(Math.max(0, beban));
      akm = clamp2(akm + beban);
      const nilaiAkhir = clamp2(Math.max(nilaiResidu, nilaiAwal - beban));

      rows.push({
        periode: new Date(periode).toISOString(),
        metode: metodeFinal,
        basis: basisNorm.out, // "MONTHLY" | "YEARLY"
        tarif: Number(rate),
        nilaiAwal: clamp2(nilaiAwal),
        beban,
        akumulasi: akm,
        nilaiAkhir,
      });

      nilaiAwal = nilaiAkhir;
      if (key === endKey) break;
      if (nilaiAwal <= nilaiResidu + 0.0001) break;
      periode = advance(periode);
    }

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
