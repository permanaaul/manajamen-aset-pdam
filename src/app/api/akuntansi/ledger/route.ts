import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/* ===================== Types ===================== */
type Pos = "DEBIT" | "KREDIT";
type TipeAkun = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";

type AkunLite = { id: number; kode: string; nama: string; pos: Pos; tipe: TipeAkun };

type EntryOut = {
  id: number;
  tanggal: string;
  nomor: string;
  sumber: string | null;
  memo: string | null;
  refTable: string | null;
  refId: number | null;
  refNo: string | null;
  debit: number;
  kredit: number;
  saldo: number;
};

type LineDB = {
  id: number;
  debit: unknown;
  kredit: unknown;
  header: {
    tanggal: Date;
    nomor: string;
    sumber: string | null;
    memo: string | null;
    refTable: string | null;
    refId: number | null;
    refNo: string | null;
  } | null;
};

type AggRow = {
  // prisma akan mengembalikan ini; ketikkan eksplisit supaya tidak any
  akunId: number;
  _sum: { debit: unknown; kredit: unknown };
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

    const summary = url.searchParams.get("summary") === "1";
    const akunIdQ = url.searchParams.get("akunId");
    const kodeQ   = url.searchParams.get("kode") || url.searchParams.get("q") || null;

    const dariQ   = url.searchParams.get("dari");
    const sampaiQ = url.searchParams.get("sampai");

    // default → POSTED
    const statusRaw = (url.searchParams.get("status") || "POSTED").toUpperCase();
    const statusParam: "ALL" | "POSTED" | "DRAFT" =
      (["ALL", "POSTED", "DRAFT"] as const).includes(statusRaw as any)
        ? (statusRaw as any)
        : "POSTED";

    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const size = Math.min(200, Math.max(1, Number(url.searchParams.get("size") || 100)));

    // tanggal
    const base = new Date();
    const fromInput = parseInputDate(dariQ);
    const toInput   = parseInputDate(sampaiQ);
    const dari   = startOfDay(fromInput  ?? new Date(base.getFullYear(), base.getMonth(), 1));
    const sampai = endOfDay(  toInput    ?? new Date(base.getFullYear(), base.getMonth() + 1, 0));

    const headerWhereBefore = buildHeaderWhere("before", dari, sampai, statusParam);
    const headerWhereIn     = buildHeaderWhere("in",     dari, sampai, statusParam);

    /* ========== MODE RINGKASAN (summary=1) ========== */
    if (summary) {
      // daftar akun posting & aktif, optional filter q (kode/nama) — tanpa mode: "insensitive"
      //@ts-ignore
      const akunList = (await prisma.akun.findMany({
        where: {
          isActive: true,
          isPosting: true,
          ...(kodeQ
            ? { OR: [{ kode: String(kodeQ) }, { nama: { contains: String(kodeQ) } }] }
            : {}),
        },
        select: { id: true, kode: true, nama: true, pos: true, tipe: true },
        orderBy: [{ tipe: "asc" }, { kode: "asc" }],
      })) as AkunLite[];

      const ids = akunList.map((a: AkunLite) => a.id);
      if (ids.length === 0) {
        return NextResponse.json({
          periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
          status: statusParam,
          items: [] as any[],
        });
      }

      // agregat sebelum periode
      //@ts-ignore
      const beforeAgg = (await prisma.jurnalLine.groupBy({
        by: ["akunId"],
        where: { akunId: { in: ids }, header: headerWhereBefore },
        _sum: { debit: true, kredit: true },
      })) as unknown as AggRow[];

      const beforeMap = new Map<number, { debit: number; kredit: number }>();
      for (const b of beforeAgg as AggRow[]) {
        beforeMap.set(b.akunId, {
          debit: Number(b._sum.debit || 0),
          kredit: Number(b._sum.kredit || 0),
        });
      }

      // agregat dalam periode
      //@ts-ignore
      const inAgg = (await prisma.jurnalLine.groupBy({
        by: ["akunId"],
        where: { akunId: { in: ids }, header: headerWhereIn },
        _sum: { debit: true, kredit: true },
      })) as unknown as AggRow[];

      const inMap = new Map<number, { debit: number; kredit: number }>();
      for (const b of inAgg as AggRow[]) {
        inMap.set(b.akunId, {
          debit: Number(b._sum.debit || 0),
          kredit: Number(b._sum.kredit || 0),
        });
      }

      const items = akunList.map((a: AkunLite) => {
        const b = beforeMap.get(a.id) || { debit: 0, kredit: 0 };
        const i = inMap.get(a.id)     || { debit: 0, kredit: 0 };
        const opening =
          a.pos === "DEBIT" ? b.debit - b.kredit : b.kredit - b.debit;
        const closing =
          opening + (a.pos === "DEBIT" ? (i.debit - i.kredit) : (i.kredit - i.debit));
        return {
          akunId: a.id,
          kode: a.kode,
          nama: a.nama,
          pos: a.pos,
          tipe: a.tipe,
          opening,
          debit: i.debit,
          kredit: i.kredit,
          closing,
        };
      });

      return NextResponse.json({
        periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
        status: statusParam,
        items,
      });
    }

    /* ========== MODE DETAIL (per akun) ========== */
    let akun: { id: number; kode: string; nama: string; pos: Pos } | null = null;

    if (akunIdQ) {
      //@ts-ignore
      akun = (await prisma.akun.findUnique({
        where: { id: Number(akunIdQ) },
        select: { id: true, kode: true, nama: true, pos: true },
      })) as unknown as { id: number; kode: string; nama: string; pos: Pos } | null;
    } else if (kodeQ) {
      // aman di semua versi Prisma (tanpa "mode")
      //@ts-ignore
      akun = (await prisma.akun.findFirst({
        where: { OR: [{ kode: String(kodeQ) }, { nama: { contains: String(kodeQ) } }] },
        select: { id: true, kode: true, nama: true, pos: true },
      })) as unknown as { id: number; kode: string; nama: string; pos: Pos } | null;
    }

    if (!akun) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });

    // saldo awal
    //@ts-ignore
    const aggBefore = (await prisma.jurnalLine.groupBy({
      by: ["akunId"],
      where: { akunId: akun.id, header: headerWhereBefore },
      _sum: { debit: true, kredit: true },
    })) as unknown as AggRow[];
    const sumB = aggBefore[0]?._sum || { debit: 0, kredit: 0 };
    const opening =
      akun.pos === "DEBIT"
        ? Number(sumB.debit || 0) - Number(sumB.kredit || 0)
        : Number(sumB.kredit || 0) - Number(sumB.debit || 0);

    // lines periode
    //@ts-ignore
    const lines = (await prisma.jurnalLine.findMany({
      where: { akunId: akun.id, header: headerWhereIn },
      orderBy: [{ header: { tanggal: "asc" } }, { id: "asc" }],
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true,
        debit: true,
        kredit: true,
        header: {
          select: {
            tanggal: true,
            nomor: true,
            sumber: true,
            memo: true,
            refTable: true,
            refId: true,
            refNo: true,
          },
        },
      },
    })) as unknown as LineDB[];

    // total mutasi
    //@ts-ignore
    const totalAgg = (await prisma.jurnalLine.groupBy({
      by: ["akunId"],
      where: { akunId: akun.id, header: headerWhereIn },
      _sum: { debit: true, kredit: true },
    })) as unknown as AggRow[];
    const sumIn = totalAgg[0]?._sum || { debit: 0, kredit: 0 };
    const totalDebit  = Number(sumIn.debit  || 0);
    const totalKredit = Number(sumIn.kredit || 0);

    // running saldo
    let run = opening;
    const rows: EntryOut[] = (lines as LineDB[]).map((l: LineDB): EntryOut => {
      const d = Number(l.debit || 0);
      const k = Number(l.kredit || 0);
      run = akun!.pos === "DEBIT" ? run + (d - k) : run + (k - d);
      return {
        id: l.id,
        tanggal: l.header!.tanggal.toISOString(),
        nomor: l.header!.nomor,
        sumber: l.header!.sumber,
        memo: l.header!.memo,
        refTable: l.header!.refTable,
        refId: l.header!.refId,
        refNo: l.header!.refNo,
        debit: d,
        kredit: k,
        saldo: run,
      };
    });

    const closing =
      opening + (akun.pos === "DEBIT" ? (totalDebit - totalKredit) : (totalKredit - totalDebit));
    //@ts-ignore
    const count = await prisma.jurnalLine.count({
      where: { akunId: akun.id, header: headerWhereIn },
    });

    return NextResponse.json({
      akun,
      periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
      status: statusParam,
      page,
      size,
      count,
      opening,
      totalDebit,
      totalKredit,
      closing,
      rows,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
