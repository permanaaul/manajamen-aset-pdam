// app/gudang/transaksi/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Plus,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import useToast from "@/components/Toast";

/* ========= Types ========= */
type Row = {
  id: number;
  noTransaksi: string;
  tanggal: string; // ISO
  jenis: "IN" | "OUT" | "ADJ";
  referensi: string | null;
  keterangan: string | null;
  _count?: { lines: number };
};

/* ========= Helpers ========= */
const cx = (...cls: Array<string | false | null | undefined>) =>
  cls.filter(Boolean).join(" ");

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

const jenisPill = (jenis: Row["jenis"]) =>
  jenis === "IN"
    ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
    : jenis === "OUT"
    ? "bg-rose-100 text-rose-800 ring-rose-200"
    : "bg-amber-100 text-amber-800 ring-amber-200";

/* Safe fetch (gracefully handles empty/500 body) */
async function safeFetchJSON(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const text = await res.text();
  try {
    const data = text ? JSON.parse(text) : null;
    return { res, data };
  } catch {
    return { res, data: null as any };
  }
}

function countActiveFilters({
  q,
  jenis,
  dateFrom,
  dateTo,
}: { q: string; jenis: string; dateFrom: string; dateTo: string }) {
  return [q, jenis, dateFrom, dateTo].filter(Boolean).length;
}

/* ========= Page ========= */
export default function TransaksiList() {
  const { push, View } = useToast();
  const router = useRouter();
  const sp = useSearchParams();

  // filter state
  const [q, setQ] = React.useState(sp.get("q") || "");
  const [jenis, setJenis] = React.useState<string>(sp.get("jenis") || "");
  const [dateFrom, setDateFrom] = React.useState(sp.get("dateFrom") || "");
  const [dateTo, setDateTo] = React.useState(sp.get("dateTo") || "");
  const [page, setPage] = React.useState(Number(sp.get("page") || 1));
  const [size] = React.useState(20);

  // data
  const [rows, setRows] = React.useState<Row[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // debounce search
  const [qDraft, setQDraft] = React.useState(q);
  React.useEffect(() => {
    const t = setTimeout(() => setQ(qDraft.trim()), 400);
    return () => clearTimeout(t);
  }, [qDraft]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (jenis) params.set("jenis", jenis);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("size", String(size));

      const { res, data } = await safeFetchJSON(`/api/gudang/transaksi?${params.toString()}`);
      if (!res.ok) throw new Error(data?.error || `Gagal memuat (HTTP ${res.status})`);
      setRows(data?.rows || []);
      setCount(data?.count || 0);
    } catch (e: any) {
      const msg = String(e?.message || "Gagal memuat data.");
      setRows([]);
      setCount(0);
      setError(msg);
      push(`❌ ${msg}`, "err");
    } finally {
      setLoading(false);
    }
  }, [q, jenis, dateFrom, dateTo, page, size, push]);

  // load + sync URL
  React.useEffect(() => {
    load();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (jenis) params.set("jenis", jenis);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(page));
    router.replace(`/gudang/transaksi?${params.toString()}`);
  }, [q, jenis, dateFrom, dateTo, page, load, router]);

  const showingFrom = Math.min((page - 1) * size + 1, Math.max(count, 1));
  const showingTo = Math.min(page * size, count);
  const totalPages = Math.max(1, Math.ceil(count / size));
  const activeFilters = countActiveFilters({ q, jenis, dateFrom, dateTo });

  // Quick range helpers
  const setToday = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const s = `${yyyy}-${mm}-${dd}`;
    setDateFrom(s);
    setDateTo(s);
    setPage(1);
  };
  const setLast7 = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const f = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    setDateFrom(f(start));
    setDateTo(f(end));
    setPage(1);
  };
  const setThisMonth = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    setDateFrom(`${yyyy}-${mm}-01`);
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">Transaksi Gudang</h1>
          <p className="text-sm text-gray-600">Daftar penerimaan, pengeluaran, dan penyesuaian stok.</p>
        </div>
        <Link
          href="/gudang/transaksi/tambah"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm ring-1 ring-indigo-500/20 transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Transaksi Baru
        </Link>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid items-end gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="mb-1 block text-sm font-medium text-gray-700">Cari</label>
            <div className="relative">
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setQ(qDraft.trim());
                }}
                className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm text-gray-900 outline-none ring-1 ring-transparent transition placeholder:text-gray-400 focus:ring-indigo-200"
                placeholder="No/keterangan/referensi…"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Jenis</label>
            <select
              value={jenis}
              onChange={(e) => {
                setJenis(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none ring-1 ring-transparent transition focus:ring-indigo-200"
            >
              <option value="">(semua)</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="ADJ">ADJ</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Dari</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none ring-1 ring-transparent transition focus:ring-indigo-200"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Sampai</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none ring-1 ring-transparent transition focus:ring-indigo-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 md:col-span-1">
            <button
              onClick={() => setPage(1)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
              title="Terapkan filter"
            >
              <Filter className="h-4 w-4" />
              Terapkan
            </button>
          </div>

          {/* Quick presets + reset */}
          <div className="md:col-span-12 flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Preset:</span>
              <button
                onClick={setToday}
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
              >
                Hari ini
              </button>
              <button
                onClick={setLast7}
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
              >
                7 hari
              </button>
              <button
                onClick={setThisMonth}
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
              >
                Bulan ini
              </button>
              {activeFilters > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                  {activeFilters} filter aktif
                </span>
              )}
            </div>

            <button
              onClick={() => {
                setQDraft("");
                setQ("");
                setJenis("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
              title="Reset semua filter"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset filter
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-center justify-between">
          <div>{error}</div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded border border-rose-200 bg-white px-3 py-1.5 text-rose-700 hover:bg-rose-50"
          >
            <RefreshCw className="h-4 w-4" />
            Coba lagi
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <Th className="text-left">No</Th>
              <Th className="text-left">Tanggal</Th>
              <Th className="text-left">Jenis</Th>
              <Th className="text-left">Referensi</Th>
              <Th className="text-left">Keterangan</Th>
              <Th className="text-right">Lines</Th>
              <Th className="text-right w-28">Aksi</Th>
            </tr>
          </thead>

        <tbody className="text-gray-900">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-t">
                <td className="px-3 py-3" colSpan={7}>
                  <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                </td>
              </tr>
            ))}

          {!loading &&
            rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50/50">
                <td className="px-3 py-2">
                  <Link
                    href={`/gudang/transaksi/${r.id}`}
                    className="font-medium text-indigo-700 underline-offset-2 hover:underline"
                  >
                    {r.noTransaksi}
                  </Link>
                </td>
                <td className="px-3 py-2">{fmtDateTime(r.tanggal)}</td>
                <td className="px-3 py-2">
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                      jenisPill(r.jenis)
                    )}
                    title={r.jenis}
                  >
                    {r.jenis}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="line-clamp-1" title={r.referensi || ""}>
                    {r.referensi || "—"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="line-clamp-1" title={r.keterangan || ""}>
                    {r.keterangan || "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                    {r._count?.lines ?? 0}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/gudang/transaksi/${r.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 px-3 py-1.5 text-indigo-700 hover:bg-indigo-50"
                  >
                    Detail
                  </Link>
                </td>
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                Tidak ada data.{" "}
                <Link href="/gudang/transaksi/tambah" className="text-indigo-700 underline-offset-2 hover:underline">
                  Buat transaksi baru
                </Link>
                .
              </td>
            </tr>
          )}
        </tbody>
        </table>

        {/* footer / pager */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-700">
          <div>
            {count > 0 ? (
              <>
                Menampilkan <span className="font-semibold text-gray-900">{showingFrom}</span>–
                <span className="font-semibold text-gray-900">{showingTo}</span> dari{" "}
                <span className="font-semibold text-gray-900">{count}</span> data
              </>
            ) : (
              <>0 data</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Hal {page} / {totalPages}
            </span>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50 hover:bg-gray-50"
            >
              Prev
            </button>
            <button
              disabled={page * size >= count}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========= Small UI helpers ========= */
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cx("px-3 py-2 font-semibold text-xs uppercase tracking-wide", className)}>
      {children}
    </th>
  );
}
