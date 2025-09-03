"use client";

import Link from "next/link";
import { Package, Layers, Wrench, Calculator, ChevronRight, FileDown, Filter } from "lucide-react";
import React from "react";

/* =====================================================
 * Index Laporan Manajemen Aset — Light UI (Putih Bersih)
 * - Background putih, teks hitam/abu gelap
 * - Grid 2×2 kartu laporan
 * - Kontras jelas namun tidak gelap
 * ===================================================== */

type ReportCard = {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  highlights: string[];
};

const REPORTS: ReportCard[] = [
  {
    href: "/laporan/gudang",
    title: "Laporan Gudang",
    subtitle: "Saldo stok & pemakaian ke aset/pekerjaan",
    icon: Package,
    highlights: [
      "Saldo: Awal, Masuk, Keluar, Penyesuaian, Akhir",
      "Peringatan Min-Qty (stok di bawah batas)",
      "Pemakaian per Aset/WO (QTY & Nilai)",
      "Rekap nilai persediaan (IDR)"
    ]
  },
  {
    href: "/laporan/aset",
    title: "Laporan Aset",
    subtitle: "Jumlah & nilai buku per kategori dan lokasi/aset",
    icon: Layers,
    highlights: [
      "Jumlah unit & harga perolehan",
      "Akumulasi penyusutan",
      "Nilai buku & % komposisi",
      "Drill-down ke detail aset"
    ]
  },
  {
    href: "/laporan/pemeliharaan",
    title: "Laporan Pemeliharaan",
    subtitle: "Biaya, frekuensi, downtime, dan indikator",
    icon: Wrench,
    highlights: [
      "Jumlah WO & total biaya",
      "Rata biaya per WO",
      "Downtime (MTTR/MTBF)",
      "Top 5 biaya per aset/kategori"
    ]
  },
  {
    href: "/laporan/penyusutan",
    title: "Laporan Penyusutan",
    subtitle: "Beban periode, akumulasi, nilai buku akhir",
    icon: Calculator,
    highlights: [
      "Beban penyusutan periode",
      "Akumulasi hingga periode berjalan",
      "Nilai buku akhir per aset",
      "Status Posted / Unposted"
    ]
  }
];

export default function LaporanIndexPage() {
  return (
    <main className="p-6 md:p-10 bg-white text-gray-900 min-h-screen">
      {/* Header */}
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Laporan Manajemen Aset</h1>
        <p className="text-base md:text-lg text-gray-600 mt-2 max-w-4xl leading-relaxed">
          Pilih jenis laporan yang tersedia di bawah ini. Setiap laporan memiliki filter standar
          (<span className="font-semibold">Periode, Unit, Lokasi, Kategori, Aset</span>, opsi <span className="font-semibold">Show Zero</span>)
          serta dukungan ekspor ke <span className="font-semibold">PDF</span> dan <span className="font-semibold">CSV</span>.
          Grafik hanya ditampilkan di aplikasi; PDF menampilkan ringkasan dan tabel formal.
        </p>
      </header>

      {/* Grid 2×2 */}
      <section className="grid gap-8 grid-cols-1 md:grid-cols-2">
        {REPORTS.map((r) => (
          <ReportLinkCard key={r.href} {...r} />
        ))}
      </section>

      {/* Catatan standar PDF */}
      <section className="mt-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg md:text-xl font-semibold">Standar Output PDF</h2>
          <ul className="mt-3 text-sm md:text-base text-gray-700 space-y-2 list-disc pl-6">
            <li>A4; Portrait untuk laporan ringkas, Landscape untuk tabel lebar.</li>
            <li>Header resmi: Logo, Judul, Periode, Waktu cetak.</li>
            <li>Angka IDR 2 desimal, pemisah ribuan; Tanggal format dd/mm/yyyy.</li>
            <li>Header tabel otomatis terulang di setiap halaman.</li>
            <li>Ringkasan 5–6 baris sebelum tabel; nomor halaman “Hal. x / y”.</li>
            <li>Halaman tanda tangan singkat (Menyetujui/Mengetahui).</li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2"><Filter className="w-5 h-5" /> Filter standar</div>
            <div className="flex items-center gap-2"><FileDown className="w-5 h-5" /> Ekspor PDF & CSV</div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ReportLinkCard({ href, title, subtitle, icon: Icon, highlights }: ReportCard) {
  return (
    <Link href={href} className="group">
      <article
        className="relative h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all
                   hover:shadow-md hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        aria-label={title}
      >
        {/* Header kartu */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
              <Icon className="h-7 w-7 text-gray-900" aria-hidden />
            </span>
            <div>
              <h3 className="text-xl font-bold leading-tight">{title}</h3>
              <p className="text-sm md:text-base text-gray-600">{subtitle}</p>
            </div>
          </div>
          <ChevronRight className="h-6 w-6 text-gray-400 transition group-hover:translate-x-1" aria-hidden />
        </div>

        {/* Poin ringkas */}
        <ul className="mt-5 text-sm text-gray-700 space-y-1.5 list-disc pl-6">
          {highlights.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>

        {/* Footer kecil */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-[12px] rounded-full border border-gray-200 px-3 py-1 bg-gray-50 font-medium text-gray-800">Filter</span>
          <span className="text-[12px] rounded-full border border-gray-200 px-3 py-1 bg-gray-50 font-medium text-gray-800">Ekspor PDF</span>
          <span className="text-[12px] rounded-full border border-gray-200 px-3 py-1 bg-gray-50 font-medium text-gray-800">Ekspor CSV</span>
        </div>
      </article>
    </Link>
  );
}