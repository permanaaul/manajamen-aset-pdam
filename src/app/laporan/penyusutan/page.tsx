"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Filter as FilterIcon,
  RotateCcw,
  FileDown,
  FileSpreadsheet,
  Table2,
} from "lucide-react";

/* ========== Types dari API ========== */
type Row = {
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

/* ========== Page ========== */
export default function LaporanPenyusutanPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [period, setPeriod] = useState<string>(sp.get("period") ?? new Date().toISOString().slice(0, 7));
  const [unit, setUnit] = useState<string>(sp.get("unit") ?? "");
  const [kategori, setKategori] = useState<string>(sp.get("kategori") ?? "");
  const [aset, setAset] = useState<string>(sp.get("aset") ?? "");
  const [status, setStatus] = useState<string>(sp.get("status") ?? "");
  const [showZero, setShowZero] = useState<boolean>((sp.get("showZero") ?? "") === "1");

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<Tot>({ items: 0, beban: 0, akumulasi: 0, nb: 0, posted: 0 });
  const [loading, setLoading] = useState(false);

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (period) q.set("period", period);
    if (unit) q.set("unit", unit);
    if (kategori) q.set("kategori", kategori);
    if (aset) q.set("aset", aset);
    if (status) q.set("status", status);
    if (showZero) q.set("showZero", "1");
    return q.toString();
  }, [period, unit, kategori, aset, status, showZero]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/laporan/penyusutan?${qs}`);
      const j = await r.json();
      setRows(j.rows ?? []);
      setTotal(j.total ?? { items: 0, beban: 0, akumulasi: 0, nb: 0, posted: 0 });
    } finally {
      setLoading(false);
    }
  }
  function applyFilters() {
    router.push(`/laporan/penyusutan?${qs}`);
    void load();
  }
  function resetFilters() {
    const def = new Date().toISOString().slice(0, 7);
    setPeriod(def);
    setUnit("");
    setKategori("");
    setAset("");
    setStatus("");
    setShowZero(false);
    router.push(`/laporan/penyusutan`);
    void load();
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unposted = Math.max(0, total.items - total.posted);
  const canPdfAset = aset.trim().length > 0;
  const asetQueryHeader = canPdfAset ? `aset=${encodeURIComponent(aset.trim())}` : "";

  return (
    <main className="p-6 md:p-8 max-w-[1400px] mx-auto text-gray-900">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Laporan Penyusutan</h1>
        <p className="mt-1 text-base text-gray-700">
          Beban periode, akumulasi sampai akhir periode, dan nilai buku akhir — per aset.
        </p>
      </header>

      {/* Filter */}
      <section className="rounded-2xl border bg-white p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <FilterIcon className="w-4.5 h-4.5" />
          </span>
          <div className="text-base font-semibold">Filter</div>

          {/* Export buttons */}
          <div className="ml-auto flex items-center gap-2">
            {/* PDF Rekap */}
            <Ghost asChild>
              <Link href={`/api/laporan/penyusutan?${qs}&format=pdf`}>
                <FileDown className="w-4 h-4" />
                PDF Rekap
              </Link>
            </Ghost>

            {/* PDF Per Aset – aktif jika kolom Aset terisi */}
            {canPdfAset ? (
              <Ghost asChild>
                <Link href={`/api/laporan/penyusutan?type=detail&format=pdf&${asetQueryHeader}`}>
                  <FileDown className="w-4 h-4" />
                  PDF Per Aset
                </Link>
              </Ghost>
            ) : (
              <span
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-gray-400 opacity-60 cursor-not-allowed"
                title="Isi kolom Aset (kode/nama) untuk unduh PDF Per Aset"
              >
                <FileDown className="w-4 h-4" />
                PDF Per Aset
              </span>
            )}

            {/* CSV Rekap */}
            <Ghost asChild>
              <Link href={`/api/laporan/penyusutan?${qs}&format=csv`}>
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </Link>
            </Ghost>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input label="Periode (YYYY-MM)">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </Input>
          <Input label="Unit">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Semua"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </Input>
          <Input label="Kategori">
            <input
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              placeholder="Semua"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </Input>
          <Input label="Aset">
            <input
              value={aset}
              onChange={(e) => setAset(e.target.value)}
              placeholder="Kode/Nama"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </Input>
          <Input label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Semua</option>
              <option value="posted">Posted</option>
              <option value="unposted">Unposted</option>
            </select>
          </Input>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={showZero}
                onChange={(e) => setShowZero(e.target.checked)}
              />
              Tampilkan baris bernilai 0
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Primary onClick={applyFilters}>Terapkan</Primary>
          <Ghost onClick={resetFilters}>
            <RotateCcw className="w-4 h-4" />
            Reset
          </Ghost>
        </div>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        <Stat title="Periode" value={period} />
        <Stat title="# Aset" value={num(total.items)} />
        <Stat title="Total Beban" value={idr(total.beban)} right />
        <Stat title="Total Akumulasi" value={idr(total.akumulasi)} right />
        <Stat title="Total Nilai Buku" value={idr(total.nb)} right />
      </section>

      {/* Tabel */}
      <section className="rounded-2xl border bg-white overflow-hidden shadow-sm mt-6">
        <div className="px-4 py-3 border-b bg-slate-50/60">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <Table2 className="w-4 h-4" /> Rekap Penyusutan — Per Aset
            <span className="ml-3 text-xs font-medium text-gray-500">
              Posted: {num(total.posted)} · Unposted: {num(Math.max(0, total.items - total.posted))}
            </span>
          </h3>
        </div>
        <div className="overflow-auto max-h-[62vh]">
          <table className="min-w-full text-sm text-gray-900">
            <thead className="bg-slate-100 text-xs uppercase sticky top-0 z-10">
              <tr>
                <Th>Aset</Th>
                <Th>Metode</Th>
                <Th>Periode</Th>
                <Th className="text-right">Beban (IDR)</Th>
                <Th className="text-right">Akumulasi</Th>
                <Th className="text-right">Nilai Buku Akhir</Th>
                <Th>Status</Th>
                <Th className="text-right">PDF</Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-600">
                    Memuat…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-600">
                    Belum ada data untuk filter ini.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                // Query robust untuk PDF per baris: asetId > asetKode > asetNama
                const asetQuery =
                  r.asetId != null && Number.isFinite(Number(r.asetId))
                    ? `asetId=${encodeURIComponent(String(r.asetId))}`
                    : `aset=${encodeURIComponent((r.asetKode?.trim() || r.asetNama).trim())}`;

                return (
                  <tr
                    key={i}
                    className={`transition-colors ${
                      i % 2 ? "bg-slate-50/40" : "bg-white"
                    } hover:bg-slate-50`}
                  >
                    <Td>
                      <div className="font-medium">{r.asetKode || "-"}</div>
                      <div className="text-gray-600">{r.asetNama}</div>
                    </Td>
                    <Td>{r.metode}</Td>
                    <Td>{r.periode}</Td>
                    <Td className="text-right tabular-nums">{idr(r.beban)}</Td>
                    <Td className="text-right tabular-nums">{idr(r.akumulasi)}</Td>
                    <Td className="text-right tabular-nums font-semibold">{idr(r.nilaiBukuAkhir)}</Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          r.posted
                            ? "border-green-600 text-green-700"
                            : "border-amber-600 text-amber-700"
                        }`}
                      >
                        {r.posted ? "POSTED" : "UNPOSTED"}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/api/laporan/penyusutan?type=detail&format=pdf&${asetQuery}`}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        PDF
                      </Link>
                    </Td>
                  </tr>
                );
              })}
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
      <span className="text-[11px] font-semibold text-gray-700 tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
function Primary(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-gray-300 ${className}`}
    />
  );
}
function Ghost(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    children: React.ReactNode;
  }
) {
  const { asChild, children, className = "", ...rest } = props;
  if (asChild) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50 focus:ring-2 focus:ring-slate-300 ${className}`}
      >
        {children}
      </span>
    );
  }
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 ${className}`}
    >
      {children}
    </button>
  );
}
function Stat({ title, value, right }: { title: string; value: string; right?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="text-[11px] font-semibold text-gray-600 tracking-wide uppercase">
        {title}
      </div>
      <div className={`mt-0.5 text-base font-semibold ${right ? "text-right" : ""}`}>
        {value}
      </div>
    </div>
  );
}
function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <th className={`px-3 py-2 text-xs font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

/* ========== utils format ========== */
function num(n: number) {
  return new Intl.NumberFormat("id-ID").format(n ?? 0);
}
function idr(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n ?? 0);
}
