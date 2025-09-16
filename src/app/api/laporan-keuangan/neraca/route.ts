// app/api/laporan-keuangan/neraca/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type TipeAkun = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";
type Pos = "DEBIT" | "KREDIT";
type AkunLite = { id:number; kode:string; nama:string; tipe:TipeAkun; pos:Pos };
type AggRow = { akunId:number; _sum:{ debit: unknown; kredit: unknown } };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0);
const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);

function parseInputDate(s: string | null): Date | null {
  if (!s) return null;
  const t = s.trim(); if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) { const [y,m,d]=t.split("-").map(Number); return new Date(y,m-1,d); }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) { const [d,m,y]=t.split("/").map(Number); return new Date(y,m-1,d); }
  const dt = new Date(t); return isNaN(+dt) ? null : dt;
}

function buildHeaderWhere(
  range:"before"|"in",
  dari:Date, sampai:Date,
  status:"ALL"|"POSTED"|"DRAFT"
) {
  const tanggal = range === "before" ? { lt: dari } : { gte: dari, lte: sampai };
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

    /* ===================== Akun Neraca (ASET/KEWAJIBAN/EKUITAS) ===================== */
    // @ts-ignore
    const akunList = (await prisma.akun.findMany({
      where: {
        isActive: true,
        isPosting: true,
        tipe: { in: ["ASET", "KEWAJIBAN", "EKUITAS"] },
        ...(q ? { OR: [{ kode: String(q) }, { nama: { contains: String(q) } }] } : {}),
      },
      select: { id:true, kode:true, nama:true, tipe:true, pos:true },
      orderBy: [{ tipe:"asc" }, { kode:"asc" }],
    })) as AkunLite[];

    const ids = akunList.map(a => a.id);
    if (ids.length === 0) {
      return NextResponse.json({
        periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
        status,
        items: [],
        totals: { asetD:0, asetC:0, kewajibanEkuitasD:0, kewajibanEkuitasC:0, balanced:true },
      });
    }

    // Aggregasi BEFORE & IN untuk akun Neraca
    // @ts-ignore
    const beforeAgg = (await prisma.jurnalLine.groupBy({
      by: ["akunId"],
      where: { akunId: { in: ids }, header: buildHeaderWhere("before", dari, sampai, status) },
      _sum: { debit: true, kredit: true },
    })) as unknown as AggRow[];

    // @ts-ignore
    const inAgg = (await prisma.jurnalLine.groupBy({
      by: ["akunId"],
      where: { akunId: { in: ids }, header: buildHeaderWhere("in", dari, sampai, status) },
      _sum: { debit: true, kredit: true },
    })) as unknown as AggRow[];

    const beforeMap = new Map<number,{debit:number;kredit:number}>();
    for (const b of beforeAgg) beforeMap.set(b.akunId, { debit:Number(b._sum.debit||0), kredit:Number(b._sum.kredit||0) });

    const inMap = new Map<number,{debit:number;kredit:number}>();
    for (const i of inAgg) inMap.set(i.akunId, { debit:Number(i._sum.debit||0), kredit:Number(i._sum.kredit||0) });

    const items: Array<{ akunId:number; kode:string; nama:string; tipe:TipeAkun; pos:Pos; closingDebit:number; closingKredit:number }> =
      akunList.map(a=>{
        const b = beforeMap.get(a.id) || { debit:0, kredit:0 };
        const i = inMap.get(a.id)     || { debit:0, kredit:0 };
        const netOpening = b.debit - b.kredit;                // SA neto (D-K)
        const netClosing = netOpening + (i.debit - i.kredit); // SK neto (D-K)
        const closingDebit  = Math.max(netClosing, 0);
        const closingKredit = Math.max(-netClosing, 0);
        return { akunId:a.id, kode:a.kode, nama:a.nama, tipe:a.tipe, pos:a.pos, closingDebit, closingKredit };
      });

    /* ===================== Laba/Rugi Berjalan (periode IN) ===================== */
    // Ambil akun PENDAPATAN & BEBAN
    // @ts-ignore
    const plAkun = (await prisma.akun.findMany({
      where: { isActive:true, isPosting:true, tipe: { in: ["PENDAPATAN","BEBAN"] } },
      select: { id:true, tipe:true },
    })) as { id:number; tipe:"PENDAPATAN"|"BEBAN" }[];

    const plIds = plAkun.map(a=>a.id);
    const tipeMapPL = new Map<number,"PENDAPATAN"|"BEBAN">(plAkun.map(a=>[a.id,a.tipe]));

    let labaBerjalan = 0;
    if (plIds.length > 0) {
      // @ts-ignore
      const plAggIn = (await prisma.jurnalLine.groupBy({
        by: ["akunId"],
        where: { akunId: { in: plIds }, header: buildHeaderWhere("in", dari, sampai, status) },
        _sum: { debit: true, kredit: true },
      })) as unknown as AggRow[];

      let totalPend = 0, totalBeb = 0;
      for (const r of plAggIn) {
        const tipe = tipeMapPL.get(r.akunId);
        const d = Number(r._sum.debit || 0);
        const k = Number(r._sum.kredit || 0);
        if (tipe === "PENDAPATAN") totalPend += (k - d); // normal kredit
        else if (tipe === "BEBAN") totalBeb += (d - k);  // normal debit
      }
      labaBerjalan = totalPend - totalBeb; // (+) laba, (-) rugi
    }

    if (Math.abs(labaBerjalan) > 0.0001) {
      items.push({
        akunId: -1, // virtual
        kode: "LRJ",
        nama: "Laba/Rugi Berjalan",
        tipe: "EKUITAS",
        pos: "KREDIT",
        closingDebit:  labaBerjalan < 0 ? -labaBerjalan : 0,
        closingKredit: labaBerjalan > 0 ?  labaBerjalan : 0,
      });
    }

    /* ===================== Saldo Laba Ditahan (akumulasi BEFORE) ===================== */
    let labaDitahan = 0;
    if (plIds.length > 0) {
      // @ts-ignore
      const plAggBefore = (await prisma.jurnalLine.groupBy({
        by: ["akunId"],
        where: { akunId: { in: plIds }, header: buildHeaderWhere("before", dari, sampai, status) },
        _sum: { debit: true, kredit: true },
      })) as unknown as AggRow[];

      let pend = 0, beb = 0;
      for (const r of plAggBefore) {
        const tipe = tipeMapPL.get(r.akunId);
        const d = Number(r._sum.debit || 0);
        const k = Number(r._sum.kredit || 0);
        if (tipe === "PENDAPATAN") pend += (k - d);
        else if (tipe === "BEBAN") beb += (d - k);
      }
      labaDitahan = pend - beb; // (+) laba kumulatif, (-) rugi kumulatif
    }

    if (Math.abs(labaDitahan) > 0.0001) {
      items.push({
        akunId: -2, // virtual
        kode: "RETA",
        nama: "Saldo Laba Ditahan",
        tipe: "EKUITAS",
        pos: "KREDIT",
        closingDebit:  labaDitahan < 0 ? -labaDitahan : 0,
        closingKredit: labaDitahan > 0 ?  labaDitahan : 0,
      });
    }

    /* ===================== Totals & Balance ===================== */
    const aset = items.filter(x=>x.tipe==="ASET");
    const kewEki = items.filter(x=>x.tipe==="KEWAJIBAN" || x.tipe==="EKUITAS");

    const totals = {
      asetD: aset.reduce((s,x)=>s+x.closingDebit, 0),
      asetC: aset.reduce((s,x)=>s+x.closingKredit, 0),
      kewajibanEkuitasD: kewEki.reduce((s,x)=>s+x.closingDebit, 0),
      kewajibanEkuitasC: kewEki.reduce((s,x)=>s+x.closingKredit, 0),
      balanced: true,
    };
    totals.balanced =
      Math.abs((totals.asetD + totals.asetC) - (totals.kewajibanEkuitasD + totals.kewajibanEkuitasC)) < 0.5;

    return NextResponse.json({
      periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
      status,
      items,
      totals,
    });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
