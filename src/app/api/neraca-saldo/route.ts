// app/api/neraca-saldo/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/* ===================== Types ===================== */
type Pos = "DEBIT" | "KREDIT";
type TipeAkun = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";

type AkunLite = { id: number; kode: string; nama: string; pos: Pos; tipe: TipeAkun };

type AggRow = {
  akunId: number;
  _sum: { debit: unknown; kredit: unknown };
};

type Totals = {
  openingDebit: number;
  openingKredit: number;
  mutDebit: number;
  mutKredit: number;
  closingDebit: number;
  closingKredit: number;
  balancedMut: boolean;
  balancedClosing: boolean;
};

/* ===================== Helpers ===================== */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// Parse "YYYY-MM-DD" atau "DD/MM/YYYY"
function parseInputDate(s: string | null): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
    const [d, m, y] = t.split("/").map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(t);
  return isNaN(+dt) ? null : dt;
}

function buildHeaderWhere(
  range: "before" | "in",
  dari: Date,
  sampai: Date,
  statusParam: "ALL" | "POSTED" | "DRAFT"
) {
  const tanggal = range === "before" ? { lt: dari } : { gte: dari, lte: sampai };
  const wh: any = { tanggal };
  if (statusParam !== "ALL") wh.status = statusParam;
  return wh;
}

/* ===================== Handler ===================== */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const q       = url.searchParams.get("q") || null;
    const dariQ   = url.searchParams.get("dari");
    const sampaiQ = url.searchParams.get("sampai");

    // default: POSTED
    const statusRaw = (url.searchParams.get("status") || "POSTED").toUpperCase();
    const statusParam: "ALL" | "POSTED" | "DRAFT" =
      (["ALL", "POSTED", "DRAFT"] as const).includes(statusRaw as any)
        ? (statusRaw as any)
        : "POSTED";

    // tanggal
    const base = new Date();
    const fromInput = parseInputDate(dariQ);
    const toInput   = parseInputDate(sampaiQ);
    const dari   = startOfDay(fromInput  ?? new Date(base.getFullYear(), base.getMonth(), 1));
    const sampai = endOfDay(  toInput    ?? new Date(base.getFullYear(), base.getMonth() + 1, 0));

    const headerWhereBefore = buildHeaderWhere("before", dari, sampai, statusParam);
    const headerWhereIn     = buildHeaderWhere("in",     dari, sampai, statusParam);

    // akun aktif & posting
    //@ts-ignore
    const akunList = (await prisma.akun.findMany({
      where: {
        isActive: true,
        isPosting: true,
        ...(q ? { OR: [{ kode: String(q) }, { nama: { contains: String(q) } }] } : {}),
      },
      select: { id: true, kode: true, nama: true, pos: true, tipe: true },
      orderBy: [{ tipe: "asc" }, { kode: "asc" }],
    })) as AkunLite[];

    const ids = akunList.map(a => a.id);
    if (ids.length === 0) {
      const emptyTotals: Totals = {
        openingDebit: 0, openingKredit: 0,
        mutDebit: 0, mutKredit: 0,
        closingDebit: 0, closingKredit: 0,
        balancedMut: true, balancedClosing: true,
      };
      return NextResponse.json({
        periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
        status: statusParam,
        items: [],
        totals: emptyTotals,
      });
    }

    // agregat sebelum periode
    //@ts-ignore
    const beforeAgg = (await prisma.jurnalLine.groupBy({
      by: ["akunId"],
      where: { akunId: { in: ids }, header: headerWhereBefore },
      _sum: { debit: true, kredit: true },
    })) as unknown as AggRow[];

    // agregat dalam periode
    //@ts-ignore
    const inAgg = (await prisma.jurnalLine.groupBy({
      by: ["akunId"],
      where: { akunId: { in: ids }, header: headerWhereIn },
      _sum: { debit: true, kredit: true },
    })) as unknown as AggRow[];

    const beforeMap = new Map<number, { debit: number; kredit: number }>();
    for (const b of beforeAgg) {
      beforeMap.set(b.akunId, { debit: Number(b._sum.debit || 0), kredit: Number(b._sum.kredit || 0) });
    }

    const inMap = new Map<number, { debit: number; kredit: number }>();
    for (const i of inAgg) {
      inMap.set(i.akunId, { debit: Number(i._sum.debit || 0), kredit: Number(i._sum.kredit || 0) });
    }

    const items = akunList.map(a => {
      const b = beforeMap.get(a.id) || { debit: 0, kredit: 0 };
      const i = inMap.get(a.id)     || { debit: 0, kredit: 0 };

      // net opening (debit-positive)
      const netOpening = b.debit - b.kredit;
      const openingDebit  = Math.max(netOpening, 0);
      const openingKredit = Math.max(-netOpening, 0);

      // closing = opening + (in.debit - in.kredit)
      const netClosing = netOpening + (i.debit - i.kredit);
      const closingDebit  = Math.max(netClosing, 0);
      const closingKredit = Math.max(-netClosing, 0);

      return {
        akunId: a.id,
        kode: a.kode,
        nama: a.nama,
        pos: a.pos,
        tipe: a.tipe,
        openingDebit,
        openingKredit,
        mutDebit: i.debit,
        mutKredit: i.kredit,
        closingDebit,
        closingKredit,
      };
    });

    // totals
    const totals = items.reduce<Totals>((acc, it) => {
      acc.openingDebit  += it.openingDebit;
      acc.openingKredit += it.openingKredit;
      acc.mutDebit      += it.mutDebit;
      acc.mutKredit     += it.mutKredit;
      acc.closingDebit  += it.closingDebit;
      acc.closingKredit += it.closingKredit;
      return acc;
    }, {
      openingDebit: 0, openingKredit: 0,
      mutDebit: 0, mutKredit: 0,
      closingDebit: 0, closingKredit: 0,
      balancedMut: true, balancedClosing: true,
    });

    totals.balancedMut = Math.abs(totals.mutDebit - totals.mutKredit) < 0.5;
    totals.balancedClosing = Math.abs(totals.closingDebit - totals.closingKredit) < 0.5;

    return NextResponse.json({
      periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
      status: statusParam,
      items,
      totals,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
