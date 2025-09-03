"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Filter as FilterIcon,
  RotateCcw,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  FileDown,
} from "lucide-react";

/* ==================== Types ==================== */
type SaldoRow = {
  kategori?: string | null;
  itemCode: string;
  itemName: string;
  satuan: string | null;
  awal: number;
  masuk: number;
  keluar: number;
  adj: number;
  akhir: number;
  minQty: number | null;
};

type PemakaianRow = {
  tanggal: string; // ISO
  dokNo?: string | null;
  itemCode: string;
  itemName: string;
  qty: number;
  nilai: number;
  asetWO?: string | null;
};

/* ==================== Page ==================== */
export default function LaporanGudangPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // filters
  const [dateFrom, setDateFrom] = useState(sp.get("dateFrom") ?? firstDayThisMonth());
  const [dateTo, setDateTo] = useState(sp.get("dateTo") ?? today());
  const [unit, setUnit] = useState(sp.get("unit") ?? "");
  const [lokasi, setLokasi] = useState(sp.get("lokasi") ?? "");
  const [kategori, setKategori] = useState(sp.get("kategori") ?? "");
  const [aset, setAset] = useState(sp.get("aset") ?? "");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [showZero, setShowZero] = useState((sp.get("showZero") ?? "") === "1");
  const [tab, setTab] = useState<"saldo" | "pemakaian">((sp.get("tab") as any) || "saldo");

  // data
  const [saldo, setSaldo] = useState<SaldoRow[]>([]);
  const [pemakaian, setPemakaian] = useState<PemakaianRow[]>([]);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [loadingPem, setLoadingPem] = useState(false);

  const qs = useMemo(() => {
    const s = new URLSearchParams();
    if (dateFrom) s.set("dateFrom", dateFrom);
    if (dateTo) s.set("dateTo", dateTo);
    if (unit) s.set("unit", unit);
    if (lokasi) s.set("lokasi", lokasi);
    if (kategori) s.set("kategori", kategori);
    if (aset) s.set("aset", aset);
    if (q) s.set("q", q);
    if (showZero) s.set("showZero", "1");
    s.set("tab", tab);
    return s.toString();
  }, [dateFrom, dateTo, unit, lokasi, kategori, aset, q, showZero, tab]);

  function applyFilters() {
    router.push(`/laporan/gudang?${qs}`);
    void load("saldo");
    void load("pemakaian");
  }
  function resetFilters() {
    setDateFrom(firstDayThisMonth());
    setDateTo(today());
    setUnit("");
    setLokasi("");
    setKategori("");
    setAset("");
    setQ("");
    setShowZero(false);
    setTab("saldo");
    router.push(`/laporan/gudang`);
    setSaldo([]);
    setPemakaian([]);
  }

  async function load(kind: "saldo" | "pemakaian") {
    const s = new URLSearchParams(qs);
    s.delete("tab");
    s.set("type", kind);
    if (kind === "saldo") {
      setLoadingSaldo(true);
      try {
        const r = await fetch(`/api/laporan/gudang?${s.toString()}`);
        const j = await r.json();
        setSaldo((j.rows ?? []) as SaldoRow[]);
      } finally {
        setLoadingSaldo(false);
      }
    } else {
      setLoadingPem(true);
      try {
        const r = await fetch(`/api/laporan/gudang?${s.toString()}`);
        const j = await r.json();
        setPemakaian((j.rows ?? []) as PemakaianRow[]);
      } finally {
        setLoadingPem(false);
      }
    }
  }

  useEffect(() => {
    void load("saldo");
    void load("pemakaian");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(
    () =>
      saldo.reduce(
        (a, r) => ({
          awal: a.awal + r.awal,
          masuk: a.masuk + r.masuk,
          keluar: a.keluar + r.keluar,
          adj: a.adj + r.adj,
          akhir: a.akhir + r.akhir,
          items: a.items + 1,
          low: a.low + (r.minQty != null && r.akhir < r.minQty ? 1 : 0),
        }),
        { awal: 0, masuk: 0, keluar: 0, adj: 0, akhir: 0, items: 0, low: 0 }
      ),
    [saldo]
  );

  // helper export URLs
  const urlCSV = tab === "saldo"
    ? `/api/laporan/gudang?${qs}&type=saldo&format=csv`
    : `/api/laporan/gudang?${qs}&type=pemakaian&format=csv`;
  const urlPDF = tab === "saldo"
    ? `/api/laporan/gudang?${qs}&type=saldo&format=pdf`
    : `/api/laporan/gudang?${qs}&type=pemakaian&format=pdf`;

  return (
    <main className="p-6 md:p-8 max-w-[1400px] mx-auto text-gray-900">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Laporan Gudang</h1>
        <p className="mt-1 text-base text-gray-700">
          Rekap periode: <span className="font-medium">Saldo Stok</span> &{" "}
          <span className="font-medium">Pemakaian ke Aset/WO</span>.
        </p>
      </header>

      {/* Filter */}
      <section className="rounded-2xl border bg-white p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <FilterIcon className="w-4.5 h-4.5" />
          </div>
          <div className="text-base font-semibold">Filter</div>

          {/* Export buttons */}
          <div className="ml-auto flex items-center gap-2">
            <GhostButton asChild>
              <a href={urlPDF} target="_blank" rel="noopener">
                <FileDown className="w-4 h-4" />
                PDF {tab === "saldo" ? "Saldo" : "Pemakaian"}
              </a>
            </GhostButton>
            <GhostButton asChild>
              <a href={urlCSV} target="_blank" rel="noopener">
                <FileSpreadsheet className="w-4 h-4" />
                CSV {tab === "saldo" ? "Saldo" : "Pemakaian"}
              </a>
            </GhostButton>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
          <InputBlock label="Dari Tanggal">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </InputBlock>
          <InputBlock label="Sampai Tanggal">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </InputBlock>
          <InputBlock label="Unit">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Semua"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </InputBlock>
          <InputBlock label="Lokasi">
            <input
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              placeholder="Semua"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </InputBlock>
          <InputBlock label="Kategori">
            <input
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              placeholder="Semua"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </InputBlock>
          <InputBlock label="Aset (untuk pemakaian)">
            <input
              value={aset}
              onChange={(e) => setAset(e.target.value)}
              placeholder="Kode/Nama"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </InputBlock>
          <InputBlock label="Cari Item">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kode/Nama item"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </InputBlock>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} />
            Tampilkan baris bernilai 0
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={applyFilters}>Terapkan</PrimaryButton>
          <GhostButton onClick={resetFilters}>
            <RotateCcw className="w-4 h-4" />
            Reset
          </GhostButton>

          {/* Tabs */}
          <div className="ml-auto flex items-center gap-2">
            <TabButton active={tab === "saldo"} onClick={() => setTab("saldo")}>
              Saldo Stok
            </TabButton>
            <TabButton active={tab === "pemakaian"} onClick={() => setTab("pemakaian")}>
              Pemakaian
            </TabButton>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        <StatCard title="Periode" value={`${dateFrom} – ${dateTo}`} />
        <StatCard title="# Item" value={totals.items.toLocaleString("id-ID")} />
        <StatCard title="Total Awal" value={fmtNum(totals.awal)} right />
        <StatCard title="Total Masuk" value={fmtNum(totals.masuk)} right />
        <StatCard title="Saldo Akhir" value={fmtNum(totals.akhir)} right />
      </section>

      {/* Tables */}
      {tab === "saldo" ? (
        <section className="rounded-2xl border bg-white overflow-hidden shadow-sm mt-6">
          <div className="px-4 py-3 border-b bg-slate-50/60">
            <h3 className="text-sm font-semibold">Saldo Stok — per Item</h3>
          </div>
          <div className="overflow-auto max-h-[62vh]">
            <table className="min-w-full text-sm text-gray-900">
              <thead className="bg-slate-100 text-gray-900 text-xs uppercase sticky top-0 z-10">
                <tr>
                  <Th>Kategori</Th>
                  <Th>Item</Th>
                  <Th>Satuan</Th>
                  <Th className="text-right">Awal</Th>
                  <Th className="text-right">Masuk</Th>
                  <Th className="text-right">Keluar</Th>
                  <Th className="text-right">Penyesuaian</Th>
                  <Th className="text-right">Akhir</Th>
                  <Th className="text-right">Min-Qty</Th>
                  <Th>Alert</Th>
                </tr>
              </thead>
              <tbody>
                {loadingSaldo && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-600">
                      <Loader2 className="inline-block w-4 h-4 animate-spin mr-2" />
                      Memuat saldo…
                    </td>
                  </tr>
                )}
                {!loadingSaldo && saldo.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-600">
                      Belum ada data pada filter ini.
                    </td>
                  </tr>
                )}
                {saldo.map((r, i) => {
                  const low = r.minQty != null && r.akhir < r.minQty;
                  return (
                    <tr
                      key={`${r.itemCode}-${i}`}
                      className={`transition-colors ${i % 2 ? "bg-slate-50/40" : "bg-white"} hover:bg-slate-50`}
                    >
                      <Td>{r.kategori ?? "-"}</Td>
                      <Td>
                        <div className="font-medium">{r.itemCode}</div>
                        <div className="text-gray-600">{r.itemName}</div>
                      </Td>
                      <Td>{r.satuan ?? "-"}</Td>
                      <Td className="text-right tabular-nums">{fmtNum(r.awal)}</Td>
                      <Td className="text-right tabular-nums">{fmtNum(r.masuk)}</Td>
                      <Td className="text-right tabular-nums">{fmtNum(r.keluar)}</Td>
                      <Td className="text-right tabular-nums">{fmtNum(r.adj)}</Td>
                      <Td className="text-right font-semibold tabular-nums">{fmtNum(r.akhir)}</Td>
                      <Td className="text-right tabular-nums">{r.minQty ?? "-"}</Td>
                      <Td>{low ? <LowBadge /> : null}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border bg-white overflow-hidden shadow-sm mt-6">
          <div className="px-4 py-3 border-b bg-slate-50/60">
            <h3 className="text-sm font-semibold">Pemakaian ke Aset/WO — detail transaksi OUT</h3>
          </div>
          <div className="overflow-auto max-h-[62vh]">
            <table className="min-w-full text-sm text-gray-900">
              <thead className="bg-slate-100 text-gray-900 text-xs uppercase sticky top-0 z-10">
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Dokumen</Th>
                  <Th>Item</Th>
                  <Th className="text-right">QTY</Th>
                  <Th className="text-right">Nilai (IDR)</Th>
                  <Th>Aset/WO</Th>
                </tr>
              </thead>
              <tbody>
                {loadingPem && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                      <Loader2 className="inline-block w-4 h-4 animate-spin mr-2" />
                      Memuat pemakaian…
                    </td>
                  </tr>
                )}
                {!loadingPem && pemakaian.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-600">
                      Belum ada data pada filter ini.
                    </td>
                  </tr>
                )}
                {pemakaian.map((r, i) => (
                  <tr
                    key={i}
                    className={`transition-colors ${i % 2 ? "bg-slate-50/40" : "bg-white"} hover:bg-slate-50`}
                  >
                    <Td>{toLocal(r.tanggal)}</Td>
                    <Td>{r.dokNo ?? "-"}</Td>
                    <Td>
                      <div className="font-medium">{r.itemCode}</div>
                      <div className="text-gray-600">{r.itemName}</div>
                    </Td>
                    <Td className="text-right tabular-nums">{fmtNum(r.qty)}</Td>
                    <Td className="text-right tabular-nums">{fmtIDR(r.nilai)}</Td>
                    <Td>{r.asetWO ?? "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

/* ==================== UI Bits ==================== */
function InputBlock({ label, children }: React.PropsWithChildren<{ label: string }>) {
  return (
    <label className="block text-sm">
      <span className="text-[11px] font-semibold text-gray-700 tracking-wide uppercase">{label}</span>
      {children}
    </label>
  );
}
function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-gray-300 ${className}`}
    />
  );
}
function GhostButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; children: React.ReactNode }
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
function TabButton({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-sm font-medium border transition-colors ${
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
function StatCard({ title, value, right }: { title: string; value: string; right?: boolean }) {
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
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
function LowBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      Di bawah minimum
    </span>
  );
}

/* ==================== Utils ==================== */
function fmtNum(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n ?? 0);
}
function fmtIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 }).format(n ?? 0);
}
function toLocal(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function firstDayThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
