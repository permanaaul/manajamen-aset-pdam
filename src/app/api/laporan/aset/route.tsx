// app/api/laporan/aset/route.tsx
import React from "react";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

/* ======================================================
   Runtime & caching
====================================================== */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ======================================================
   Helpers
====================================================== */
const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const num = (n: number) => new Intl.NumberFormat("id-ID").format(n ?? 0);
const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n ?? 0);

const get = (obj: any, keys: string[], d?: any) => {
  for (const k of keys) if (obj && obj[k] != null) return obj[k];
  return d;
};

function endOfMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59);
}

async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fb;
  }
}

function toCSV(header: string[], rows: (string | number)[][]) {
  const h = header.join(",");
  const b = rows.map((r) => r.map((x) => `${x ?? ""}`).join(",")).join("\n");
  return `${h}\n${b}`;
}

function csvDownload(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/* ======================================================
   PDF components
====================================================== */
const styles = StyleSheet.create({
    page: { padding: 24, fontSize: 10, color: "#111827" },
    h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
    sub: { fontSize: 10, color: "#4B5563", marginBottom: 10 },
    row: { flexDirection: "row" },
    card: {
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "#E5E7EB",
      borderRadius: 6,
      padding: 8,
      marginRight: 6,
      marginBottom: 6,
      minWidth: 120,
    },
    label: { fontSize: 8, color: "#6B7280" },
    value: { fontSize: 12, fontWeight: 700 },
  
    // ⬇️ perbaikan utama di sini
    table: {
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "#E5E7EB",
      borderRadius: 6,
    },
    thead: { backgroundColor: "#F3F4F6" },
    tr: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#E5E7EB",
      borderStyle: "solid",
    },
    th: {
      padding: 6,
      borderRightWidth: 1,
      borderRightColor: "#E5E7EB",
      borderStyle: "solid",
      fontSize: 9,
      fontWeight: 700,
    },
    td: {
      padding: 6,
      borderRightWidth: 1,
      borderRightColor: "#E5E7EB",
      borderStyle: "solid",
      fontSize: 9,
    },
    right: { textAlign: "right" },
  });
  

function AsetPDF({
  period,
  rows,
  total,
}: {
  period: string;
  rows: Array<{
    kategori: string;
    lokasi: string | null;
    kode: string;
    nama: string;
    qty: number;
    perolehan: number;
    akum: number;
    nb: number;
    nbShare: number;
  }>;
  total: { qty: number; perolehan: number; akum: number; nb: number };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Laporan Aset</Text>
        <Text style={styles.sub}>
          Rekap jumlah, perolehan, akumulasi penyusutan, dan nilai buku — per kategori → lokasi → aset. · Periode:{" "}
          {period || "-"} · Dicetak: {new Date().toLocaleString("id-ID")}
        </Text>

        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.label}>Periode</Text>
            <Text style={styles.value}>{period}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Total QTY</Text>
            <Text style={styles.value}>{num(total.qty)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Total Perolehan</Text>
            <Text style={styles.value}>{idr(total.perolehan)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Total Nilai Buku</Text>
            <Text style={styles.value}>{idr(total.nb)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.th, { width: 90 }]}>Kategori</Text>
            <Text style={[styles.th, { width: 80 }]}>Lokasi</Text>
            <Text style={[styles.th, { width: 70 }]}>Kode</Text>
            <Text style={[styles.th, { flex: 1 }]}>Nama Aset</Text>
            <Text style={[styles.th, { width: 40 }, styles.right]}>Qty</Text>
            <Text style={[styles.th, { width: 90 }, styles.right]}>Perolehan</Text>
            <Text style={[styles.th, { width: 90 }, styles.right]}>Akumulasi</Text>
            <Text style={[styles.th, { width: 90 }, styles.right]}>Nilai Buku</Text>
            <Text style={[styles.th, { width: 50 }, styles.right]}>%</Text>
          </View>

          {rows.map((r, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <Text style={[styles.td, { width: 90 }]}>{r.kategori}</Text>
              <Text style={[styles.td, { width: 80 }]}>{r.lokasi ?? "-"}</Text>
              <Text style={[styles.td, { width: 70 }]}>{r.kode}</Text>
              <Text style={[styles.td, { flex: 1 }]}>{r.nama}</Text>
              <Text style={[styles.td, { width: 40 }, styles.right]}>{num(r.qty)}</Text>
              <Text style={[styles.td, { width: 90 }, styles.right]}>{idr(r.perolehan)}</Text>
              <Text style={[styles.td, { width: 90 }, styles.right]}>{idr(r.akum)}</Text>
              <Text style={[styles.td, { width: 90 }, styles.right]}>{idr(r.nb)}</Text>
              <Text style={[styles.td, { width: 50 }, styles.right]}>{num(r.nbShare)}%</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

/** Responder PDF robust → ArrayBuffer → NextResponse (aman untuk TS & semua runtime Node) */
async function respondPdf(jsx: React.ReactElement, filename: string) {
  try {
    const inst: any = pdf(); // JANGAN pdf(jsx). Pakai instance kosong dulu, hindari TS DocumentProps.
    inst.updateContainer(jsx as any);

    let arrayBuffer: ArrayBuffer;

    if (typeof inst.toBlob === "function") {
      const blob: Blob = await inst.toBlob();
      arrayBuffer = await blob.arrayBuffer();
    } else if (typeof inst.toBuffer === "function") {
      const buf: Uint8Array = await inst.toBuffer();
      arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } else if (typeof inst.toStream === "function") {
      const stream: NodeJS.ReadableStream = await inst.toStream();
      const chunks: Buffer[] = [];
      arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        stream.on("data", (c: Buffer) => chunks.push(c));
        stream.on("end", () => resolve(Buffer.concat(chunks).buffer));
        stream.on("error", reject);
      });
    } else {
      throw new Error("React-PDF instance has no toBlob/toBuffer/toStream");
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("PDF render error:", e?.stack || e);
    return NextResponse.json({ error: "Gagal membuat PDF", detail: String(e?.message || e) }, { status: 500 });
  }
}

/* ======================================================
   GET handler
====================================================== */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;

  const period = sp.get("period") || new Date().toISOString().slice(0, 7);
  const unit = (sp.get("unit") || "").trim();
  const lokasiQ = (sp.get("lokasi") || "").trim();
  const kategoriQ = (sp.get("kategori") || "").trim();
  const asetQ = (sp.get("aset") || "").trim();
  const showZero = sp.get("showZero") === "1";
  const format = (sp.get("format") || "").toLowerCase();
  const until = endOfMonth(period);

  // 1) Ambil semua aset tanpa select khusus agar aman ke berbagai skema
  // @ts-ignore
  const asetList = await safe(() => prisma.aset.findMany({ orderBy: { id: "asc" } }), [] as any[]);

  // Filter free-text aset di level JS
  const asetFiltered = asetList.filter((a: any) => {
    if (!asetQ) return true;
    const code = String(get(a, ["kode", "code", "kd", "noAset", "assetCode", "nomor"], "")).toLowerCase();
    const name = String(get(a, ["nama", "name", "assetName", "judul", "deskripsi"], "")).toLowerCase();
    const q = asetQ.toLowerCase();
    return code.includes(q) || name.includes(q);
  });

  const asetIds = asetFiltered.map((a: any) => a.id).filter(Boolean);

  // 2) Fallback perolehan: dari transaksi gudang ISSUE (asetId terisi)
  // @ts-ignore
  const issueLines = await safe(
    () =>
    //@ts-ignore
      prisma.stokTransaksiLine.findMany({
        where: {
          asetId: { in: asetIds.length ? asetIds : undefined },
          header: { tipe: "ISSUE", tanggal: { lte: until } },
        },
        select: { asetId: true, qty: true, hargaRp: true },
      }),
    [] as any[]
  );

  const perolehanGudang = new Map<number, number>();
  for (const l of issueLines) {
    const val = toNum(l.hargaRp) * toNum(l.qty);
    perolehanGudang.set(l.asetId, (perolehanGudang.get(l.asetId) || 0) + val);
  }

  // 3) Akumulasi penyusutan (opsional)
  // @ts-ignore
  const depLines = await safe(
    () =>
    //@ts-ignore
      prisma.penyusutanLine.findMany({
        where: {
          asetId: { in: asetIds.length ? asetIds : undefined },
          header: { tanggal: { lte: until }, status: "POSTED" },
        },
        select: { asetId: true, nominal: true, beban: true },
      }),
    [] as any[]
  );

  const akumByAset = new Map<number, number>();
  for (const d of depLines) {
    akumByAset.set(d.asetId, (akumByAset.get(d.asetId) || 0) + toNum(d.nominal ?? d.beban));
  }

  // 4) Build rows generik
  let rows = asetFiltered.map((a: any) => {
    const kode = get(a, ["kode", "code", "kd", "noAset", "assetCode", "nomor"], "") || "";
    const nama = get(a, ["nama", "name", "assetName", "judul", "deskripsi"], "") || "";
    const kategori =
      get(a, ["kategoriNama", "kategori", "kelompok"], null) ??
      get(a?.kategori || {}, ["nama", "name"], "-") ??
      "-";
    const lokasi = get(a, ["lokasiNama", "lokasi"], null) ?? get(a?.lokasi || {}, ["nama", "name"], null);

    const perolehanDirect = toNum(get(a, ["nilaiPerolehan", "hargaPerolehan", "hargaBeli", "harga", "nilai"], 0));
    const perolehan = perolehanDirect || perolehanGudang.get(a.id) || 0;
    const akum = akumByAset.get(a.id) || 0;
    const nb = Math.max(0, perolehan - akum);

    return {
      kategori,
      lokasi,
      kode,
      nama,
      qty: toNum(get(a, ["qty", "jumlah", "kuantitas"], 1)) || 1,
      perolehan,
      akum,
      nb,
      nbShare: 0,
    };
  });

  // filter tambahan
  if (kategoriQ) rows = rows.filter((r) => r.kategori?.toLowerCase().includes(kategoriQ.toLowerCase()));
  if (lokasiQ) rows = rows.filter((r) => (r.lokasi || "").toLowerCase().includes(lokasiQ.toLowerCase()));
  if (unit) {
    // jika ada konsep unit di schema kamu, filter di sini
  }
  if (!showZero) rows = rows.filter((r) => r.qty + r.perolehan + r.akum + r.nb !== 0);

  // total & komposisi
  const total = rows.reduce(
    (a, r) => ({
      qty: a.qty + r.qty,
      perolehan: a.perolehan + r.perolehan,
      akum: a.akum + r.akum,
      nb: a.nb + r.nb,
    }),
    { qty: 0, perolehan: 0, akum: 0, nb: 0 }
  );
  const base = total.nb || 1;
  rows = rows.map((r) => ({ ...r, nbShare: Math.round((r.nb / base) * 100) }));

  // --- Exporters ---
  const fileBase = `laporan_aset_${period}`;

  if (format === "csv") {
    const csv = toCSV(
      ["Kategori", "Lokasi", "Kode", "Nama Aset", "Qty", "Perolehan", "Akumulasi", "Nilai Buku", "% Komposisi"],
      rows.map((r) => [r.kategori, r.lokasi ?? "", r.kode, r.nama, r.qty, r.perolehan, r.akum, r.nb, r.nbShare])
    );
    return csvDownload(csv, `${fileBase}.csv`);
  }

  if (format === "pdf") {
    return respondPdf(<AsetPDF period={period} rows={rows} total={total} />, `${fileBase}.pdf`);
  }

  // default JSON
  return NextResponse.json({ period, rows, total });
}
