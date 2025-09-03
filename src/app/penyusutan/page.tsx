// app/penyusutan/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calculator,
  FileDown,
  Filter as FilterIcon,
  RotateCcw,
  Search,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";
import useToast from "@/components/Toast";

/* =========================
 * Types
 * ========================= */
type AsetMini = {
  id: number;
  nia: string;
  nama: string;
  kategori: string;
  lokasi: string | null;
};

type Row = {
  id: number;
  periode: string | null; // ISO (tidak ditampilkan di tabel)
  metode: "GARIS_LURUS" | "SALDO_MENURUN" | string;
  basis: "TAHUNAN" | "BULANAN" | string;
  tarif: number; // tidak ditampilkan
  nilaiAwal: number; // tidak ditampilkan
  beban: number; // tidak ditampilkan
  akumulasi: number; // tidak ditampilkan
  nilaiAkhir: number; // tidak ditampilkan
  aset: AsetMini | null;
  totalBebanAsetPadaFilter?: number; // tidak ditampilkan
};

type Resp = {
  rows: Row[];
  count: number;
  page: number;
  size: number;
  summary?: { totalBeban?: number };
};

/* =========================
 * Utils
 * ========================= */
const badge = (text: string, tone: "indigo" | "sky" = "indigo") =>
  `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
    tone === "indigo"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
      : "bg-sky-50 text-sky-700 ring-sky-200"
  }`;

/* =========================
 * Page
 * ========================= */
export default function PenyusutanListPage() {
  const { View, push } = useToast();
  const router = useRouter();
  const sp = useSearchParams();

  // Mode tampilan: default ke "asset" (ringkas per-aset)
  const [mode] = React.useState<"asset" | "period">("asset");

  // Filters
  const [q, setQ] = React.useState<string>(sp.get("q") || "");
  const [metode, setMetode] = React.useState<string>(sp.get("metode") || "");
  const [basis, setBasis] = React.useState<string>(sp.get("basis") || "");
  const [dateFrom, setDateFrom] = React.useState<string>(sp.get("dateFrom") || "");
  const [dateTo, setDateTo] = React.useState<string>(sp.get("dateTo") || "");
  const [page, setPage] = React.useState<number>(Number(sp.get("page") || 1));
  const [size] = React.useState<number>(20);

  // Data
  const [loading, setLoading] = React.useState<boolean>(false);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [count, setCount] = React.useState<number>(0);

  const fetchData = React.useCallback(
    async (toPage = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (metode) params.set("metode", metode);
        if (basis) params.set("basis", basis);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        params.set("page", String(toPage));
        params.set("size", String(size));
        params.set("mode", "asset"); // selalu asset

        const url = `/api/penyusutan/by-asset?${params.toString()}`;
        const res = await fetch(url, { cache: "no-store" });
        const data: Resp | any = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal memuat data penyusutan");

        setRows(Array.isArray(data.rows) ? data.rows : []);
        setCount(Number(data.count || 0));
        setPage(toPage);

        // sinkronkan querystring
        const qs = new URLSearchParams(params);
        router.replace(`/penyusutan?${qs.toString()}`);
      } catch (e: any) {
        push(`❌ ${String(e.message || "Gagal memuat data")}`, "err");
        setRows([]);
        setCount(0);
      } finally {
        setLoading(false);
      }
    },
    [q, metode, basis, dateFrom, dateTo, size, router, push]
  );

  React.useEffect(() => {
    fetchData(Number(sp.get("page") || 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // load once

  const reset = () => {
    setQ("");
    setMetode("");
    setBasis("");
    setDateFrom("");
    setDateTo("");
    setRows([]);
    setCount(0);
    setPage(1);
    router.replace("/penyusutan");
  };

  const fromIdx = Math.min((page - 1) * size + 1, Math.max(count, 1));
  const toIdx = Math.min(page * size, count);

  const exportCsv = () => {
    if (!rows.length) {
      push("Tidak ada data untuk diekspor.", "err");
      return;
    }
    const header = [
      "Aset NIA",
      "Aset Nama",
      "Aset Kategori",
      "Aset Lokasi",
      "Metode",
      "Basis",
    ];
    const lines = rows.map((r) => [
      r.aset?.nia ?? "",
      r.aset?.nama ?? "",
      r.aset?.kategori ?? "",
      r.aset?.lokasi ?? "",
      r.metode,
      r.basis,
    ]);
    const csv = [header, ...lines]
      .map((arr) =>
        arr
          .map((v) => {
            const s = String(v ?? "");
            return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    a.download = `penyusutan-per-aset-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-indigo-600" />
            Penyusutan Aset
          </h1>
          <p className="text-[13px] text-gray-700">
            Ringkasan aset yang sudah memiliki jurnal penyusutan. Klik NIA untuk melihat
            detail seluruh periodenya.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/aset"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" /> Ke Aset
          </Link>
          <button
            onClick={exportCsv}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 font-semibold hover:bg-gray-50 disabled:opacity-60"
            title="Ekspor ke CSV (berdasarkan hasil filter & halaman aktif)"
          >
            <FileDown className="h-4 w-4" /> Ekspor CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 ring-1 ring-gray-200">
          Total aset: <b>{count}</b>
        </span>
        {metode ? <span className={badge(`Metode: ${metode}`, "indigo")} /> : null}
        {basis ? <span className={badge(`Basis: ${basis}`, "sky")} /> : null}
        {dateFrom || dateTo ? (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-800 ring-1 ring-gray-200">
            Rentang tanggal aktif
          </span>
        ) : null}
      </div>

      {/* Filter */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">
          Filter
        </div>
        <div className="grid items-end gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-gray-900">
              Pencarian
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="NIA / Nama Aset"
                className="h-11 w-full rounded-xl border border-gray-300 pl-9 pr-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-gray-900">
              Metode
            </label>
            <select
              value={metode}
              onChange={(e) => setMetode(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">(semua)</option>
              <option value="GARIS_LURUS">GARIS_LURUS</option>
              <option value="SALDO_MENURUN">SALDO_MENURUN</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-gray-900">
              Basis
            </label>
            <select
              value={basis}
              onChange={(e) => setBasis(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">(semua)</option>
              <option value="TAHUNAN">TAHUNAN</option>
              <option value="BULANAN">BULANAN</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-gray-900">
              Dari (periode)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-gray-900">
              Sampai (periode)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-12 flex items-center justify-end gap-2">
            <button
              onClick={() => fetchData(1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50"
            >
              <FilterIcon className="h-4 w-4" /> Terapkan
            </button>
            <button
              onClick={reset}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table – ringkas per-aset tanpa nilai & periode */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b font-semibold text-gray-900">
          Hasil Penyusutan (Per-Aset)
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="bg-gray-50">
              <tr className="text-gray-800">
                <Th className="text-left">Aset</Th>
                <Th className="text-left w-40">Metode</Th>
                <Th className="text-left w-32">Basis</Th>
                <Th className="text-right w-28">Aksi</Th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-700">
                    Memuat…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-700">
                    Tidak ada data pada filter/paging ini.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r: Row, i: number) => (
                  <tr
                    key={`asset-${r.id}`}
                    className={`${i % 2 ? "bg-gray-50/40" : "bg-white"} border-t`}
                  >
                    {/* Aset */}
                    <td className="px-3 py-2 align-top">
                      {r.aset ? (
                        <>
                          <Link
                            href={`/penyusutan/aset/${r.aset.id}${
                              dateFrom || dateTo
                                ? `?${new URLSearchParams({
                                    ...(dateFrom ? { dateFrom } : {}),
                                    ...(dateTo ? { dateTo } : {}),
                                  }).toString()}`
                                : ""
                            }`}
                            className="font-semibold text-indigo-700 hover:underline"
                            title="Lihat seluruh penyusutan aset ini"
                          >
                            {r.aset.nia}
                          </Link>
                          <div className="text-xs text-gray-700">{r.aset.nama}</div>
                          <div className="text-[11px] text-gray-500">
                            {r.aset.kategori} {r.aset.lokasi ? `• ${r.aset.lokasi}` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* Metode */}
                    <td className="px-3 py-2 align-top">
                      <span className={badge(r.metode, "indigo")}>{r.metode}</span>
                    </td>

                    {/* Basis */}
                    <td className="px-3 py-2 align-top">
                      <span className={badge(r.basis, "sky")}>{r.basis}</span>
                    </td>

                    {/* Aksi */}
                    <td className="px-3 py-2 text-right align-top">
                      {r.aset && (
                        <Link
                          href={`/penyusutan/aset/${r.aset.id}${
                            dateFrom || dateTo
                              ? `?${new URLSearchParams({
                                  ...(dateFrom ? { dateFrom } : {}),
                                  ...(dateTo ? { dateTo } : {}),
                                }).toString()}`
                              : ""
                          }`}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                        >
                          Detail <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-[13px] text-gray-800">
          <div>
            {count > 0 ? (
              <>Menampilkan <b>{fromIdx}</b>–<b>{toIdx}</b> dari <b>{count}</b> aset</>
            ) : (
              <>0 aset</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => fetchData(page - 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page * size >= count}
              onClick={() => fetchData(page + 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small helper */
function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2 font-semibold text-xs uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}
