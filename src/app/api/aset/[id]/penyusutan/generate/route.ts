import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

type BasisIn = "BULANAN" | "TAHUNAN" | "MONTHLY" | "YEARLY";
type Metode  = "GARIS_LURUS" | "SALDO_MENURUN";

const MAX_MONTHS = 120;
const MAX_YEARS  = 50;
const EPS = 0.0001;

const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const clamp2 = (n: number) => Math.round(n * 100) / 100;

function addMonths(d: Date, m: number) { const t = new Date(d); t.setMonth(t.getMonth() + m); return t; }
function addYears(d: Date, y: number)   { const t = new Date(d); t.setFullYear(t.getFullYear() + y); return t; }

function normalizeBasisDB(b: BasisIn): "BULANAN" | "TAHUNAN" {
  const x = (b || "BULANAN").toString().toUpperCase();
  return x === "YEARLY" || x === "TAHUNAN" ? "TAHUNAN" : "BULANAN";
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
    const basisDB = normalizeBasisDB(body?.basis as BasisIn);
    const metodeOverride: Metode | "" = (body?.metodeOverride || "").toUpperCase() as any;

    // Aset
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

    // Periode + pembatas
    const from = new Date(body?.from || aset.mulaiPenyusutan || aset.tanggalOperasi || new Date());
    const to   = new Date(body?.to   || from);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ error: "Rentang periode tidak valid: 'from' > 'to'." }, { status: 400 });
    }
    if (basisDB === "BULANAN") {
      const m = monthsDiffInclusive(from, to);
      if (m > MAX_MONTHS) return NextResponse.json({ error: `Rentang terlalu panjang (bulanan): ${m} bulan (maks ${MAX_MONTHS}).` }, { status: 400 });
    } else {
      const y = yearsDiffInclusive(from, to);
      if (y > MAX_YEARS) return NextResponse.json({ error: `Rentang terlalu panjang (tahunan): ${y} tahun (maks ${MAX_YEARS}).` }, { status: 400 });
    }

    // Param hitung
    const metodeFinal: Metode = (metodeOverride || aset.metodePenyusutan || "GARIS_LURUS") as Metode;
    const rate = body?.tarifOverride != null
      ? Number(body.tarifOverride)
      : (aset.gunakanTarifCustom ? Number(aset.tarifCustom) : null);
    if (rate == null || isNaN(rate) || rate < 0) {
      return NextResponse.json({ error: "Tarif tahunan (%) tidak tersedia. Isi body.tarifOverride atau aktifkan tarifCustom pada aset." }, { status: 400 });
    }

    const nilaiPerolehan = Math.max(0, toNum(aset.nilai));
    const residu         = Math.max(0, toNum(aset.nilaiResidu));
    if (nilaiPerolehan <= residu + EPS) {
      return NextResponse.json({ error: "Nilai perolehan <= residu." }, { status: 400 });
    }

    // Base tetap utk garis lurus
    const base0 = Math.max(0, nilaiPerolehan - residu);
    let nilaiAwal = nilaiPerolehan;

    // Seed
    const step = basisDB === "BULANAN" ? "M" : "Y";
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

    const rowsToSave: Array<{
      periode: Date; metode: Metode; basis: "BULANAN" | "TAHUNAN"; tarif: number;
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
        beban = Math.min(nilaiAwal * r, Math.max(0, nilaiAwal - residu));
      }
      beban = clamp2(Math.max(0, beban));
      akm   = clamp2(akm + beban);
      const nilaiAkhir = clamp2(Math.max(residu, nilaiAwal - beban));

      if (periode >= windowStart) {
        rowsToSave.push({
          periode: new Date(periode),
          metode: metodeFinal,
          basis: basisDB,
          tarif: Number(rate),
          nilaiAwal: clamp2(nilaiAwal),
          beban,
          akumulasi: akm,
          nilaiAkhir,
        });
      }

      if (key === endKey) break;
      if (nilaiAkhir <= residu + EPS) break;

      nilaiAwal = nilaiAkhir;
      periode   = advance(periode);
    }

    if (rowsToSave.length === 0) {
      return NextResponse.json({ error: "Tidak ada periode yang dihasilkan." }, { status: 400 });
    }

    // Idempotent upsert per (asetId, periode)
    //@ts-ignore
    const result = await prisma.$transaction(async (tx: PrismaClient) => {
      let created = 0, updated = 0;
      for (const r of rowsToSave) {
        const existing = await (tx as any).penyusutan.findUnique({
          // pastikan di schema ada @@unique([asetId, periode])
          where: { asetId_periode: { asetId: id, periode: r.periode } as any },
        }).catch(() => null);

        if (!existing) {
          await (tx as any).penyusutan.create({
            data: {
              asetId: id,
              periode: r.periode,
              metode: r.metode,
              basis: r.basis,
              tarif: r.tarif,
              nilaiAwal: r.nilaiAwal,
              beban: r.beban,
              akumulasi: r.akumulasi,
              nilaiAkhir: r.nilaiAkhir,
            },
          });
          created += 1;
        } else {
          await (tx as any).penyusutan.update({
            where: { id: existing.id },
            data: {
              metode: r.metode,
              basis: r.basis,
              tarif: r.tarif,
              nilaiAwal: r.nilaiAwal,
              beban: r.beban,
              akumulasi: r.akumulasi,
              nilaiAkhir: r.nilaiAkhir,
            },
          });
          updated += 1;
        }
      }
      return { created, updated, total: rowsToSave.length };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
