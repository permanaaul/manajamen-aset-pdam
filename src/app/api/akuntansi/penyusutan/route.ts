// app/api/akuntansi/penyusutan/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { StatusJurnal, StatusPeriode, SumberJurnal } from "@prisma/client";

/* ============ Helpers ============ */
const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const pad2 = (n: number) => String(n).padStart(2, "0");

function parsePeriode(periode?: string | null) {
  const now = new Date();
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return { tahun: y, bulan: m + 1, start, end, key: `${y}-${pad2(m + 1)}` };
  }
  const [yy, mm] = periode.split("-").map(Number);
  const start = new Date(yy, mm - 1, 1, 0, 0, 0, 0);
  const end = new Date(yy, mm, 0, 23, 59, 59, 999);
  return { tahun: yy, bulan: mm, start, end, key: `${yy}-${pad2(mm)}` };
}

async function ensurePeriodeId(d: Date) {
  const tahun = d.getFullYear();
  const bulan = d.getMonth() + 1;
  const mulai = new Date(tahun, bulan - 1, 1);
  const akhir = new Date(tahun, bulan, 0);
  // @ts-ignore
  const p = await prisma.periodeAkuntansi.upsert({
    where: { tahun_bulan: { tahun, bulan } },
    create: { tahun, bulan, mulai, akhir, status: StatusPeriode.TERBUKA },
    update: {},
    select: { id: true, status: true },
  });
  return p;
}

async function nextJurnalNumber(d: Date) {
  const key = `JRN-${d.getFullYear()}${pad2(d.getMonth() + 1)}`;
  // @ts-ignore
  const row = await prisma.sequenceCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  const seq = row.value;
  return `${key}-${String(seq).padStart(4, "0")}`;
}

// Cari akun default beban & akumulasi (fallback kalau aset tidak override)
async function getDefaultAkunPenyusutan() {
  try {
    // @ts-ignore
    const maps = await prisma.mappingAkunOtomatis.findMany({
      where: { key: { in: ["PENYUSUTAN_BEBAN", "PENYUSUTAN_AKM"] } },
      select: { key: true, akunId: true },
    });
    const mb = maps.find((m: any) => m.key === "PENYUSUTAN_BEBAN")?.akunId || null;
    const ma = maps.find((m: any) => m.key === "PENYUSUTAN_AKM")?.akunId || null;
    if (mb && ma) return { bebanId: mb, akmId: ma };
  } catch {}

  // @ts-ignore
  const akunBeban = await prisma.akun.findFirst({ where: { kode: "5300" }, select: { id: true } });
  // @ts-ignore
  const akunAkm = await prisma.akun.findFirst({ where: { kode: "1599" }, select: { id: true } });
  if (akunBeban?.id && akunAkm?.id) return { bebanId: akunBeban.id, akmId: akunAkm.id };

  // @ts-ignore
  const byNameB = await prisma.akun.findFirst({
    where: { nama: { contains: "Beban Penyusutan", mode: "insensitive" } },
    select: { id: true },
  });
  // @ts-ignore
  const byNameA = await prisma.akun.findFirst({
    where: { nama: { contains: "Akumulasi Penyusutan", mode: "insensitive" } },
    select: { id: true },
  });
  if (byNameB?.id && byNameA?.id) return { bebanId: byNameB.id, akmId: byNameA.id };

  return { bebanId: null as number | null, akmId: null as number | null };
}

/* Rekap penyusutan periode -> agregasi per pasangan akun (debit/kredit) */
type PairKey = string; // `${debitId}-${kreditId}`
type PairAgg = { debitId: number; kreditId: number; amount: number };
type AkunBrief = { id: number; kode: string; nama: string };

async function buildAggregatedPairs(start: Date, end: Date) {
  // @ts-ignore
  const rows: Array<{
    beban: unknown;
    aset: { akunBebanPenyusutanId: number | null; akunAkumulasiPenyusutanId: number | null } | null;
    //@ts-ignore
  }> = await prisma.penyusutan.findMany({
    where: { periode: { gte: start, lte: end } },
    select: {
      beban: true,
      aset: { select: { akunBebanPenyusutanId: true, akunAkumulasiPenyusutanId: true } },
    },
  });

  const { bebanId: defBeban, akmId: defAkm } = await getDefaultAkunPenyusutan();
  if (!defBeban || !defAkm) {
    throw new Error(
      "Akun default penyusutan belum dikonfigurasi. Set mapping 'PENYUSUTAN_BEBAN' & 'PENYUSUTAN_AKM' atau pastikan akun 5300 & 1599 tersedia."
    );
  }

  const agg = new Map<PairKey, PairAgg>();
  for (const r of rows) {
    const beban = toNum(r.beban);
    if (beban <= 0) continue;

    const debitId = r.aset?.akunBebanPenyusutanId ?? defBeban;
    const kreditId = r.aset?.akunAkumulasiPenyusutanId ?? defAkm;

    const key: PairKey = `${debitId}-${kreditId}`;
    const cur = agg.get(key) || { debitId, kreditId, amount: 0 };
    cur.amount += beban;
    agg.set(key, cur);
  }

  const pairs = [...agg.values()];
  const total = pairs.reduce((s, p) => s + p.amount, 0);

  const ids: number[] = [...new Set(pairs.flatMap((p) => [p.debitId, p.kreditId]))];

  // ambil info akun
  // @ts-ignore
  const akunList = (await prisma.akun.findMany({
    where: { id: { in: ids.length ? ids : [-1] } },
    select: { id: true, kode: true, nama: true },
  })) as AkunBrief[];

  const akunMap = new Map<number, AkunBrief>(akunList.map((a: AkunBrief) => [a.id, a]));

  return {
    pairs: pairs.map((p) => ({
      ...p,
      debitAkun: akunMap.get(p.debitId) || { id: p.debitId, kode: "", nama: "" },
      kreditAkun: akunMap.get(p.kreditId) || { id: p.kreditId, kode: "", nama: "" },
    })),
  total,
  };
}

/* ============ GET: preview periode & status ============ */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const periodeQ = url.searchParams.get("periode"); // "YYYY-MM"
    const { tahun, bulan, start, end, key } = parsePeriode(periodeQ);

    // @ts-ignore
    const posted = await prisma.jurnal.findFirst({
      where: {
        sumber: SumberJurnal.ASET_PENYUSUTAN,
        status: StatusJurnal.POSTED,
        tanggal: { gte: start, lte: end },
      },
      select: { id: true, nomor: true },
    });

    const { pairs, total } = await buildAggregatedPairs(start, end);

    // 🔸 Alias amount -> beban untuk kompatibilitas UI lama
    const pairsUI = pairs.map((p) => ({ ...p, beban: p.amount }));

    return NextResponse.json({
      periode: { tahun, bulan, mulai: start, akhir: end, key },
      alreadyPosted: posted || null,
      total,
      pairs: pairsUI,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ============ POST: generate & post jurnal penyusutan ============ */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const periodeQ = url.searchParams.get("periode"); // "YYYY-MM"
    const { start, end, key } = parsePeriode(periodeQ);

    // @ts-ignore
    const exist = await prisma.jurnal.findFirst({
      where: {
        sumber: SumberJurnal.ASET_PENYUSUTAN,
        status: StatusJurnal.POSTED,
        tanggal: { gte: start, lte: end },
      },
      select: { id: true, nomor: true },
    });
    if (exist) {
      return NextResponse.json(
        { error: `Periode ${key} sudah terposting ( ${exist.nomor} ).` },
        { status: 409 }
      );
    }

    const { pairs, total } = await buildAggregatedPairs(start, end);
    if (total <= 0 || pairs.length === 0) {
      return NextResponse.json({ error: "Tidak ada beban penyusutan pada periode ini." }, { status: 400 });
    }

    const per = await ensurePeriodeId(start);
    if (per.status !== StatusPeriode.TERBUKA) {
      return NextResponse.json({ error: "Periode akuntansi tidak terbuka." }, { status: 400 });
    }

    const nomor = await nextJurnalNumber(start);
    const memo = `Penyusutan aset periode ${key}`;

    const lines: Array<{ akunId: number; debit: number; kredit: number; uraian: string | null }> = [];
    for (const p of pairs) {
      lines.push({ akunId: p.debitId, debit: p.amount, kredit: 0, uraian: memo });
      lines.push({ akunId: p.kreditId, debit: 0, kredit: p.amount, uraian: memo });
    }

    // @ts-ignore
    const created = await prisma.jurnal.create({
      data: {
        nomor,
        tanggal: end,
        periodeId: per.id,
        status: StatusJurnal.POSTED,
        postedAt: new Date(),
        sumber: SumberJurnal.ASET_PENYUSUTAN,
        memo,
        lines: { createMany: { data: lines } },
      },
      select: { id: true, nomor: true, status: true },
    });

    // 🔸 Kirim juga pairs dengan alias beban agar UI tak perlu ubah
    const pairsUI = pairs.map((p) => ({ ...p, beban: p.amount }));

    return NextResponse.json({
      ok: true,
      journal: created,
      total,
      pairsCount: pairs.length,
      pairs: pairsUI,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
