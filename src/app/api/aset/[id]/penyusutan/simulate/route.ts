import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type BasisIn = "BULANAN" | "TAHUNAN" | "MONTHLY" | "YEARLY";
type BasisOut = "MONTHLY" | "YEARLY";
type Metode = "GARIS_LURUS" | "SALDO_MENURUN";

const MAX_MONTHS = 120; // 10 tahun (preview bulanan)
const MAX_YEARS  = 50;  // 50 tahun (preview tahunan)
const EPS = 0.0001;

const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const clamp2 = (n: number) => Math.round(n * 100) / 100;

function addMonths(d: Date, m: number) { const t = new Date(d); t.setMonth(t.getMonth() + m); return t; }
function addYears(d: Date, y: number)   { const t = new Date(d); t.setFullYear(t.getFullYear() + y); return t; }

function normalizeBasis(b: BasisIn): { in: "M" | "Y"; out: BasisOut } {
  const x = (b || "BULANAN").toString().toUpperCase();
  if (x === "YEARLY" || x === "TAHUNAN") return { in: "Y", out: "YEARLY" };
  return { in: "M", out: "MONTHLY" };
}

function monthsDiffInclusive(a: Date, b: Date) {
  const A = new Date(a.getFullYear(), a.getMonth(), 1);
  const B = new Date(b.getFullYear(), b.getMonth(), 1);
  const m = (B.getFullYear() - A.getFullYear()) * 12 + (B.getMonth() - A.getMonth());
  return m + 1;
}
function yearsDiffInclusive(a: Date, b: Date) {
  const A = new Date(a.getFullYear(), 0, 1);
  const B = new Date(b.getFullYear(), 0, 1);
  return (B.getFullYear() - A.getFullYear()) + 1;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id || 0);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const basisNorm = normalizeBasis(body?.basis as BasisIn);
    const metodeOverride: Metode | "" = (body?.metodeOverride || "").toUpperCase() as any;

    // Ambil aset
    // @ts-ignore
    const aset = await prisma.aset.findUnique({
      where: { id },
      select: {
        id: true, nilai: true, nilaiResidu: true,
        metodePenyusutan: true, tarifCustom: true, gunakanTarifCustom: true,
        mulaiPenyusutan: true, tanggalOperasi: true,
      },
    });
    if (!aset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });

    // Periode (validasi + pembatas)
    const from = new Date(body?.from || aset.mulaiPenyusutan || aset.tanggalOperasi || new Date());
    const to   = new Date(body?.to   || from);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ error: "Rentang periode tidak valid: 'from' > 'to'." }, { status: 400 });
    }
    if (basisNorm.out === "MONTHLY") {
      const m = monthsDiffInclusive(from, to);
      if (m > MAX_MONTHS) return NextResponse.json({ error: `Rentang terlalu panjang (bulanan): ${m} bulan (maks ${MAX_MONTHS}).` }, { status: 400 });
    } else {
      const y = yearsDiffInclusive(from, to);
      if (y > MAX_YEARS) return NextResponse.json({ error: `Rentang terlalu panjang (tahunan): ${y} tahun (maks ${MAX_YEARS}).` }, { status: 400 });
    }

    // Parameter hitung
    const metodeFinal: Metode = (metodeOverride || aset.metodePenyusutan || "GARIS_LURUS") as Metode;
    const rate = body?.tarifOverride != null
      ? Number(body.tarifOverride)
      : (aset.gunakanTarifCustom ? Number(aset.tarifCustom) : null);
    if (rate == null || isNaN(rate) || rate < 0) {
      return NextResponse.json({ error: "Tarif tahunan (%) tidak tersedia. Isi body.tarifOverride atau aktifkan tarifCustom pada aset." }, { status: 400 });
    }

    // Nilai dasar
    const nilaiPerolehan = Math.max(0, toNum(aset.nilai));
    const residu         = Math.max(0, toNum(aset.nilaiResidu));
    if (nilaiPerolehan <= residu + EPS) {
      return NextResponse.json({ error: "Nilai perolehan <= residu." }, { status: 400 });
    }

    // Base tetap untuk GARIS_LURUS → supaya beban **flat**
    const base0 = Math.max(0, nilaiPerolehan - residu);
    let nilaiAwal = nilaiPerolehan;

    // Seed/burn-in dari tanggal awal aset
    const step = basisNorm.out === "MONTHLY" ? "M" : "Y";
    const advance = (d: Date) => (step === "M" ? addMonths(d, 1) : addYears(d, 1));
    const startAset = new Date(aset.mulaiPenyusutan || aset.tanggalOperasi || from);

    let periode = new Date(step === "M"
      ? new Date(startAset.getFullYear(), startAset.getMonth(), 1)
      : new Date(startAset.getFullYear(), 0, 1),
    );
    const windowStart = new Date(step === "M"
      ? new Date(from.getFullYear(), from.getMonth(), 1)
      : new Date(from.getFullYear(), 0, 1),
    );
    const endKey = step === "M"
      ? `${to.getFullYear()}-${to.getMonth()}`
      : `${to.getFullYear()}`;

    const rows: Array<{
      periode: string; metode: Metode; basis: BasisOut; tarif: number;
      nilaiAwal: number; beban: number; akumulasi: number; nilaiAkhir: number;
    }> = [];

    let akm = 0; let guard = 0;
    const rateAnnual = Math.max(0, Number(rate)) / 100;

    while (guard++ < 2400) {
      const key = step === "M" ? `${periode.getFullYear()}-${periode.getMonth()}` : `${periode.getFullYear()}`;

      // Hitung beban
      let beban = 0;
      if (metodeFinal === "GARIS_LURUS") {
        beban = step === "M" ? (base0 * rateAnnual) / 12 : (base0 * rateAnnual);   // FLAT
      } else {
        const r = step === "M" ? rateAnnual / 12 : rateAnnual;
        beban = Math.min(nilaiAwal * r, Math.max(0, nilaiAwal - residu));         // SALDO MENURUN
      }
      beban = clamp2(Math.max(0, beban));
      akm   = clamp2(akm + beban);
      const nilaiAkhir = clamp2(Math.max(residu, nilaiAwal - beban));

      // simpan hanya di window
      if (periode >= windowStart) {
        rows.push({
          periode: new Date(periode).toISOString(),
          metode: metodeFinal,
          basis: basisNorm.out,
          tarif: Number(rate),
          nilaiAwal: clamp2(nilaiAwal),
          beban,
          akumulasi: akm,
          nilaiAkhir,
        });
      }

      // stop conditions
      if (key === endKey) break;
      if (nilaiAkhir <= residu + EPS) break;

      // lanjut
      nilaiAwal = nilaiAkhir;
      periode   = advance(periode);
    }

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Gunakan POST untuk simulasi." }, { status: 405 });
}
