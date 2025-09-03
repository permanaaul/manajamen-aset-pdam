// app/gudang/kartu-stok/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronDown,
  Check,
  Search,
  Filter as FilterIcon,
  RotateCcw,
  X,
} from "lucide-react";
import useToast from "@/components/Toast";

/* ================= Types ================= */
type LookupItem = { id: number; kode: string; nama: string; satuan?: string | null };

type Row = {
  id: number;
  tanggal: string | null;
  nomor: string | null;
  jenis: "IN" | "OUT" | "ADJ";
  referensi: string | null;
  catatan: string | null;
  hargaRp: number | null;
  inQty: number;
  outQty: number;
  saldo: number;
  hppUnit: number;
  nilaiMasukRp: number;
  nilaiKeluarRp: number;
  saldoRp: number;
};

type KartuResponse = {
  item: { id: number; kode: string; nama: string; satuan?: string | null };
  saldoAwal: number;
  saldoAwalRp: number;
  hppAwal: number;
  saldoAkhir: number;
  saldoAkhirRp: number;
  hppAkhir: number;
  total: { in: number; out: number; adjPlus: number; adjMinus: number; nilaiInRp: number; nilaiOutRp: number };
  rows: Row[];
  count: number;
  page: number;
  size: number;
};

/* ================= Helpers ================= */
const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";
const fmtQty = (n: number) => (Number.isFinite(n) ? n.toLocaleString("id-ID") : "0");
const fmtRp = (n: number) =>
  `Rp ${Number.isFinite(n) ? Math.round(n).toLocaleString("id-ID") : "0"}`;

const Pill = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-[2px] text-xs font-semibold ${className}`}>
    {children}
  </span>
);

/* ================= Page ================= */
export default function KartuStokPage() {
  const { View, push } = useToast();

  // Filter state
  const [itemPicked, setItemPicked] = React.useState<LookupItem | null>(null);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  // Combobox state
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<LookupItem[]>([]);
  const [loadingLookup, setLoadingLookup] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(-1);

  // Data state
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [size] = React.useState(50);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [count, setCount] = React.useState(0);
  const [summary, setSummary] = React.useState<
    Pick<
      KartuResponse,
      "saldoAwal" | "saldoAwalRp" | "hppAwal" | "saldoAkhir" | "saldoAkhirRp" | "hppAkhir" | "total" | "item"
    > | null
  >(null);

  /* ---------- Combobox fetch (debounced) ---------- */
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      setLoadingLookup(true);
      try {
        const res = await fetch(`/api/gudang/lookup?type=item&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const rowsRes: LookupItem[] = res.ok ? (data?.rows || []) : [];
        setSuggestions(rowsRes.slice(0, 20));
        setActiveIdx(rowsRes.length ? 0 : -1);
      } catch {
        setSuggestions([]);
        setActiveIdx(-1);
      } finally {
        setLoadingLookup(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [open, query]);

  const pick = (it: LookupItem) => {
    setItemPicked(it);
    setQuery(`${it.kode} — ${it.nama}`);
    setOpen(false);
    setActiveIdx(-1);
  };

  const clearPick = () => {
    setItemPicked(null);
    setQuery("");
    setSuggestions([]);
    setActiveIdx(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = suggestions[Math.max(0, activeIdx)];
      if (it) pick(it);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  /* ---------- Load kartu stok ---------- */
  const load = React.useCallback(
    async (toPage = 1) => {
      if (!itemPicked?.id) {
        push("Pilih item terlebih dahulu.", "err");
        return;
      }
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set("itemId", String(itemPicked.id));
        if (dateFrom) sp.set("dateFrom", dateFrom);
        if (dateTo) sp.set("dateTo", dateTo);
        sp.set("page", String(toPage));
        sp.set("size", String(size));

        const res = await fetch(`/api/gudang/kartu-stok?${sp.toString()}`);
        const data: KartuResponse = await res.json();
        if (!res.ok) throw new Error((data as any)?.error || "Gagal memuat kartu stok");

        setRows(data.rows || []);
        setCount(data.count || 0);
        setSummary({
          item: data.item,
          saldoAwal: data.saldoAwal ?? 0,
          saldoAwalRp: data.saldoAwalRp ?? 0,
          hppAwal: data.hppAwal ?? 0,
          saldoAkhir: data.saldoAkhir ?? 0,
          saldoAkhirRp: data.saldoAkhirRp ?? 0,
          hppAkhir: data.hppAkhir ?? 0,
          total: data.total || {
            in: 0,
            out: 0,
            adjPlus: 0,
            adjMinus: 0,
            nilaiInRp: 0,
            nilaiOutRp: 0,
          },
        });
        setPage(toPage);
      } catch (e: any) {
        push(`❌ ${e.message}`, "err");
        setRows([]);
        setCount(0);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    [itemPicked?.id, dateFrom, dateTo, size, push]
  );

  const reset = () => {
    clearPick();
    setDateFrom("");
    setDateTo("");
    setRows([]);
    setCount(0);
    setSummary(null);
    setPage(1);
  };

  const showingFrom = Math.min((page - 1) * size + 1, Math.max(count, 1));
  const showingTo = Math.min(page * size, count);

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Kartu Stok</h1>
          <p className="text-[13px] text-gray-700">
            Lihat riwayat mutasi <b>IN</b>, <b>OUT</b>, dan <b>ADJ</b> per item beserta saldo berjalan & nilai (Rp).
          </p>
        </div>
        <Link
          href="/gudang"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Kembali ke Gudang
        </Link>
      </div>

      {/* Filter */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">Filter</div>
        <div className="grid items-end gap-3 md:grid-cols-12">
          {/* Combobox Item */}
          <div className="md:col-span-6">
            <label className="mb-1 block text-sm font-semibold text-gray-900">Item</label>

            <div className="relative">
              <div
                className={`flex h-12 items-center rounded-xl border ${
                  open ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-300"
                } bg-white px-3`}
              >
                <Search className="mr-2 h-5 w-5 shrink-0 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={onKeyDown}
                  placeholder="Cari item (min. 2 huruf), lalu pilih…"
                  className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-gray-400"
                  aria-expanded={open}
                  aria-controls="item-combobox-list"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={clearPick}
                    className="ml-2 rounded-md p-1 text-gray-500 hover:bg-gray-100"
                    aria-label="Bersihkan"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4 text-gray-400" />
                )}
              </div>

              {/* Panel */}
              {open && (
                <div
                  id="item-combobox-list"
                  className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {loadingLookup && (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-700">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                      Memuat…
                    </div>
                  )}

                  {!loadingLookup && suggestions.length === 0 && (
                    <div className="px-3 py-3 text-sm text-gray-700">Tidak ada hasil.</div>
                  )}

                  {!loadingLookup &&
                    suggestions.map((it, i) => {
                      const active = i === activeIdx;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => pick(it)}
                          onMouseEnter={() => setActiveIdx(i)}
                          className={`w-full px-3 py-2 text-left ${active ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                          role="option"
                          aria-selected={active}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{it.kode}</div>
                              <div className="truncate text-sm text-gray-700">{it.nama}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {it.satuan ? <Pill className="bg-gray-100 text-gray-800">{it.satuan}</Pill> : null}
                              {active ? <Check className="h-4 w-4 text-indigo-600" /> : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="mt-1 text-[12px] text-gray-700">
              Item terpilih:{" "}
              {itemPicked ? (
                <span className="font-semibold text-gray-900">
                  {itemPicked.kode} — {itemPicked.nama}
                </span>
              ) : (
                <em>belum ada</em>
              )}
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-gray-900">Dari</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-12 w-full rounded-xl border border-gray-300 px-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-gray-900">Sampai</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-12 w-full rounded-xl border border-gray-300 px-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="md:col-span-12 flex items-center justify-end gap-2">
            <button
              onClick={() => load(1)}
              disabled={!itemPicked?.id}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              <FilterIcon className="h-4 w-4" />
              Terapkan
            </button>
            <button
              onClick={reset}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Info panels */}
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">Informasi Item</div>
          {summary ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
              <div className="text-gray-600">Kode</div>
              <div className="font-semibold">{summary.item.kode}</div>
              <div className="text-gray-600">Nama</div>
              <div className="font-semibold">{summary.item.nama}</div>
              <div className="text-gray-600">Satuan</div>
              <div className="font-semibold">{summary.item.satuan || "-"}</div>

              <div className="text-gray-600">Saldo Awal</div>
              <div className="font-semibold">{fmtQty(summary.saldoAwal)}</div>
              <div className="text-gray-600">Saldo Awal (Rp)</div>
              <div className="font-semibold">{fmtRp(summary.saldoAwalRp)}</div>
              <div className="text-gray-600">HPP Awal</div>
              <div className="font-semibold">{fmtRp(summary.hppAwal)}</div>

              <div className="text-gray-600">Saldo Akhir</div>
              <div className="font-semibold">{fmtQty(summary.saldoAkhir)}</div>
              <div className="text-gray-600">Saldo Akhir (Rp)</div>
              <div className="font-semibold">{fmtRp(summary.saldoAkhirRp)}</div>
              <div className="text-gray-600">HPP Akhir</div>
              <div className="font-semibold">{fmtRp(summary.hppAkhir)}</div>
            </div>
          ) : (
            <div className="text-[14px] text-gray-700">
              Pilih item lalu klik <b>Terapkan</b>.
            </div>
          )}
        </div>

        <div className="md:col-span-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">Ringkasan Mutasi</div>
          {summary ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <Pill className="bg-emerald-100 text-emerald-800">IN: {fmtQty(summary.total.in)}</Pill>
              <Pill className="bg-rose-100 text-rose-800">OUT: {fmtQty(summary.total.out)}</Pill>
              <Pill className="bg-sky-100 text-sky-800">ADJ +: {fmtQty(summary.total.adjPlus)}</Pill>
              <Pill className="bg-amber-100 text-amber-800">ADJ -: {fmtQty(summary.total.adjMinus)}</Pill>
              <div className="w-full" />
              <Pill className="bg-emerald-50 text-emerald-800">Nilai IN: {fmtRp(summary.total.nilaiInRp)}</Pill>
              <Pill className="bg-rose-50 text-rose-800">Nilai OUT: {fmtRp(summary.total.nilaiOutRp)}</Pill>
            </div>
          ) : (
            <div className="text-[14px] text-gray-700">—</div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-[14px]">
          <thead className="bg-gray-50">
            <tr className="text-gray-800">
              <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
              <th className="px-3 py-2 text-left font-semibold">No</th>
              <th className="px-3 py-2 text-left font-semibold">Jenis</th>
              <th className="px-3 py-2 text-left font-semibold">Referensi</th>
              <th className="px-3 py-2 text-right font-semibold">Masuk</th>
              <th className="px-3 py-2 text-right font-semibold">Keluar</th>
              <th className="px-3 py-2 text-right font-semibold">HPP / Unit</th>
              <th className="px-3 py-2 text-right font-semibold">Nilai Masuk (Rp)</th>
              <th className="px-3 py-2 text-right font-semibold">Nilai Keluar (Rp)</th>
              <th className="px-3 py-2 text-right font-semibold">Saldo</th>
              <th className="px-3 py-2 text-right font-semibold">Saldo Nilai (Rp)</th>
              <th className="px-3 py-2 text-left font-semibold">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-700">
                  Memuat…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-700">
                  Tidak ada data
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((r, idx) => {
                const leftBorder =
                  r.jenis === "IN"
                    ? "border-emerald-400"
                    : r.jenis === "OUT"
                    ? "border-rose-400"
                    : "border-amber-400";
                return (
                  <tr key={r.id} className={`${idx % 2 ? "bg-gray-50/40" : "bg-white"} border-t`}>
                    <td className={`px-3 py-2 border-l-4 ${leftBorder}`}>{fmtDateTime(r.tanggal)}</td>
                    <td className="px-3 py-2">{r.nomor || "-"}</td>
                    <td className="px-3 py-2">
                      {r.jenis === "IN" && <Pill className="bg-emerald-100 text-emerald-800">IN</Pill>}
                      {r.jenis === "OUT" && <Pill className="bg-rose-100 text-rose-800">OUT</Pill>}
                      {r.jenis === "ADJ" && <Pill className="bg-amber-100 text-amber-800">ADJ</Pill>}
                    </td>
                    <td className="px-3 py-2">{r.referensi || "-"}</td>
                    <td className="px-3 py-2 text-right">{fmtQty(r.inQty)}</td>
                    <td className="px-3 py-2 text-right">{fmtQty(r.outQty)}</td>
                    <td className="px-3 py-2 text-right">{fmtRp(r.hppUnit)}</td>
                    <td className="px-3 py-2 text-right">{fmtRp(r.nilaiMasukRp)}</td>
                    <td className="px-3 py-2 text-right">{fmtRp(r.nilaiKeluarRp)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtQty(r.saldo)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtRp(r.saldoRp)}</td>
                    <td className="px-3 py-2">{r.catatan || "-"}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* Pager */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-[13px] text-gray-800">
          <div>
            {count > 0 ? (
              <>
                Menampilkan <b>{showingFrom}</b>–<b>{showingTo}</b> dari <b>{count}</b> mutasi
              </>
            ) : (
              <>0 mutasi</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => load(page - 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page * size >= count}
              onClick={() => load(page + 1)}
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
