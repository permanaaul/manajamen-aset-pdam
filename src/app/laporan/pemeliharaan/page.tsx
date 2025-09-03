"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Wrench, Filter as FilterIcon, RotateCcw, FileDown, Table2 } from "lucide-react";

/* =====================================================
 * Laporan Pemeliharaan
 * - Rekap jumlah WO, total biaya, rata biaya/WO, downtime, dll
 * - Kelompok: Kategori/Aset/Unit — sesuai filter
 * ===================================================== */

type Row = {
  asetKode: string;
  asetNama: string;
  kategori: string;
  jumlahWO: number;
  totalBiaya: number;
  rataBiaya: number;
  downtimeJam?: number | null;
};

export default function LaporanPemeliharaanPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [dateFrom, setDateFrom] = useState<string>(sp.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState<string>(sp.get("dateTo") ?? "");
  const [unit, setUnit] = useState<string>(sp.get("unit") ?? "");
  const [kategori, setKategori] = useState<string>(sp.get("kategori") ?? "");
  const [aset, setAset] = useState<string>(sp.get("aset") ?? "");
  const [showZero, setShowZero] = useState<boolean>((sp.get("showZero") ?? "") === "1");

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    if (unit) q.set("unit", unit);
    if (kategori) q.set("kategori", kategori);
    if (aset) q.set("aset", aset);
    if (showZero) q.set("showZero", "1");
    return q.toString();
  }, [dateFrom, dateTo, unit, kategori, aset, showZero]);

  function applyFilters() { router.push(`/laporan/pemeliharaan${qs ? `?${qs}` : ""}`); }
  function resetFilters() {
    setDateFrom(""); setDateTo(""); setUnit(""); setKategori(""); setAset(""); setShowZero(false);
    router.push(`/laporan/pemeliharaan`);
  }

  const rows: Row[] = [];

  return (
    <main className="p-6 md:p-8">
      <Header title="Laporan Pemeliharaan" subtitle="Biaya, frekuensi, downtime, dan indikator" />

      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        unit={unit}
        kategori={kategori}
        aset={aset}
        showZero={showZero}
        onChange={{ setDateFrom, setDateTo, setUnit, setKategori, setAset, setShowZero }}
        onApply={applyFilters}
        onReset={resetFilters}
        exportBase={`/api/laporan/pemeliharaan/export`}
        queryString={qs}
      />

      <section className="mt-8">
        <SectionTitle icon={Table2} title="Rekap Pemeliharaan" subtitle="Per aset/kategori" />
        <div className="overflow-x-auto rounded-2xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <Th>Aset</Th>
                <Th>Kategori</Th>
                <Th className="text-right"># WO</Th>
                <Th className="text-right">Total Biaya (IDR)</Th>
                <Th className="text-right">Rata Biaya/WO</Th>
                <Th className="text-right">Downtime (jam)</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <NoDataRow colSpan={6} />
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <Td>
                      <div className="font-medium">{r.asetKode}</div>
                      <div className="text-gray-500">{r.asetNama}</div>
                    </Td>
                    <Td>{r.kategori}</Td>
                    <Td className="text-right">{fmtNum(r.jumlahWO)}</Td>
                    <Td className="text-right">{fmtIDR(r.totalBiaya)}</Td>
                    <Td className="text-right">{fmtIDR(r.rataBiaya)}</Td>
                    <Td className="text-right">{r.downtimeJam ?? "-"}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/* ---------------- Components ---------------- */
function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-gray-600 mt-1">{subtitle}</p>
    </header>
  );
}

function SectionTitle({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon: React.ElementType }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="inline-flex items-center justify-center rounded-xl border bg-gray-50 p-2">
        <Icon className="w-5 h-5" />
      </span>
      <div>
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-gray-600">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function FilterBar(props: {
  dateFrom: string; dateTo: string; unit: string; kategori: string; aset: string; showZero: boolean;
  onChange: { setDateFrom: (v: string) => void; setDateTo: (v: string) => void; setUnit: (v: string) => void; setKategori: (v: string) => void; setAset: (v: string) => void; setShowZero: (v: boolean) => void; };
  onApply: () => void; onReset: () => void; exportBase: string; queryString: string;
}) {
  const { dateFrom, dateTo, unit, kategori, aset, showZero, onChange, onApply, onReset, exportBase, queryString } = props;

  return (
    <div className="rounded-2xl border p-4 md:p-5 bg-white shadow-sm mt-4">
      <div className="flex items-center gap-2 mb-3"><FilterIcon className="w-5 h-5" /><div className="font-semibold">Filter</div></div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600">Dari</label>
          <input value={dateFrom} onChange={(e) => onChange.setDateFrom(e.target.value)} type="date" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Sampai</label>
          <input value={dateTo} onChange={(e) => onChange.setDateTo(e.target.value)} type="date" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Unit</label>
          <input value={unit} onChange={(e) => onChange.setUnit(e.target.value)} placeholder="Semua" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Kategori</label>
          <input value={kategori} onChange={(e) => onChange.setKategori(e.target.value)} placeholder="Semua" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-600">Aset</label>
          <input value={aset} onChange={(e) => onChange.setAset(e.target.value)} placeholder="Kode/Nama" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={showZero} onChange={(e) => onChange.setShowZero(e.target.checked)} />
          Tampilkan baris bernilai 0
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={onApply} className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold">Terapkan</button>
        <button onClick={onReset} className="rounded-xl border px-4 py-2 text-sm font-medium inline-flex items-center gap-2"><RotateCcw className="w-4 h-4"/>Reset</button>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`${exportBase}?format=pdf${queryString ? `&${queryString}` : ""}`} className="rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2"><FileDown className="w-4 h-4"/>PDF</Link>
          <Link href={`${exportBase}?format=csv${queryString ? `&${queryString}` : ""}`} className="rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2">CSV</Link>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) { return <th className={`px-3 py-2 text-xs font-semibold text-gray-600 ${className}`}>{children}</th>; }
function Td({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) { return <td className={`px-3 py-2 ${className}`}>{children}</td>; }
function NoDataRow({ colSpan }: { colSpan: number }) { return (<tr><td colSpan={colSpan} className="px-3 py-10 text-center text-gray-500">Belum ada data untuk filter ini.</td></tr>); }

/* Utils */
function fmtNum(n: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n ?? 0); }
function fmtIDR(n: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 }).format(n ?? 0); }
