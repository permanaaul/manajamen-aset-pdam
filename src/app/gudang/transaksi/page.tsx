"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Filter, Plus, RotateCcw, RefreshCw, ChevronRight } from "lucide-react";
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
const cx = (...cls: Array<string | false | null | undefined>) => cls.filter(Boolean).join(" ");

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

const jenisPill = (jenis: Row["jenis"]) =>
  jenis === "IN"
    ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30"
    : jenis === "OUT"
    ? "bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/30"
    : "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30";

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

/* ========= Small UI helpers ========= */
function GlassCard({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cx(
      "rounded-2xl border border-white/10 bg-white/5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/7.5",
      className
    )}>
      {children}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cx("px-3 py-2 text-xs font-semibold uppercase tracking-wide", className)}>{children}</th>
  );
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
    <main className="min-h-dvh bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto w-full max-w-none px-6 py-6 space-y-6">
        <View />

        {/* Sticky header */}
        <div className="sticky top-0 z-10 -mx-6 border-b border-white/10 bg-slate-950/70 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Transaksi Gudang</h1>
              <p className="text-[12px] text-slate-400">Daftar penerimaan, pengeluaran, dan penyesuaian stok.</p>
            </div>
            <Link
              href="/gudang/transaksi/tambah"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-medium text-slate-900 shadow-sm ring-1 ring-black/10 transition hover:opacity-90 active:scale-[.98]"
            >
              <Plus className="h-4 w-4" />
              Transaksi Baru
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <GlassCard className="p-4">
          <div className="grid items-end gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="mb-1 block text-xs font-medium text-slate-300">Cari</label>
              <div className="relative">
                <input
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setQ(qDraft.trim());
                  }}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:ring-white/20"
                  placeholder="No/keterangan/referensi…"
                />
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-300">Jenis</label>
              <select
                value={jenis}
                onChange={(e) => {
                  setJenis(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:ring-white/20"
              >
                <option value="">(semua)</option>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
                <option value="ADJ">ADJ</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-300">Dari</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:ring-white/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-300">Sampai</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:ring-white/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 md:col-span-1">
              <button
                onClick={() => setPage(1)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-white/10"
                title="Terapkan filter"
              >
                <Filter className="h-4 w-4" />
                Terapkan
              </button>
            </div>

            {/* Quick presets + reset */}
            <div className="md:col-span-12 flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Preset:</span>
                <button
                  onClick={setToday}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-200 transition hover:bg-white/10"
                >
                  Hari ini
                </button>
                <button
                  onClick={setLast7}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-200 transition hover:bg-white/10"
                >
                  7 hari
                </button>
                <button
                  onClick={setThisMonth}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-200 transition hover:bg-white/10"
                >
                  Bulan ini
                </button>
                {activeFilters > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/10">
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
                className="inline-flex h-8 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-white/10"
                title="Reset semua filter"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filter
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Error banner */}
        {error && (
          <GlassCard className="border-rose-300/30 bg-rose-400/10">
            <div className="flex items-center justify-between px-4 py-3 text-sm text-rose-200">
              <div>{error}</div>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 rounded border border-rose-300/30 bg-white/5 px-3 py-1.5 text-rose-100 transition hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
                Coba lagi
              </button>
            </div>
          </GlassCard>
        )}

        {/* Table */}
        <GlassCard>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="font-semibold text-white">Daftar Transaksi</div>
            <div className="text-sm text-slate-300">
              {count > 0 ? (
                <>
                  Menampilkan <span className="font-semibold text-white">{showingFrom}</span>–
                  <span className="font-semibold text-white">{showingTo}</span> dari {" "}
                  <span className="font-semibold text-white">{count}</span>
                </>
              ) : (
                <>0 data</>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <Th className="text-left">No</Th>
                  <Th className="text-left">Tanggal</Th>
                  <Th className="text-left">Jenis</Th>
                  <Th className="text-left">Referensi</Th>
                  <Th className="text-left">Keterangan</Th>
                  <Th className="text-right">Lines</Th>
                  <Th className="w-28 text-right">Aksi</Th>
                </tr>
              </thead>

              <tbody className="text-slate-100">
                {loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="border-t border-white/10">
                      <td className="px-3 py-3" colSpan={7}>
                        <div className="h-3 w-full animate-pulse rounded bg-slate-700/60" />
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  rows.map((r) => (
                    <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 py-2">
                        <Link
                          href={`/gudang/transaksi/${r.id}`}
                          className="font-medium text-indigo-300 underline-offset-2 hover:underline"
                        >
                          {r.noTransaksi}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{fmtDateTime(r.tanggal)}</td>
                      <td className="px-3 py-2">
                        <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", jenisPill(r.jenis))}>
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
                        <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-white ring-1 ring-white/10">
                          {r._count?.lines ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/gudang/transaksi/${r.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100 transition hover:bg-white/10"
                        >
                          Detail <ChevronRight className="h-4 w-4 text-slate-400" />
                        </Link>
                      </td>
                    </tr>
                  ))}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-300">
                      Tidak ada data. {" "}
                      <Link href="/gudang/transaksi/tambah" className="text-indigo-300 underline-offset-2 hover:underline">
                        Buat transaksi baru
                      </Link>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* footer / pager */}
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-slate-300">
            <div>
              {count > 0 ? (
                <>
                  Menampilkan <span className="font-semibold text-white">{showingFrom}</span>–
                  <span className="font-semibold text-white">{showingTo}</span> dari {" "}
                  <span className="font-semibold text-white">{count}</span> data
                </>
              ) : (
                <>0 data</>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Hal {page} / {totalPages}</span>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                disabled={page * size >= count}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}