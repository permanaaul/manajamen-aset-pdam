// app/api/laporan/penyusutan/route.tsx
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ===================== Utils ===================== */
const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n ?? 0);

const get = (o: any, keys: string[], d?: any) => { for (const k of keys) if (o && o[k] != null) return o[k]; return d; };
const safe = async <T,>(fn: () => Promise<T>, fb: T): Promise<T> => { try { return await fn(); } catch { return fb; } };

const ymStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfYear = (d: Date) => new Date(d.getFullYear(), 11, 31, 23, 59, 59);
const monthsDiff = (from: Date, to: Date) => Math.max(0, (to.getFullYear()-from.getFullYear())*12 + (to.getMonth()-from.getMonth()) + 1);
const ymRange = (ym: string) => { const [y,m]=ym.split("-").map(Number); return { start:new Date(y,m-1,1,0,0,0), end:new Date(y,m,0,23,59,59) }; };

// Nama bulan Indonesia + label periode
const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const ymToLabel = (ym: string) => { const [y,m] = ym.split("-").map(Number); return `${MONTHS_ID[m-1]} ${y}`; };

const csvDownload = (csv: string, name: string) =>
  new NextResponse(csv, { status:200, headers:{ "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":`attachment; filename="${name}"` }});

async function respondPdf(jsx: React.ReactElement, filename: string) {
  const buf = await pdf(jsx as any).toBuffer();
  return new NextResponse(buf as any, {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}

/* ===================== PDF styles ===================== */
const styles = StyleSheet.create({
  page:{ padding:24, fontSize:10, color:"#111827" },
  h1:{ fontSize:16, fontWeight:700, marginBottom:2 },
  sub:{ fontSize:10, color:"#4B5563", marginBottom:8 },
  chips:{ flexDirection:"row", gap:8, flexWrap:"wrap", marginBottom:10 },
  chip:{ borderWidth:1, borderColor:"#E5E7EB", borderRadius:6, paddingVertical:4, paddingHorizontal:8 },
  table:{ borderWidth:1, borderColor:"#E5E7EB", borderRadius:6 },
  thead:{ flexDirection:"row", backgroundColor:"#F3F4F6", borderBottomWidth:1, borderColor:"#E5E7EB" },
  tr:{ flexDirection:"row", borderBottomWidth:1, borderColor:"#E5E7EB" },
  th:{ padding:6, fontWeight:700, borderRightWidth:1, borderColor:"#E5E7EB" },
  td:{ padding:6, borderRightWidth:1, borderColor:"#E5E7EB" },
  right:{ textAlign:"right" },
});

/* ===================== Helpers number/date fleksibel ===================== */
function pickNumber(src: any, keys: string[]) {
  for (const k of keys) { const v = src?.[k]; const n = Number(v); if (Number.isFinite(n) && n !== 0) return n; }
  for (const k of keys) { const v = src?.[k]; const n = Number(v); if (Number.isFinite(n)) return n; }
  return 0;
}
function toDate(v: any): Date | null {
  if (!v) return null;
  try { const d = new Date(v); return isNaN(+d) ? null : d; } catch { return null; }
}

/* ===================== Types ===================== */
type RekapRow = {
  asetId?: number | null;
  asetKode?: string | null;
  asetNama: string;
  metode: string;
  periode: string;
  beban: number;
  akumulasi: number;
  nilaiBukuAkhir: number;
  posted: boolean;
};
type Tot = { items: number; beban: number; akumulasi: number; nb: number; posted: number };

/* ===================== GET ===================== */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;

  const type     = (sp.get("type") || "rekap").toLowerCase();  // rekap | detail
  const format   = (sp.get("format") || "").toLowerCase();     // '' | csv | pdf
  const period   = sp.get("period") || new Date().toISOString().slice(0,7);
  const status   = (sp.get("status") || "").toLowerCase();     // '', posted, unposted
  const showZero = sp.get("showZero") === "1";
  const asetFilter = (sp.get("aset") || "").trim();
  const asetId   = sp.get("asetId") ? Number(sp.get("asetId")) : undefined;
  const untilYM  = (sp.get("until") || sp.get("untilYM") || "").trim() || undefined; // batas periode (opsional)

  if (type === "detail") return handleDetail({ format, asetFilter, asetId, untilYM });
  return handleRekap({ format, period, status, showZero, asetFilter });
}

/* ===================== REKAP (tidak diutak-atik UI) ===================== */
async function handleRekap(p:{ format:string; period:string; status:string; showZero:boolean; asetFilter:string }) {
  const { format, period, status, showZero, asetFilter } = p;
  const { start, end } = ymRange(period);

  // 1) Aset
  // @ts-ignore
  const asetList: any[] = await safe(() => prisma.aset.findMany({ orderBy:{ id:"asc" }}), []);
  const asetFiltered = asetList.filter(a => {
    if (!asetFilter) return true;
    const q = asetFilter.toLowerCase();
    const kode = String(get(a, ["kode","code","nomor","noAset"], "")).toLowerCase();
    const nama = String(get(a, ["nama","name","judul","deskripsi"], "")).toLowerCase();
    return kode.includes(q) || nama.includes(q);
  });
  const asetIds = asetFiltered.map(a=>a.id).filter(Boolean);

  // 2) Perolehan fallback dari ISSUE
  // @ts-ignore
  const issues: any[] = await safe(() => prisma.stokTransaksiLine.findMany({
    where:{ asetId:{ in: asetIds.length?asetIds:undefined }, header:{ tipe:"ISSUE", tanggal:{ lte:end }}},
    select:{ asetId:true, qty:true, hargaRp:true, header:{ select:{ tanggal:true }}},
  }), []);
  const perolehanFromIssue = new Map<number, number>();
  const firstIssueDate = new Map<number, Date>();
  for (const l of issues) {
    const v = toNum(l.hargaRp) * toNum(l.qty);
    perolehanFromIssue.set(l.asetId, (perolehanFromIssue.get(l.asetId) || 0) + v);
    if (!firstIssueDate.get(l.asetId)) firstIssueDate.set(l.asetId, l?.header?.tanggal ? new Date(l.header.tanggal) : new Date());
  }

  // 3) Semua baris penyusutan (untuk hitung beban periode & akumulasi s/d akhir periode)
  const statusExpr = status === "posted" ? { status:"POSTED" } : status === "unposted" ? { status:{ not:"POSTED" } } : {};
  // @ts-ignore
  const depLines: any[] = await safe(() => prisma.penyusutanLine.findMany({
    where:{ asetId:{ in: asetIds.length?asetIds:undefined }, header:{ ...(statusExpr as any) } },
    select:{ asetId:true, nominal:true, beban:true, header:{ select:{ tanggal:true, status:true, posted:true }}},
  }), []);
  const bebanByAset = new Map<number, number>();
  const akumByAset  = new Map<number, number>();
  const postedFlag  = new Map<number, boolean>();

  for (const l of depLines) {
    const d = l?.header?.tanggal ? new Date(l.header.tanggal) : null;
    const n = pickNumber(l, ["nominal","beban","jumlah","nilai","amount","nilaiBeban","depresiasi","depreciation","nilaiPenyusutan"]);
    if (!d || d <= end) akumByAset.set(l.asetId, (akumByAset.get(l.asetId)||0) + n);
    if (d && ymStr(d) === period) bebanByAset.set(l.asetId, (bebanByAset.get(l.asetId)||0) + n);
    const st = String(l?.header?.status ?? "").toUpperCase();
    if (st.includes("POST") || l?.header?.posted === true) postedFlag.set(l.asetId, true);
  }

  // 4) Rows
  const rows: RekapRow[] = asetFiltered.map(a => {
    const kode = get(a, ["kode","code","nomor","noAset"], null);
    const nama = get(a, ["nama","name","judul","deskripsi"], "") || "";
    const metode = (get(a, ["metode","method"], "GARIS LURUS") || "GARIS LURUS").toString();

    const perolehanDirect = pickNumber(a, ["nilaiPerolehan","perolehanRp","hargaPerolehan","harga","nilai","nilaiAset","totalHarga"]);
    const perolehan = perolehanDirect || perolehanFromIssue.get(a.id) || 0;

    const tglAset =
      toDate(get(a, ["tglPerolehan","tanggalPerolehan","tanggalBeli","tglBeli","tanggal","tgl","createdAt"], null)) ||
      firstOfMonth(firstIssueDate.get(a.id) || new Date());
    const umurBulan =
      pickNumber(a, ["umurBulan","masaManfaatBulan","lifeMonths"]) ||
      (pickNumber(a, ["umur","lifeYears"]) * 12) || 60;
    const residual = pickNumber(a, ["nilaiSisa","residual","nilaiResidu","salvage"]) || 0;

    let beban = bebanByAset.get(a.id) || 0;
    let akum  = akumByAset.get(a.id)  || 0;
    let posted = !!postedFlag.get(a.id);

    if (perolehan > 0 && (beban + akum) === 0) {
      const base = Math.max(0, perolehan - residual);
      const bebanBulanan = Math.round(base / Math.max(1, umurBulan));
      const startAset = firstOfMonth(tglAset);
      const bulanTerpakai = Math.min(umurBulan, monthsDiff(startAset, end));
      akum = bebanBulanan * bulanTerpakai;

      const [py, pm] = period.split("-").map(Number);
      const startPeriod = new Date(py, pm-1, 1);
      const inRange = startPeriod >= startAset && monthsDiff(startAset, startPeriod) <= umurBulan;
      beban = inRange ? bebanBulanan : 0;
      posted = false;
    }

    const nb = Math.max(0, perolehan - akum);
    return { asetId:a.id, asetKode:kode, asetNama:nama, metode, periode:period, beban, akumulasi:akum, nilaiBukuAkhir:nb, posted };
  }).filter(r => (showZero ? true : (r.beban + r.akumulasi + r.nilaiBukuAkhir) !== 0));

  const total: Tot = rows.reduce((a,r)=>({ items:a.items+1, beban:a.beban+r.beban, akumulasi:a.akumulasi+r.akumulasi, nb:a.nb+r.nilaiBukuAkhir, posted:a.posted+(r.posted?1:0)}), { items:0, beban:0, akumulasi:0, nb:0, posted:0 });

  if (format === "csv") {
    const head = ["Aset Kode","Aset Nama","Metode","Periode","Beban","Akumulasi","Nilai Buku","Status"];
    const body = rows.map(r => [r.asetKode ?? "", r.asetNama, r.metode, r.periode, r.beban, r.akumulasi, r.nilaiBukuAkhir, r.posted?"POSTED":"UNPOSTED"]);
    const csv = `${head.join(",")}\n${body.map(r=>r.join(",")).join("\n")}`;
    return csvDownload(csv, `laporan_penyusutan_${period}.csv`);
  }

  if (format === "pdf") {
    const Pdf = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Laporan Penyusutan</Text>
          <Text style={styles.sub}>Periode {period} — Beban periode, akumulasi s/d periode, dan nilai buku.</Text>
          <View style={styles.chips}>
            <Text style={styles.chip}># Aset: {total.items}</Text>
            <Text style={styles.chip}>Total Beban: {idr(total.beban)}</Text>
            <Text style={styles.chip}>Total Akumulasi: {idr(total.akumulasi)}</Text>
            <Text style={styles.chip}>Total Nilai Buku: {idr(total.nb)}</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={[styles.th,{width:90}]}>Kode</Text>
              <Text style={[styles.th,{flex:1}]}>Nama Aset</Text>
              <Text style={[styles.th,{width:100}]}>Metode</Text>
              <Text style={[styles.th,{width:60}]}>Periode</Text>
              <Text style={[styles.th,{width:80},styles.right]}>Beban</Text>
              <Text style={[styles.th,{width:95},styles.right]}>Akumulasi</Text>
              <Text style={[styles.th,{width:95},styles.right]}>Nilai Buku</Text>
              <Text style={[styles.th,{width:70}]}>Status</Text>
            </View>
            {rows.map((r,i)=>(
              <View key={i} style={styles.tr} wrap={false}>
                <Text style={[styles.td,{width:90}]}>{r.asetKode ?? "-"}</Text>
                <Text style={[styles.td,{flex:1}]}>{r.asetNama}</Text>
                <Text style={[styles.td,{width:100}]}>{r.metode}</Text>
                <Text style={[styles.td,{width:60}]}>{r.periode}</Text>
                <Text style={[styles.td,{width:80},styles.right]}>{idr(r.beban)}</Text>
                <Text style={[styles.td,{width:95},styles.right]}>{idr(r.akumulasi)}</Text>
                <Text style={[styles.td,{width:95},styles.right]}>{idr(r.nilaiBukuAkhir)}</Text>
                <Text style={[styles.td,{width:70}]}>{r.posted ? "POSTED" : "UNPOSTED"}</Text>
              </View>
            ))}
          </View>
        </Page>
      </Document>
    );
    return respondPdf(Pdf, `laporan_penyusutan_${period}.pdf`);
  }

  return NextResponse.json({ period, rows, total });
}

/* ===================== DETAIL PER ASET (PDF per aset) ===================== */
async function handleDetail(p:{ format:string; asetFilter:string; asetId?:number; untilYM?:string }) {
  const { format, asetFilter, asetId, untilYM } = p;

  // 1) cari aset
  let aset: any | null = null;
  if (asetId && Number.isFinite(asetId)) {
    // @ts-ignore
    aset = await safe(() => prisma.aset.findUnique({ where:{ id:Number(asetId) }}), null);
  }
  if (!aset) {
    const q = asetFilter.trim();
    if (!q) return NextResponse.json({ error:"Aset tidak ditemukan. Isi parameter asetId atau aset (kode/nama)." }, { status:400 });
    // @ts-ignore
    const list: any[] = await safe(() => prisma.aset.findMany({
      where:{ OR:[ { kode:{ contains:q, mode:"insensitive" } }, { nama:{ contains:q, mode:"insensitive" } } ] },
      orderBy:{ id:"asc" }, take:1
    }), []);
    aset = list[0] ?? null;
    if (!aset) return NextResponse.json({ error:"Aset tidak ditemukan. Isi parameter asetId atau aset (kode/nama)." }, { status:404 });
  }

  const perolehan = pickNumber(aset, ["nilaiPerolehan","perolehanRp","hargaPerolehan","harga","nilai","nilaiAset","totalHarga"]);
  const residual  = pickNumber(aset, ["nilaiSisa","residual","nilaiResidu","salvage"]) || 0;

  // prefer bulan dari konfigurasi aset; kalau hanya tahun → konversi ke bulan; kalau kosong → fallback rows.length
  const umurBulanConf =
    pickNumber(aset, ["umurBulan","masaManfaatBulan","lifeMonths"]) ||
    (pickNumber(aset, ["umur","lifeYears"]) * 12) || 0;

  const startDate =
    toDate(get(aset, [
      "mulaiPenyusutan","tanggalMulaiPenyusutan","tglMulaiSusut","depreciationStart","startDepreciation",
      "tglOperasi","tanggalOperasi",
      "tglPerolehan","tanggalPerolehan","tanggalBeli","tglBeli",
      "tanggal","tgl","createdAt",
    ], null)) || new Date();
  const start = firstOfMonth(startDate);

  // 2) tarik baris dari DB
  // @ts-ignore
  const lines: any[] = await safe(() => prisma.penyusutanLine.findMany({
    where:{ asetId: aset.id },
    orderBy:[ { header:{ tanggal:"asc" } }, { id:"asc" } ],
    select:{ nominal:true, beban:true, metode:true, basis:true, rate:true, header:{ select:{ tanggal:true, status:true } } },
  }), []);

  // 3) rakit rows detail
  type DetailRow = { periode:string; periodeLabel:string; metode:string; basis:string; tarif:number; nilaiAwal:number; beban:number; akumulasi:number; nilaiBuku:number; status:string };
  let rows: DetailRow[] = [];
  let rangeStartYM = ymStr(start);
  let rangeEndYM = rangeStartYM;

  if (lines.length > 0) {
    let akum = 0;
    for (const l of lines) {
      const d = l?.header?.tanggal ? new Date(l.header.tanggal) : new Date();
      const ym = ymStr(d);
      const beban = pickNumber(l, ["nominal","beban","jumlah","nilai","amount","nilaiBeban","depresiasi","depreciation","nilaiPenyusutan"]);

      const nilaiAwal = Math.max(0, perolehan - akum);
      akum += beban;
      const nilaiBuku = Math.max(0, perolehan - akum);

      rows.push({
        periode: ym,
        periodeLabel: ymToLabel(ym),
        metode: String(l?.metode || "GARIS LURUS"),
        basis: String(l?.basis || "BULANAN"),
        tarif: Number(l?.rate ?? 0),
        nilaiAwal, beban, akumulasi: akum, nilaiBuku,
        status: String(l?.header?.status ?? "-").toUpperCase(),
      });
    }
    rangeStartYM = rows[0].periode;
    const lastYM = rows[rows.length - 1].periode;
    rangeEndYM = untilYM && untilYM > "0000-00" ? untilYM : lastYM;
    rows = rows.filter(r => r.periode <= rangeEndYM);
  } else {
    // synth garis lurus — DIBATASI (untilYM / akhir tahun start)
    const umurBulan = umurBulanConf || 60; // kalau aset tak isi sama sekali
    const base = Math.max(0, perolehan - residual);
    const bebanBulanan = Math.round(base / Math.max(1, umurBulan));

    const capDate = untilYM ? ymRange(untilYM).end : endOfYear(start);
    const totalMonths = Math.min(umurBulan, monthsDiff(start, capDate));

    let akum = 0;
    for (let i=0;i<totalMonths;i++){
      const d = new Date(start.getFullYear(), start.getMonth()+i, 1);
      const ym = ymStr(d);
      const nilaiAwal = Math.max(0, perolehan - akum);
      akum = Math.min(base, akum + bebanBulanan);
      const nilaiBuku = Math.max(0, perolehan - akum);

      rows.push({
        periode: ym, periodeLabel: ymToLabel(ym),
        metode: "GARIS LURUS", basis: "BULANAN", tarif: 0,
        nilaiAwal, beban: bebanBulanan, akumulasi: akum, nilaiBuku, status: "AUTO",
      });
      if (akum >= base) break;
    }
    rangeEndYM = rows.length ? rows[rows.length-1].periode : rangeStartYM;
  }

  // === Header chips ===
  // umur ditentukan oleh konfigurasi aset bila ada; jika tidak, jumlah baris tampilan
  const umurDisplayBulan = umurBulanConf > 0 ? umurBulanConf : rows.length;
  const periodeLabel = `${ymToLabel(rangeStartYM)} – ${ymToLabel(rangeEndYM)}`;
  const totalBeban = rows.reduce((a,r)=>a+r.beban,0);
  const akumAkhir = rows.length ? rows[rows.length-1].akumulasi : 0;
  const nilaiAkhir = rows.length ? rows[rows.length-1].nilaiBuku : perolehan;

  if (format === "pdf") {
    const Pdf = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Penyusutan Per Aset</Text>
          <Text style={styles.sub}>
            {(aset?.kode ?? "-")} — {(aset?.nama ?? "-")}
          </Text>

          <View style={styles.chips}>
            <Text style={styles.chip}>Perolehan: {idr(perolehan)}</Text>
            <Text style={styles.chip}>Residu: {idr(residual)}</Text>
            <Text style={styles.chip}>Umur: {umurDisplayBulan} bln</Text>
            <Text style={styles.chip}>Periode: {periodeLabel}</Text>
            <Text style={styles.chip}>Total Beban: {idr(totalBeban)}</Text>
            <Text style={styles.chip}>Akumulasi Akhir: {idr(akumAkhir)}</Text>
            <Text style={styles.chip}>Nilai Akhir: {idr(nilaiAkhir)}</Text>
          </View>

          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={[styles.th,{width:80}]}>Periode</Text>
              <Text style={[styles.th,{width:90}]}>Metode</Text>
              <Text style={[styles.th,{width:70}]}>Basis</Text>
              <Text style={[styles.th,{width:50},styles.right]}>Tarif</Text>
              <Text style={[styles.th,{width:95},styles.right]}>Nilai Awal</Text>
              <Text style={[styles.th,{width:85},styles.right]}>Beban</Text>
              <Text style={[styles.th,{width:95},styles.right]}>Akumulasi</Text>
              <Text style={[styles.th,{width:95},styles.right]}>Nilai Buku</Text>
            </View>
            {rows.map((r,i)=>(
              <View key={i} style={styles.tr} wrap={false}>
                <Text style={[styles.td,{width:80}]}>{r.periodeLabel}</Text>
                <Text style={[styles.td,{width:90}]}>{r.metode}</Text>
                <Text style={[styles.td,{width:70}]}>{r.basis}</Text>
                <Text style={[styles.td,{width:50},styles.right]}>{(Math.round((r.tarif||0)*10000)/100).toFixed(2)}%</Text>
                <Text style={[styles.td,{width:95},styles.right]}>{idr(r.nilaiAwal)}</Text>
                <Text style={[styles.td,{width:85},styles.right]}>{idr(r.beban)}</Text>
                <Text style={[styles.td,{width:95},styles.right]}>{idr(r.akumulasi)}</Text>
                <Text style={[styles.td,{width:95},styles.right]}>{idr(r.nilaiBuku)}</Text>
              </View>
            ))}
          </View>
        </Page>
      </Document>
    );
    const fname = `penyusutan_${(aset?.kode || aset?.nama || "aset").toString().replace(/\s+/g,"_")}.pdf`;
    return respondPdf(Pdf, fname);
  }

  return NextResponse.json({
    aset: { id: aset.id, kode: aset?.kode ?? null, nama: aset?.nama ?? "" },
    range: { start: rangeStartYM, end: rangeEndYM, startLabel: ymToLabel(rangeStartYM), endLabel: ymToLabel(rangeEndYM) },
    umurBulan: umurDisplayBulan,
    totalBeban, akumulasiAkhir: akumAkhir, nilaiAkhir,
    rows,
  });
}
