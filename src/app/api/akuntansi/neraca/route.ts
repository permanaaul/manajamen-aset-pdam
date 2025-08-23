import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

/* ========= Types ========= */

type SectionType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "CONTRA_ASSET"
  | "CONTRA_REVENUE";

type Normal = "DEBIT" | "CREDIT";

type Row = {
  id: number;
  kode: string;
  nama: string;
  type: SectionType;
  normal: Normal;
  parentId: number | null;
  saldo: number;
};

type AkunRow = {
  id: number;
  kode: string;
  nama: string;
  tipe: SectionType;
  normal: Normal;
  parentId: number | null;
};

type LineRow = {
  akunId: number;
  debit: number | null;
  kredit: number | null;
  unitBiayaId: number | null;
  asetId: number | null;
  akun: AkunRow | null;
};

/* ========= Helpers ========= */

function toDate(d?: string | null) {
  if (!d) return null;
  return new Date(`${d}T00:00:00`);
}

function endOfMonth(ym: string) {
  // "2028-01" -> last day of that month 23:59:59.999
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m, 0);
  dt.setHours(23, 59, 59, 999);
  return dt;
}

/* ========= Route ========= */

export async function GET(req: Request) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  const asOfStr = searchParams.get("asOf");      // "YYYY-MM-DD"
  const periodStr = searchParams.get("period");  // "YYYY-MM"
  const unitIdStr = searchParams.get("unitId");
  const asetIdStr = searchParams.get("asetId");
  const showZero = searchParams.get("showZero") === "1";

  const unitId =
    unitIdStr && unitIdStr.trim() !== "" ? Number(unitIdStr) : null;
  const asetId =
    asetIdStr && asetIdStr.trim() !== "" ? Number(asetIdStr) : null;

  const cutoff = periodStr ? endOfMonth(periodStr) : (toDate(asOfStr) ?? new Date());

  // Ambil baris GL sampai cutoff (opsional filter unit/aset)
  // @ts-ignore
  const lines = (await prisma.jurnalUmumLine.findMany({
    where: {
      header: { tanggal: { lte: cutoff as any } },
      ...(unitId !== null && Number.isFinite(unitId) ? { unitBiayaId: unitId } : {}),
      ...(asetId !== null && Number.isFinite(asetId) ? { asetId: asetId } : {}),
    },
    select: {
      akunId: true,
      debit: true,
      kredit: true,
      unitBiayaId: true,
      asetId: true,
      akun: {
        select: {
          id: true,
          kode: true,
          nama: true,
          tipe: true,
          normal: true,
          parentId: true,
        },
      },
    },
    take: 20000,
  })) as unknown as LineRow[];

  // Meta akun yang terlibat
  const metaById = new Map<number, AkunRow>();
  for (const l of lines) {
    if (!l.akun) continue;
    metaById.set(l.akun.id, {
      id: l.akun.id,
      kode: l.akun.kode,
      nama: l.akun.nama,
      tipe: l.akun.tipe,
      normal: l.akun.normal,
      parentId: l.akun.parentId ?? null,
    });
  }

  // Lengkapi parent chain (agar nama/kode induk tersedia walau saldo 0)
  async function ensureParentChain(startIds: number[]) {
    const missing: number[] = [];
    for (const id of startIds) {
      const m = metaById.get(id);
      if (m?.parentId && !metaById.has(m.parentId)) missing.push(m.parentId);
    }
    if (!missing.length) return;

    const needIds = Array.from(new Set(missing));
    // @ts-ignore
    const parents = (await prisma.akun.findMany({
      where: { id: { in: needIds } },
      select: { id: true, kode: true, nama: true, tipe: true, normal: true, parentId: true },
    })) as AkunRow[];

    for (const p of parents) {
      metaById.set(p.id, {
        id: p.id,
        kode: p.kode,
        nama: p.nama,
        tipe: p.tipe,
        normal: p.normal,
        parentId: p.parentId ?? null,
      });
    }
    await ensureParentChain(parents.map((p: AkunRow) => p.id));
  }
  await ensureParentChain(Array.from(metaById.keys()));

  // Agregasi saldo per akun mengikuti normal balance
  const saldoByAkun = new Map<number, number>();
  for (const l of lines) {
    if (!l.akun) continue;
    const m = metaById.get(l.akun.id);
    if (!m) continue;

    const d = Number(l.debit || 0);
    const k = Number(l.kredit || 0);
    const delta = m.normal === "DEBIT" ? (d - k) : (k - d);

    saldoByAkun.set(m.id, (saldoByAkun.get(m.id) ?? 0) + delta);
  }

  // Bentuk rows
  let rows: Row[] = [];
  for (const [id, saldo] of saldoByAkun.entries()) {
    const m = metaById.get(id);
    if (!m) continue;
    rows.push({
      id: m.id,
      kode: m.kode,
      nama: m.nama,
      type: m.tipe,
      normal: m.normal,
      parentId: m.parentId,
      saldo: +saldo.toFixed(2),
    });
  }
  if (!showZero) rows = rows.filter((r) => Math.abs(r.saldo) > 0.005);

  // Kelompok utama
  const assets = rows.filter((r) => r.type === "ASSET" || r.type === "CONTRA_ASSET");
  const liabilities = rows.filter((r) => r.type === "LIABILITY");
  const equity = rows.filter((r) => r.type === "EQUITY");
  const revenues = rows.filter((r) => r.type === "REVENUE" || r.type === "CONTRA_REVENUE");
  const expenses = rows.filter((r) => r.type === "EXPENSE");

  // Net revenue: REVENUE - CONTRA_REVENUE
  const revenueNet = revenues.reduce(
    (s, r) => s + (r.type === "CONTRA_REVENUE" ? -r.saldo : r.saldo),
    0
  );
  const totalExpense = expenses.reduce((s, r) => s + r.saldo, 0);
  const labaRugi = +(revenueNet - totalExpense).toFixed(2);

  // Net asset: ASSET - CONTRA_ASSET
  const totalAsset = +assets.reduce(
    (s, r) => s + (r.type === "CONTRA_ASSET" ? -r.saldo : r.saldo),
    0
  ).toFixed(2);

  const totalLE = +(
    liabilities.reduce((s, r) => s + r.saldo, 0) +
    equity.reduce((s, r) => s + r.saldo, 0) +
    labaRugi
  ).toFixed(2);

  const difference = +(totalAsset - totalLE).toFixed(2);

  return NextResponse.json({
    asOf: cutoff,
    filters: {
      period: periodStr || null,
      asOf: asOfStr || null,
      unitId: unitId ?? null,
      asetId: asetId ?? null,
      showZero,
    },
    sections: {
      assets,
      liabilities,
      equity,
      labaRugi: { kode: "LRB", nama: "Laba (Rugi) Berjalan", saldo: labaRugi },
    },
    totals: {
      assets: totalAsset,
      liabilitiesPlusEquity: totalLE,
      balanced: Math.abs(difference) < 0.005,
      difference, // untuk ditampilkan sebagai "Selisih" di UI
    },
  });
}
