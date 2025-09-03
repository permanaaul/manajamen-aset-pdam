"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Filter as FilterIcon,
  RotateCcw,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";

/* ========== Types ========== */
type Row = {
  kategori: string;
  lokasi: string | null;
  kode: string;
  nama: string;
  qty: number;
  perolehan: number;
  akum: number;
  nb: number;
  nbShare: number;
};
type Tot = { qty: number; perolehan: number; akum: number; nb: number };

/* ========== Page ========== */
export default function LaporanAsetPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [period, setPeriod] = useState(sp.get("period") ?? new Date().toISOString().slice(0, 7));
  const [unit, setUnit] = useState(sp.get("unit") ?? "");
  const [lokasi, setLokasi] = useState(sp.get("lokasi") ?? "");
  const [kategori, setKategori] = useState(sp.get("kategori") ?? "");
  const [aset, setAset] = useState(sp.get("aset") ?? "");
  const [showZero, setShowZero] = useState((sp.get("showZero") ?? "") === "1");

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<Tot>({ qty: 0, perolehan: 0, akum: 0, nb: 0 });
  const [loading, setLoading] = useState(false);

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (period) q.set("period", period);
    if (unit) q.set("unit", unit);
    if (lokasi) q.set("lokasi", lokasi);
    if (kategori) q.set("kategori", kategori);
    if (aset) q.set("aset", aset);
    if (showZero) q.set("showZero", "1");
    return q.toString();
  }, [period, unit, lokasi, kategori, aset, showZero]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/laporan/aset?${qs}`);
      const j = await r.json();
      setRows(j.rows ?? []);
      setTotal(j.total ?? { qty: 0, perolehan: 0, akum: 0, nb: 0 });
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    router.push(`/laporan/aset?${qs}`);
    void load();
  }
  function reset() {
    setPeriod(new Date().toISOString().slice(0, 7));
    setUnit(""); setLokasi(""); setKategori(""); setAset(""); setShowZero(false);
    router.push("/laporan/aset");
    void load();
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  return (
    <main className="p-6 md:p-8 max-w-[1400px] mx-auto text-gray-900">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Laporan Aset</h1>
        <p className="mt-1 text-base text-gray-700">
          Rekap jumlah, perolehan, akumulasi penyusutan, dan nilai buku — per kategori → lokasi → aset.
        </p>
      </header>

      {/* Filter */}
      <section className="rounded-2xl border bg-white p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <FilterIcon className="w-4.5 h-4.5" />
          </span>
          <div className="text-base font-semibold">Filter</div>
          <div className="ml-auto flex items-center gap-2">
            <Ghost asChild>
              <Link href={`/api/laporan/aset?${qs}&format=pdf`}>
                <FileDown className="w-4 h-4" />
                PDF
              </Link>
            </Ghost>
            <Ghost asChild>
              <Link href={`/api/laporan/aset?${qs}&format=csv`}>
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </Link>
            </Ghost>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input label="Periode (YYYY-MM)">
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
                   className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </Input>
          <Input label="Unit">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Semua"
                   className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </Input>
          <Input label="Lokasi">
            <input value={lokasi} onChange={(e) => setLokasi(e.target.value)} placeholder="Semua"
                   className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </Input>
          <Input label="Kategori">
            <input value={kategori} onChange={(e) => setKategori(e.target.value)} placeholder="Semua"
                   className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </Input>
          <Input label="Aset">
            <input value={aset} onChange={(e) => setAset(e.target.value)} placeholder="Kode/Nama"
                   className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </Input>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} />
              Tampilkan baris bernilai 0
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Primary onClick={apply}>Terapkan</Primary>
          <Ghost onClick={reset}><RotateCcw className="w-4 h-4" />Reset</Ghost>
        </div>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <Stat title="Periode" value={period} />
        <Stat title="Total QTY" value={num(total.qty)} right />
        <Stat title="Total Perolehan" value={idr(total.perolehan)} right />
        <Stat title="Total Nilai Buku" value={idr(total.nb)} right />
      </section>

      {/* Tabel */}
      <section className="rounded-2xl border bg-white overflow-hidden shadow-sm mt-6">
        <div className="px-4 py-3 border-b bg-slate-50/60">
          <h3 className="text-sm font-semibold">Rekap Aset — Kategori → Lokasi → Aset</h3>
        </div>
        <div className="overflow-auto max-h-[62vh]">
          <table className="min-w-full text-sm text-gray-900">
            <thead className="bg-slate-100 text-xs uppercase sticky top-0 z-10">
              <tr>
                <Th>Kategori</Th>
                <Th>Lokasi</Th>
                <Th>Kode</Th>
                <Th>Nama Aset</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Perolehan</Th>
                <Th className="text-right">Akumulasi</Th>
                <Th className="text-right">Nilai Buku</Th>
                <Th className="text-right">% Komposisi</Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-600">Memuat…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-600">Belum ada data pada filter ini.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className={`transition-colors ${i % 2 ? "bg-slate-50/40" : "bg-white"} hover:bg-slate-50`}>
                  <Td>{r.kategori}</Td>
                  <Td>{r.lokasi ?? "-"}</Td>
                  <Td>{r.kode}</Td>
                  <Td>{r.nama}</Td>
                  <Td className="text-right tabular-nums">{num(r.qty)}</Td>
                  <Td className="text-right tabular-nums">{idr(r.perolehan)}</Td>
                  <Td className="text-right tabular-nums">{idr(r.akum)}</Td>
                  <Td className="text-right tabular-nums font-semibold">{idr(r.nb)}</Td>
                  <Td className="text-right tabular-nums">{num(r.nbShare)}%</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/* ========== UI bits ========== */
function Input({ label, children }: React.PropsWithChildren<{ label: string }>) {
  return (
    <label className="block text-sm">
      <span className="text-[11px] font-semibold text-gray-700 tracking-wide uppercase">{label}</span>
      {children}
    </label>
  );
}
function Primary(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button {...rest}
      className={`rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-gray-300 ${className}`} />
  );
}
function Ghost(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; children: React.ReactNode }
) {
  const { asChild, children, className = "", ...rest } = props;
  if (asChild) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50 focus:ring-2 focus:ring-slate-300 ${className}`}>
        {children}
      </span>
    );
  }
  return (
    <button {...rest}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 ${className}`}>
      {children}
    </button>
  );
}
function Stat({ title, value, right }: { title: string; value: string; right?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="text-[11px] font-semibold text-gray-600 tracking-wide uppercase">{title}</div>
      <div className={`mt-0.5 text-base font-semibold ${right ? "text-right" : ""}`}>{value}</div>
    </div>
  );
}
function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <th className={`px-3 py-2 text-xs font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

/* ========== utils ========== */
function num(n: number) {
  return new Intl.NumberFormat("id-ID").format(n ?? 0);
}
function idr(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n ?? 0);
}
