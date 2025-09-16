// app/api/laporan-keuangan/laba-rugi/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/* ===== Types ===== */
type TipeAkun = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";
type Pos = "DEBIT" | "KREDIT";

type AkunLite = { id:number; kode:string; nama:string; tipe:TipeAkun; pos:Pos };

type AggRow = { akunId:number; _sum:{ debit: unknown; kredit: unknown } };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0);
const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);

function parseInputDate(s: string | null): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) { const [y,m,d]=t.split("-").map(Number); return new Date(y,m-1,d); }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) { const [d,m,y]=t.split("/").map(Number); return new Date(y,m-1,d); }
  const dt = new Date(t); return isNaN(+dt) ? null : dt;
}
function buildHeaderWhere(range:"in", dari:Date, sampai:Date, status:"ALL"|"POSTED"|"DRAFT") {
  const tanggal = { gte: dari, lte: sampai };
  const wh:any = { tanggal };
  if (status !== "ALL") wh.status = status;
  return wh;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || null;
    const dariQ = url.searchParams.get("dari");
    const sampaiQ = url.searchParams.get("sampai");
    const statusRaw = (url.searchParams.get("status") || "POSTED").toUpperCase();
    const status: "ALL"|"POSTED"|"DRAFT" =
      (["ALL","POSTED","DRAFT"] as const).includes(statusRaw as any) ? (statusRaw as any) : "POSTED";

    const base = new Date();
    const dari   = startOfDay(parseInputDate(dariQ)   ?? new Date(base.getFullYear(), base.getMonth(), 1));
    const sampai = endOfDay(  parseInputDate(sampaiQ) ?? new Date(base.getFullYear(), base.getMonth()+1, 0));

    // akun PENDAPATAN & BEBAN aktif, posting
    // @ts-ignore
    const akunList = (await prisma.akun.findMany({
      where: {
        isActive: true,
        isPosting: true,
        tipe: { in: ["PENDAPATAN", "BEBAN"] },
        ...(q ? { OR: [{ kode: String(q) }, { nama: { contains: String(q) } }] } : {}),
      },
      select: { id:true, kode:true, nama:true, tipe:true, pos:true },
      orderBy: [{ tipe: "asc" }, { kode: "asc" }],
    })) as AkunLite[];

    const ids = akunList.map(a => a.id);
    if (ids.length === 0) {
      return NextResponse.json({
        periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
        status, pendapatan: [], beban: [],
        totals: { pendapatan: 0, beban: 0, labaBersih: 0 },
      });
    }

    // Mutasi dalam periode
    // @ts-ignore
    const inAgg = (await prisma.jurnalLine.groupBy({
      by: ["akunId"],
      where: { akunId: { in: ids }, header: buildHeaderWhere("in", dari, sampai, status) },
      _sum: { debit: true, kredit: true },
    })) as unknown as AggRow[];

    const map = new Map<number, { debit:number; kredit:number }>();
    for (const r of inAgg) map.set(r.akunId, { debit: Number(r._sum.debit || 0), kredit: Number(r._sum.kredit || 0) });

    const pendapatan: Array<{ akunId:number; kode:string; nama:string; nilai:number }> = [];
    const beban: Array<{ akunId:number; kode:string; nama:string; nilai:number }> = [];

    for (const a of akunList) {
      const m = map.get(a.id) || { debit:0, kredit:0 };
      if (a.tipe === "PENDAPATAN") {
        pendapatan.push({ akunId:a.id, kode:a.kode, nama:a.nama, nilai: m.kredit - m.debit });
      } else {
        beban.push({ akunId:a.id, kode:a.kode, nama:a.nama, nilai: m.debit - m.kredit });
      }
    }

    const totalPend = pendapatan.reduce((s,x)=>s + x.nilai, 0);
    const totalBeb  = beban.reduce((s,x)=>s + x.nilai, 0);
    const laba = totalPend - totalBeb;

    return NextResponse.json({
      periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
      status,
      pendapatan, beban,
      totals: { pendapatan: totalPend, beban: totalBeb, labaBersih: laba },
    });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
