// app/components/LaporanPDF.tsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/* ===================== Types ===================== */
export type SummaryRow = { status: string; jumlah: number; totalBiaya: number };

export interface LaporanPDFMeta {
  generatedAt: string;
  generatedBy: string;
  totalAset: number;
  totalPemeliharaan: number;
  periodeLabel: string;
  organisasi: string;
  filterStatus?: string;
  filterStrategi?: string;
  filterKategori?: string;
}

/** —— Detail Aset (sesuai UI detail aset) —— */
export interface AssetDetail {
  nia: string;
  nama: string;
  kategori?: string;
  kondisi?: string;
  lokasi?: string;
  tahunPerolehan?: number | string;
  nilaiPerolehan?: number;
  createdAt?: string; // ISO
  updatedAt?: string; // ISO
}

/** —— Penyusutan (sesuai UI card penyusutan) —— */
export interface PenyusutanDetail {
  metode?: string; // SALDO_MENURUN / GARIS_LURUS / dst
  nilaiBuku?: number;
  akumulasi?: number;
  mulai?: number | string;
  umurTahun?: number;
  nilaiResidu?: number;
}

/** —— Agregat untuk tabel ringkasan per kategori —— */
export interface AsetRingkasan {
  totalNilai?: number;
  perKategori?: Array<{ kategori: string; jumlah: number; totalNilai?: number }>;
}
export interface PenyusutanRingkasan {
  perKategori?: Array<{ kategori: string; akumulasi: number; nilaiBuku: number }>;
}
export interface PemeliharaanAggregates {
  status?: Array<{ status: string; jumlah: number; totalBiaya: number }>;
  strategi?: Array<{ strategi: string; jumlah: number; totalBiaya: number }>;
  downtime?: { totalJam: number; rataJam: number };
  biayaBreakdown?: { material: number; jasa: number; lainnya?: number };
  perKategori?: Array<{ kategori: string; jumlah: number; totalBiaya: number }>;
}

/** —— Detail Pemeliharaan (kartu + suku cadang) —— */
export interface SukuCadangItem {
  nama: string;
  qty: number;
  satuan: string;
  harga: number; // harga satuan
  subtotal?: number; // fallback: qty*harga
}
export interface PemeliharaanDetail {
  tanggal?: string; // ISO
  jenisKegiatan?: string;
  pelaksana?: string;
  catatan?: string;

  // Teknis
  strategi?: string;
  jenisPekerjaan?: string;
  downtimeJam?: number;
  biayaMaterial?: number;
  biayaJasa?: number;
  subtotalMaterialJasa?: number;

  sukuCadang?: SukuCadangItem[];
}

/** —— Tabel ringkas kegiatan (opsional) —— */
export type DetailRow = {
  tanggal: string; // ISO
  nia: string;
  nama: string;
  jenis: string;
  status: string;
  pelaksana: string;
  biaya: number;
};

export interface LaporanPDFProps {
  summary: SummaryRow[];
  totalBiaya: number;
  meta: LaporanPDFMeta;

  // blok opsional (muncul hanya jika diisi)
  assetDetail?: AssetDetail;
  penyusutanDetail?: PenyusutanDetail;
  asetRingkasan?: AsetRingkasan;
  penyusutan?: PenyusutanRingkasan;
  maintAgg?: PemeliharaanAggregates;

  sukuCadangAgg?: Array<{ nama: string; qty: number; satuan: string; total: number }>;
  pemeliharaanDetail?: PemeliharaanDetail;
  details?: DetailRow[];
}

/* ===================== Helpers ===================== */
const toIDR = (n?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("id-ID") : "—");
const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("id-ID") : "—");
const sum = (arr: number[]) => arr.reduce((s, v) => s + (isFinite(v) ? v : 0), 0);
const pct = (x: number, total: number) => (total > 0 ? Math.round((x / total) * 100) : 0);

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: "#222" },

  header: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 8, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: "bold" },
  subtitle: { fontSize: 11, marginTop: 2 },
  metaLine: { fontSize: 10, color: "#374151", marginTop: 2 },

  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, gap: 6 as any },
  chip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 9,
  },

  section: { marginTop: 14 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 6 },

  card: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, backgroundColor: "#fff" },
  row: { flexDirection: "row" },
  col: { flexGrow: 1, flexBasis: 0, padding: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  kv: { flexDirection: "row", marginBottom: 4 },
  k: { width: 110, color: "#6B7280" },
  v: { flexGrow: 1, color: "#111827" },

  kpiRow: { flexDirection: "row", gap: 8 as any },
  kpi: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, backgroundColor: "#fff" },
  kpiBox: { padding: 10 },
  kpiLabel: { fontSize: 9, color: "#6B7280" },
  kpiValue: { fontSize: 14, fontWeight: "bold", marginTop: 2 },

  // grid 2 kolom untuk kartu detail pemeliharaan
  grid2: { flexDirection: "row" },
  colHalf: { flexGrow: 1, flexBasis: 0, padding: 10 },
  colSeparator: { borderLeftWidth: 1, borderLeftColor: "#F3F4F6" },

  table: { width: "100%", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  th: { paddingVertical: 6, paddingHorizontal: 8, fontSize: 9, fontWeight: "bold", color: "#374151" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  td: { paddingVertical: 6, paddingHorizontal: 8, fontSize: 9 },

  w8: { width: "8%" },
  w10: { width: "10%" },
  w12: { width: "12%" },
  w14: { width: "14%" },
  w16: { width: "16%" },
  w18: { width: "18%" },
  w20: { width: "20%" },
  w22: { width: "22%" },
  w24: { width: "24%" },
  w26: { width: "26%" },
  w28: { width: "28%" },
  w30: { width: "30%" },
  w34: { width: "34%" },
  w40: { width: "40%" },

  note: { fontSize: 8, color: "#6B7280", marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#6B7280",
    fontSize: 9,
  },
});

/* ===================== Component ===================== */
export default function LaporanPDF({
  summary,
  totalBiaya,
  meta,
  assetDetail,
  penyusutanDetail,
  asetRingkasan,
  penyusutan,
  maintAgg,
  sukuCadangAgg,
  pemeliharaanDetail,
  details,
}: LaporanPDFProps) {
  const {
    generatedAt,
    generatedBy,
    totalAset,
    totalPemeliharaan,
    periodeLabel,
    organisasi,
    filterStatus,
    filterStrategi,
    filterKategori,
  } = meta;

  // angka-angka pendukung
  const totalKegiatan = sum(summary.map((s) => s.jumlah));
  const selesai = summary.find((s) => s.status === "Selesai")?.jumlah ?? 0;
  const completion = pct(selesai, totalKegiatan);

  // ringkas per-kategori (nilai/akumulasi/nilai buku/biaya)
  const invPerKategori = (() => {
    const aset = asetRingkasan?.perKategori || [];
    const susut = penyusutan?.perKategori || [];
    const pem = maintAgg?.perKategori || [];

    const map = new Map<
      string,
      { kategori: string; jumlah: number; nilai: number; akumulasi: number; nilaiBuku: number; biaya: number }
    >();

    for (const a of aset) {
      const k = a.kategori;
      if (!map.has(k)) map.set(k, { kategori: k, jumlah: 0, nilai: 0, akumulasi: 0, nilaiBuku: 0, biaya: 0 });
      const m = map.get(k)!;
      m.jumlah += a.jumlah || 0;
      m.nilai += a.totalNilai || 0;
    }
    for (const s of susut) {
      const k = s.kategori;
      if (!map.has(k)) map.set(k, { kategori: k, jumlah: 0, nilai: 0, akumulasi: 0, nilaiBuku: 0, biaya: 0 });
      const m = map.get(k)!;
      m.akumulasi += s.akumulasi || 0;
      m.nilaiBuku += s.nilaiBuku || 0;
    }
    for (const b of pem) {
      const k = b.kategori;
      if (!map.has(k)) map.set(k, { kategori: k, jumlah: 0, nilai: 0, akumulasi: 0, nilaiBuku: 0, biaya: 0 });
      const m = map.get(k)!;
      m.biaya += b.totalBiaya || 0;
    }

    const rows = Array.from(map.values()).sort((a, b) => a.kategori.localeCompare(b.kategori));
    const totals = {
      jumlah: sum(rows.map((r) => r.jumlah)),
      nilai: sum(rows.map((r) => r.nilai)),
      akumulasi: sum(rows.map((r) => r.akumulasi)),
      nilaiBuku: sum(rows.map((r) => r.nilaiBuku)),
      biaya: sum(rows.map((r) => r.biaya)),
    };
    return { rows, totals };
  })();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ===== Header ===== */}
        <View style={styles.header}>
          <Text style={styles.title}>Laporan Menyeluruh — {organisasi}</Text>
          <Text style={styles.subtitle}>Periode: {periodeLabel}</Text>
          <Text style={styles.metaLine}>Dibuat: {fmtDateTime(generatedAt)} • Disusun oleh: {generatedBy}</Text>
          {(filterStatus || filterStrategi || filterKategori) && (
            <View style={styles.chips}>
              {filterStatus && <Text style={styles.chip}>Status: {filterStatus}</Text>}
              {filterStrategi && <Text style={styles.chip}>Strategi: {filterStrategi}</Text>}
              {filterKategori && <Text style={styles.chip}>Kategori Aset: {filterKategori}</Text>}
            </View>
          )}
        </View>

        {/* ===== Detail Aset ===== */}
        {assetDetail && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detail Aset</Text>
            <View style={styles.card}>
              <View style={[styles.col, { borderBottomWidth: 0 }]}>
                <Text style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>{assetDetail.nama}</Text>
                <View style={styles.kv}>
                  <Text style={styles.k}>NIA</Text>
                  <Text style={styles.v}>{assetDetail.nia}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Kategori</Text>
                  <Text style={styles.v}>{assetDetail.kategori || "—"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Kondisi</Text>
                  <Text style={styles.v}>{assetDetail.kondisi || "—"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Lokasi</Text>
                  <Text style={styles.v}>{assetDetail.lokasi || "—"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Tahun Perolehan</Text>
                  <Text style={styles.v}>{assetDetail.tahunPerolehan ?? "—"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Nilai Perolehan</Text>
                  <Text style={styles.v}>{toIDR(assetDetail.nilaiPerolehan)}</Text>
                </View>
                {(assetDetail.createdAt || assetDetail.updatedAt) && (
                  <View style={styles.kv}>
                    <Text style={styles.k}>Riwayat</Text>
                    <Text style={styles.v}>
                      Dibuat: {fmtDateTime(assetDetail.createdAt)} • Diubah: {fmtDateTime(assetDetail.updatedAt)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ===== Penyusutan Aset ===== */}
        {penyusutanDetail && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Penyusutan Aset</Text>
            <View style={styles.kpiRow}>
              <View style={styles.kpi}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiLabel}>Metode</Text>
                  <Text style={styles.kpiValue}>{penyusutanDetail.metode || "—"}</Text>
                </View>
              </View>
              <View style={styles.kpi}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiLabel}>Nilai Buku</Text>
                  <Text style={styles.kpiValue}>{toIDR(penyusutanDetail.nilaiBuku)}</Text>
                </View>
              </View>
              <View style={styles.kpi}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiLabel}>Akumulasi</Text>
                  <Text style={styles.kpiValue}>{toIDR(penyusutanDetail.akumulasi)}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.kpiRow, { marginTop: 8 }]}>
              <View style={styles.kpi}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiLabel}>Mulai</Text>
                  <Text style={styles.kpiValue}>{penyusutanDetail.mulai ?? "—"}</Text>
                </View>
              </View>
              <View style={styles.kpi}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiLabel}>Umur (thn)</Text>
                  <Text style={styles.kpiValue}>{penyusutanDetail.umurTahun ?? "—"}</Text>
                </View>
              </View>
              <View style={styles.kpi}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiLabel}>Nilai Residu</Text>
                  <Text style={styles.kpiValue}>{toIDR(penyusutanDetail.nilaiResidu)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ===== Inventarisasi Aset — Ringkasan per Kategori ===== */}
        {invPerKategori.rows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inventarisasi Aset — Ringkas per Kategori</Text>
            <View style={styles.table}>
              <View style={styles.thead} fixed>
                <Text style={[styles.th, styles.w26]}>Kategori Aset</Text>
                <Text style={[styles.th, styles.w10]}>Jumlah</Text>
                <Text style={[styles.th, styles.w16]}>Nilai Aset</Text>
                <Text style={[styles.th, styles.w16]}>Akumulasi Penyusutan</Text>
                <Text style={[styles.th, styles.w16]}>Nilai Buku</Text>
                <Text style={[styles.th, styles.w16]}>Total Biaya</Text>
                <Text style={[styles.th, styles.w10]}>% Nilai</Text>
                <Text style={[styles.th, styles.w10]}>% Biaya</Text>
              </View>

              {(() => {
                const totalNilai = invPerKategori.totals.nilai || 0;
                const totalBiayaPK = invPerKategori.totals.biaya || 0;

                return (
                  <>
                    {invPerKategori.rows.map((r, i) => (
                      <View key={r.kategori + i} style={styles.tr}>
                        <Text style={[styles.td, styles.w26]}>{r.kategori}</Text>
                        <Text style={[styles.td, styles.w10]}>{r.jumlah.toLocaleString("id-ID")}</Text>
                        <Text style={[styles.td, styles.w16]}>{toIDR(r.nilai)}</Text>
                        <Text style={[styles.td, styles.w16]}>{r.akumulasi ? toIDR(r.akumulasi) : "—"}</Text>
                        <Text style={[styles.td, styles.w16]}>{r.nilaiBuku ? toIDR(r.nilaiBuku) : "—"}</Text>
                        <Text style={[styles.td, styles.w16]}>{r.biaya ? toIDR(r.biaya) : "—"}</Text>
                        <Text style={[styles.td, styles.w10]}>{pct(r.nilai, totalNilai)}%</Text>
                        <Text style={[styles.td, styles.w10]}>{pct(r.biaya, totalBiayaPK)}%</Text>
                      </View>
                    ))}
                    <View style={[styles.tr, { backgroundColor: "#FAFAFA" }]}>
                      <Text style={[styles.td, styles.w26, { fontWeight: "bold" }]}>Total</Text>
                      <Text style={[styles.td, styles.w10, { fontWeight: "bold" }]}>
                        {invPerKategori.totals.jumlah.toLocaleString("id-ID")}
                      </Text>
                      <Text style={[styles.td, styles.w16, { fontWeight: "bold" }]}>{toIDR(invPerKategori.totals.nilai)}</Text>
                      <Text style={[styles.td, styles.w16, { fontWeight: "bold" }]}>
                        {invPerKategori.totals.akumulasi ? toIDR(invPerKategori.totals.akumulasi) : "—"}
                      </Text>
                      <Text style={[styles.td, styles.w16, { fontWeight: "bold" }]}>
                        {invPerKategori.totals.nilaiBuku ? toIDR(invPerKategori.totals.nilaiBuku) : "—"}
                      </Text>
                      <Text style={[styles.td, styles.w16, { fontWeight: "bold" }]}>
                        {invPerKategori.totals.biaya ? toIDR(invPerKategori.totals.biaya) : "—"}
                      </Text>
                      <Text style={[styles.td, styles.w10, { fontWeight: "bold" }]}>100%</Text>
                      <Text style={[styles.td, styles.w10, { fontWeight: "bold" }]}>
                        {invPerKategori.totals.biaya ? "100%" : "0%"}
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        )}

        {/* ===== Pemeliharaan — Ringkasan Status ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pemeliharaan</Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Total Pemeliharaan</Text>
                <Text style={styles.kpiValue}>{totalPemeliharaan.toLocaleString("id-ID")}</Text>
              </View>
            </View>
            <View style={styles.kpi}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Total Biaya</Text>
                <Text style={styles.kpiValue}>{toIDR(totalBiaya)}</Text>
              </View>
            </View>
            <View style={styles.kpi}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Completion Rate</Text>
                <Text style={styles.kpiValue}>{completion}%</Text>
              </View>
            </View>
          </View>

          <View style={[styles.table, { marginTop: 8 }]}>
            <View style={styles.thead} fixed>
              <Text style={[styles.th, styles.w28]}>Status</Text>
              <Text style={[styles.th, styles.w12]}>Jumlah</Text>
              <Text style={[styles.th, styles.w20]}>Total Biaya</Text>
              <Text style={[styles.th, styles.w12]}>% Kontribusi</Text>
            </View>
            {summary.map((r, i) => (
              <View key={r.status + i} style={styles.tr}>
                <Text style={[styles.td, styles.w28]}>{r.status}</Text>
                <Text style={[styles.td, styles.w12]}>{r.jumlah.toLocaleString("id-ID")}</Text>
                <Text style={[styles.td, styles.w20]}>{toIDR(r.totalBiaya)}</Text>
                <Text style={[styles.td, styles.w12]}>{pct(r.totalBiaya, totalBiaya)}%</Text>
              </View>
            ))}
            <View style={[styles.tr, { backgroundColor: "#FAFAFA" }]}>
              <Text style={[styles.td, styles.w28, { fontWeight: "bold" }]}>Total</Text>
              <Text style={[styles.td, styles.w12, { fontWeight: "bold" }]}>{totalKegiatan.toLocaleString("id-ID")}</Text>
              <Text style={[styles.td, styles.w20, { fontWeight: "bold" }]}>{toIDR(totalBiaya)}</Text>
              <Text style={[styles.td, styles.w12, { fontWeight: "bold" }]}>100%</Text>
            </View>
          </View>

          
        </View>

        {/* ===== Suku Cadang (Agregat) ===== */}
        {sukuCadangAgg && sukuCadangAgg.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suku Cadang (Agregat)</Text>
            <View style={styles.table}>
              <View style={styles.thead} fixed>
                <Text style={[styles.th, styles.w40]}>Nama</Text>
                <Text style={[styles.th, styles.w14]}>Qty</Text>
                <Text style={[styles.th, styles.w14]}>Satuan</Text>
                <Text style={[styles.th, styles.w20]}>Total</Text>
              </View>
              {sukuCadangAgg.map((r, i) => (
                <View key={r.nama + i} style={styles.tr}>
                  <Text style={[styles.td, styles.w40]}>{r.nama}</Text>
                  <Text style={[styles.td, styles.w14]}>{r.qty.toLocaleString("id-ID")}</Text>
                  <Text style={[styles.td, styles.w14]}>{r.satuan}</Text>
                  <Text style={[styles.td, styles.w20]}>{toIDR(r.total)}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>* Total = akumulasi (qty × harga) di seluruh pekerjaan pada periode.</Text>
          </View>
        )}

        {/* ===== Detail Pemeliharaan (Ringkas) ===== */}
        {details && details.length > 0 && (
          <View style={styles.section} wrap>
            <Text style={styles.sectionTitle}>Detail Pemeliharaan (Ringkas)</Text>
            <View style={styles.table}>
              <View style={styles.thead} fixed>
                <Text style={[styles.th, styles.w12]}>Tanggal</Text>
                <Text style={[styles.th, styles.w12]}>NIA</Text>
                <Text style={[styles.th, styles.w18]}>Nama Aset</Text>
                <Text style={[styles.th, styles.w14]}>Jenis</Text>
                <Text style={[styles.th, styles.w12]}>Status</Text>
                <Text style={[styles.th, styles.w12]}>Pelaksana</Text>
                <Text style={[styles.th, styles.w10]}>Biaya</Text>
              </View>
              {details.map((d, i) => (
                <View key={`${d.nia}-${i}`} style={styles.tr} wrap={false}>
                  <Text style={[styles.td, styles.w12]}>{fmtDate(d.tanggal)}</Text>
                  <Text style={[styles.td, styles.w12]}>{d.nia}</Text>
                  <Text style={[styles.td, styles.w18]}>{d.nama}</Text>
                  <Text style={[styles.td, styles.w14]}>{d.jenis}</Text>
                  <Text style={[styles.td, styles.w12]}>{d.status}</Text>
                  <Text style={[styles.td, styles.w12]}>{d.pelaksana}</Text>
                  <Text style={[styles.td, styles.w10]}>{toIDR(d.biaya)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ===== Footer ===== */}
        <View style={styles.footer} fixed>
          <Text>
            {organisasi} • {periodeLabel}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
