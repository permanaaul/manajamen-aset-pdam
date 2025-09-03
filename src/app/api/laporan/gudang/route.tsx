// app/api/laporan/gudang/route.ts
import React from "react";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";


// PDF
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

/* ===================== Output Types ===================== */
interface SaldoOutRow {
  kategori: string | null;
  itemCode: string;
  itemName: string;
  satuan: string | null;
  awal: number;       // = item.minQty
  masuk: number;      // RECEIPT + ADJ(+)
  keluar: number;     // ISSUE + ADJ(-)
  adj: number;        // net adj (+/-) untuk info kolom
  akhir: number;      // awal + masuk - keluar
  minQty: number | null;
}
interface PemakaianOutRow {
  tanggal: string;
  dokNo: string | null;
  itemCode: string;
  itemName: string;
  qty: number;
  nilai: number;
  asetWO: string | null;
}

/* ===================== Record Types ===================== */
interface ItemRec {
  id: number;
  kode?: string | null;
  nama?: string | null;
  minQty?: number | null;
  satuan?: { simbol?: string | null } | null;
}
interface HeaderLite {
  nomor?: string | null;
  tanggal?: Date | null;
  tipe?: "RECEIPT" | "ISSUE" | "ADJUSTMENT" | null;
  referensi?: string | null;
  catatan?: string | null;
  gudangAsalId?: number | null;
  gudangTujuanId?: number | null;
}
interface LineRec {
  itemId: number;
  qty: number | null;
  hargaRp: number | null;
  catatan: string | null;
  item: { kode?: string | null; nama?: string | null } | null;
  header: HeaderLite;
}
interface IssueLineRec {
  qty: number | null;
  hargaRp: number | null;
  item: { kode?: string | null; nama?: string | null } | null;
  header: { nomor?: string | null; tanggal?: Date | null; gudangAsalId?: number | null };
}

/* ===================== GET ===================== */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const type = (sp.get("type") || "").toLowerCase() as "saldo" | "pemakaian";
  if (type !== "saldo" && type !== "pemakaian") {
    return NextResponse.json({ error: "param `type` harus 'saldo' atau 'pemakaian'" }, { status: 400 });
  }

  const dateFrom = sp.get("dateFrom") || firstDayThisMonth();
  const dateTo   = sp.get("dateTo")   || today();
  const q        = (sp.get("q") || "").trim();
  const itemId   = sp.get("itemId") ? Number(sp.get("itemId")) : null;
  const gudangId = sp.get("gudangId") ? Number(sp.get("gudangId")) : (sp.get("lokasi") ? Number(sp.get("lokasi")) : null);
  const format   = sp.get("format");
  const showZero = sp.get("showZero") === "1";

  try {
    if (type === "saldo") {
      const rows = await buildSaldo({ dateFrom, dateTo, q, itemId, gudangId });
      const filtered = showZero ? rows : rows.filter(x => x.awal + x.masuk + x.keluar + x.adj + x.akhir !== 0);

      // ------ PDF ------
      if (format === "pdf") {
        return respondPdf(
          <GudangSaldoPDF rows={filtered} meta={{ dateFrom, dateTo }} />,
          `laporan_gudang_saldo_${dateFrom}_${dateTo}.pdf`
        );
      }

      if (format === "csv") {
        const csv = toCSV(
          ["Kategori","Item Kode","Item Nama","Satuan","Awal","Masuk","Keluar","Penyesuaian","Akhir","MinQty"],
          filtered.map(r => [r.kategori ?? "", r.itemCode, r.itemName, r.satuan ?? "", r.awal, r.masuk, r.keluar, r.adj, r.akhir, r.minQty ?? ""])
        );
        return csvDownload(csv, `laporan_gudang_saldo_${dateFrom}_${dateTo}.csv`);
      }
      return NextResponse.json({ type, rows: filtered });
    }

    const rows = await buildPemakaian({ dateFrom, dateTo, q, itemId, gudangId });

    // ------ PDF ------
    if (format === "pdf") {
      return respondPdf(
        <GudangPemakaianPDF rows={rows} meta={{ dateFrom, dateTo }} />,
        `laporan_gudang_pemakaian_${dateFrom}_${dateTo}.pdf`
      );
    }

    if (format === "csv") {
      const csv = toCSV(
        ["Tanggal","Dokumen","Item Kode","Item Nama","Qty","Nilai (IDR)","Aset/WO"],
        rows.map(r => [r.tanggal, r.dokNo ?? "", r.itemCode, r.itemName, r.qty, r.nilai, r.asetWO ?? ""])
      );
      return csvDownload(csv, `laporan_gudang_pemakaian_${dateFrom}_${dateTo}.csv`);
    }
    return NextResponse.json({ type, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/* ===================== Core Builders ===================== */
/** SALDO: Awal = minQty master item */
async function buildSaldo(p: {
  dateFrom: string; dateTo: string; q: string; itemId: number | null; gudangId: number | null;
}): Promise<SaldoOutRow[]> {
  const { dateFrom, dateTo, q, itemId, gudangId } = p;

  // 1) Semua item (agar tabel awal langsung terisi)
  const itemWhere: any = {};
  if (q) itemWhere.OR = [{ kode: { contains: q } }, { nama: { contains: q } }];
  if (itemId) itemWhere.id = Number(itemId);

  // @ts-ignore
  const items = await prisma.item.findMany({
    where: itemWhere,
    select: {
      id: true,
      kode: true,
      nama: true,
      minQty: true,
      satuan: { select: { simbol: true} },
    },
    orderBy: { nama: "asc" },
  }) as unknown as ItemRec[];

  // 2) Mutasi dalam periode
  const whereInRange: any = {
    header: { tanggal: { gte: new Date(`${dateFrom}T00:00:00`), lte: new Date(`${dateTo}T23:59:59`) } },
  };
  if (itemId) whereInRange.itemId = Number(itemId);

  // @ts-ignore
  const lines = await prisma.stokTransaksiLine.findMany({
    where: whereInRange,
    orderBy: [{ header: { tanggal: "asc" } }, { id: "asc" }],
    select: {
      itemId: true,
      qty: true,
      hargaRp: true,
      catatan: true,
      item: { select: { kode: true, nama: true } },
      header: { select: { tipe: true, gudangAsalId: true, gudangTujuanId: true } },
    },
  }) as unknown as LineRec[];

  const gudangMatch = (l: LineRec): boolean => {
    if (!gudangId) return true;
    const t = String(l.header.tipe || "").toUpperCase();
    const ga = l.header.gudangAsalId ?? null;
    const gt = l.header.gudangTujuanId ?? null;
    const sign = mutasiSign(l.header.tipe, l.catatan);
    const masuk  = t === "RECEIPT" || (t === "ADJUSTMENT" && sign > 0);
    const keluar = t === "ISSUE"   || (t === "ADJUSTMENT" && sign < 0);
    if (ga == null && gt == null) return true;
    if (masuk && gt === gudangId) return true;
    if (keluar && ga === gudangId) return true;
    if (t === "ADJUSTMENT" && (ga === gudangId || gt === gudangId)) return true;
    return false;
  };

  // 3) Inisialisasi hasil per item dengan Awal = minQty
  type Agg = { awal: number; masuk: number; keluar: number; adj: number; };
  const map = new Map<number, Agg>();
  for (const it of items) {
    map.set(it.id, { awal: toNum(it.minQty), masuk: 0, keluar: 0, adj: 0 });
  }

  // 4) Akumulasikan mutasi periode
  for (const l of lines) {
    if (!map.has(l.itemId)) continue; // item tak lolos filter
    if (!gudangMatch(l)) continue;

    const agg = map.get(l.itemId)!;
    const qty = toNum(l.qty);
    const t = (l.header.tipe || "").toUpperCase();
    const sign = mutasiSign(l.header.tipe, l.catatan);

    if (t === "RECEIPT") agg.masuk += qty;
    else if (t === "ISSUE") agg.keluar += qty;
    else if (t === "ADJUSTMENT") {
      if (sign >= 0) agg.masuk += qty;
      else agg.keluar += qty;
      agg.adj += sign >= 0 ? qty : -qty; // info kolom
    }
  }

  // 5) Output
  const out: SaldoOutRow[] = items.map((it) => {
    const a = map.get(it.id)!;
    const akhir = a.awal + a.masuk - a.keluar;
    return {
      kategori: null,
      itemCode: it.kode || "",
      itemName: it.nama || "",
      satuan: it.satuan?.simbol ?? null,
      awal: round(a.awal),
      masuk: round(a.masuk),
      keluar: round(a.keluar),
      adj: round(a.adj),
      akhir: round(akhir),
      minQty: toNum(it.minQty),
    };
  });

  return out;
}

/** PEMAKAIAN: OUT pada periode */
async function buildPemakaian(p: {
  dateFrom: string; dateTo: string; q: string; itemId: number | null; gudangId: number | null;
}): Promise<PemakaianOutRow[]> {
  const { dateFrom, dateTo, q, itemId, gudangId } = p;

  const where: any = {
    header: { tanggal: { gte: new Date(`${dateFrom}T00:00:00`), lte: new Date(`${dateTo}T23:59:59`) }, tipe: "ISSUE" },
  };
  if (itemId) where.itemId = itemId;

  // @ts-ignore
  const lines = await prisma.stokTransaksiLine.findMany({
    where,
    orderBy: [{ header: { tanggal: "asc" } }, { id: "asc" }],
    select: {
      qty: true,
      hargaRp: true,
      item: { select: { kode: true, nama: true } },
      header: { select: { nomor: true, tanggal: true, gudangAsalId: true } },
    },
  }) as unknown as IssueLineRec[];

  const filtered = lines.filter(l => !gudangId || (l.header.gudangAsalId ?? null) === gudangId);

  return filtered
    .filter(l => {
      if (!q) return true;
      const code = (l.item?.kode || "").toLowerCase();
      const name = (l.item?.nama || "").toLowerCase();
      const qq = q.toLowerCase();
      return code.includes(qq) || name.includes(qq);
    })
    .map(l => ({
      tanggal: l.header.tanggal ? l.header.tanggal.toISOString() : new Date().toISOString(),
      dokNo: l.header.nomor ?? null,
      itemCode: l.item?.kode ?? "",
      itemName: l.item?.nama ?? "",
      qty: toNum(l.qty),
      nilai: toNum(l.hargaRp) * toNum(l.qty),
      asetWO: null,
    }));
}

/* ===================== PDF Components ===================== */
const pdfStyles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, flexDirection: "column" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  subtitle: { fontSize: 10, marginBottom: 10, color: "#333" },
  row: { flexDirection: "row" },
  th: { fontWeight: 700, padding: 6, borderBottom: 1, borderColor: "#CCC", backgroundColor: "#F5F5F5" },
  td: { padding: 6, borderBottom: 1, borderColor: "#EEE" },
  right: { textAlign: "right" as const },
  center: { textAlign: "center" as const },
  // column widths
  cItem: { width: "28%" },
  cSat: { width: "8%" },
  cNum: { width: "9%" },
});

function nf(n: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n ?? 0); }
function idr(n: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n ?? 0); }

function GudangSaldoPDF({ rows, meta }: { rows: SaldoOutRow[]; meta: { dateFrom: string; dateTo: string } }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Laporan Gudang — Saldo Stok</Text>
        <Text style={pdfStyles.subtitle}>Periode: {meta.dateFrom} – {meta.dateTo}</Text>

        <View style={pdfStyles.row}>
          <Text style={[pdfStyles.th, pdfStyles.cItem]}>Item</Text>
          <Text style={[pdfStyles.th, pdfStyles.cSat, pdfStyles.center]}>Satuan</Text>
          <Text style={[pdfStyles.th, pdfStyles.cNum, pdfStyles.right]}>Awal</Text>
          <Text style={[pdfStyles.th, pdfStyles.cNum, pdfStyles.right]}>Masuk</Text>
          <Text style={[pdfStyles.th, pdfStyles.cNum, pdfStyles.right]}>Keluar</Text>
          <Text style={[pdfStyles.th, pdfStyles.cNum, pdfStyles.right]}>Penyesuaian</Text>
          <Text style={[pdfStyles.th, pdfStyles.cNum, pdfStyles.right]}>Akhir</Text>
          <Text style={[pdfStyles.th, pdfStyles.cNum, pdfStyles.right]}>Min-Qty</Text>
        </View>

        {rows.map((r, i) => (
          <View key={i} style={pdfStyles.row}>
            <Text style={[pdfStyles.td, pdfStyles.cItem]}>{r.itemCode} — {r.itemName}</Text>
            <Text style={[pdfStyles.td, pdfStyles.cSat, pdfStyles.center]}>{r.satuan ?? "-"}</Text>
            <Text style={[pdfStyles.td, pdfStyles.cNum, pdfStyles.right]}>{nf(r.awal)}</Text>
            <Text style={[pdfStyles.td, pdfStyles.cNum, pdfStyles.right]}>{nf(r.masuk)}</Text>
            <Text style={[pdfStyles.td, pdfStyles.cNum, pdfStyles.right]}>{nf(r.keluar)}</Text>
            <Text style={[pdfStyles.td, pdfStyles.cNum, pdfStyles.right]}>{nf(r.adj)}</Text>
            <Text style={[pdfStyles.td, pdfStyles.cNum, pdfStyles.right]}>{nf(r.akhir)}</Text>
            <Text style={[pdfStyles.td, pdfStyles.cNum, pdfStyles.right]}>{r.minQty ?? "-"}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

function GudangPemakaianPDF({ rows, meta }: { rows: PemakaianOutRow[]; meta: { dateFrom: string; dateTo: string } }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Laporan Gudang — Pemakaian ke Aset/WO</Text>
        <Text style={pdfStyles.subtitle}>Periode: {meta.dateFrom} – {meta.dateTo}</Text>

        <View style={pdfStyles.row}>
          <Text style={[pdfStyles.th, { width: "12%" }]}>Tanggal</Text>
          <Text style={[pdfStyles.th, { width: "12%" }]}>Dokumen</Text>
          <Text style={[pdfStyles.th, { width: "36%" }]}>Item</Text>
          <Text style={[pdfStyles.th, { width: "10%" }, pdfStyles.right]}>QTY</Text>
          <Text style={[pdfStyles.th, { width: "15%" }, pdfStyles.right]}>Nilai (IDR)</Text>
          <Text style={[pdfStyles.th, { width: "15%" }]}>Aset/WO</Text>
        </View>

        {rows.map((r, i) => (
          <View key={i} style={pdfStyles.row}>
            <Text style={[pdfStyles.td, { width: "12%" }]}>{r.tanggal.slice(0,10)}</Text>
            <Text style={[pdfStyles.td, { width: "12%" }]}>{r.dokNo ?? "-"}</Text>
            <Text style={[pdfStyles.td, { width: "36%" }]}>{r.itemCode} — {r.itemName}</Text>
            <Text style={[pdfStyles.td, { width: "10%" }, pdfStyles.right]}>{nf(r.qty)}</Text>
            <Text style={[pdfStyles.td, { width: "15%" }, pdfStyles.right]}>{idr(r.nilai)}</Text>
            <Text style={[pdfStyles.td, { width: "15%" }]}>{r.asetWO ?? "-"}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

/* ===================== Utils ===================== */
function toNum(v: unknown): number { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; }
function round(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }
function today(): string { return new Date().toISOString().slice(0, 10); }
function firstDayThisMonth(): string { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function toCSV(header: string[], rows: (string | number | null)[][]): string {
  const h = header.join(","); const b = rows.map(r => r.map(x => `${x ?? ""}`).join(",")).join("\n"); return `${h}\n${b}`;
}
function csvDownload(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
function mutasiSign(tipe?: string | null, catatan?: string | null): number {
  const t = (tipe || "").toUpperCase();
  if (t === "RECEIPT") return 1;
  if (t === "ISSUE") return -1;
  if (t === "ADJUSTMENT") return catatan && /-\s*$|adjustment\s*-/i.test(catatan) ? -1 : 1;
  return 0;
}
async function respondPdf(jsx: React.ReactElement, filename: string) {
  // buat instance PDF, inject <Document />
  const inst = pdf();
  inst.updateContainer(jsx as any);

  // pakai Buffer (Node) / Uint8Array (Edge) – aman untuk Response
  const buffer = (await inst.toBuffer()) as unknown as Uint8Array;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
