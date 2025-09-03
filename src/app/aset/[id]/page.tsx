// app/aset/[id]/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Filter as FilterIcon, RotateCcw, Pencil } from "lucide-react";
import useToast from "@/components/Toast";

/* =========================
 * Types (longgar agar tahan perubahan API)
 * ========================= */
type AsetHeader = {
  id: number;
  nia: string;
  nama: string;
  kategori: string;
  lokasi: string | null;
  tahun: number | null;
  nilai: number | null;
  kondisi: string | null;
  catatan: string | null;
  summary?: { totalQty?: number; totalRp?: number };
};

type PemakaianRow = {
  id: number;
  tanggal: string | null;
  nomor: string | null;
  referensi: string | null;
  item: {
    id: number;
    kode: string;
    nama: string;
    satuan: string | null;
  };
  qty: number;
  hargaRp: number;
  totalRp: number;
  catatan?: string | null;
};

/* =========================
 * Utils
 * ========================= */
const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";
const fmtNum = (n: number) => (Number.isFinite(n) ? n.toLocaleString("id-ID") : "0");
const fmtRp = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

/* =========================
 * Page
 * ========================= */
export default function AsetDetailPage() {
  const params = useParams();
  const asetId = Number((params as any)?.id);

  const { View, push } = useToast();

  // header
  const [header, setHeader] = React.useState<AsetHeader | null>(null);

  // filter pemakaian
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  // data pemakaian
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [size] = React.useState(50);
  const [rows, setRows] = React.useState<PemakaianRow[]>([]);
  const [count, setCount] = React.useState(0);
  const [totalQty, setTotalQty] = React.useState(0);
  const [totalRp, setTotalRp] = React.useState(0);

  // load header once
  React.useEffect(() => {
    if (!asetId) return;
    (async () => {
      try {
        const res = await fetch(`/api/aset/${asetId}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal memuat aset");
        setHeader(data);
        if (data?.summary) {
          setTotalQty(Number(data.summary.totalQty || 0));
          setTotalRp(Number(data.summary.totalRp || 0));
        }
      } catch (e: any) {
        push(`❌ ${e.message}`, "err");
      }
    })();
  }, [asetId, push]);

  // normalisasi row dari API pemakaian -> sesuai kebutuhan UI
  const normalizeRows = (list: any[]): PemakaianRow[] =>
    (list || []).map((r) => {
      const qty = Number(r.qty || 0);
      const hpp = Number(r.hpp ?? r.hargaRp ?? 0);
      const total = Number(r.total ?? r.totalRp ?? qty * hpp);
      const satuanStr = r?.item?.satuan?.nama ?? r?.item?.satuan ?? null;

      return {
        id: Number(r.id),
        tanggal: r.tanggal ?? null,
        nomor: r.nomor ?? null,
        referensi: r.referensi ?? null,
        item: {
          id: Number(r?.item?.id || 0),
          kode: String(r?.item?.kode || "-"),
          nama: String(r?.item?.nama || "-"),
          satuan: satuanStr ? String(satuanStr) : null,
        },
        qty,
        hargaRp: hpp,
        totalRp: total,
        catatan: r.catatan ?? null,
      };
    });

  const loadPemakaian = React.useCallback(
    async (toPage = 1) => {
      if (!asetId) return;
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        if (dateFrom) sp.set("from", dateFrom);
        if (dateTo) sp.set("to", dateTo);
        sp.set("page", String(toPage));
        sp.set("size", String(size));

        const res = await fetch(`/api/aset/${asetId}/pemakaian?${sp.toString()}`, {
          cache: "no-store",
        });
        const data: any = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal memuat pemakaian");

        setRows(normalizeRows(data.rows ?? []));
        setCount(Number(data.count ?? 0));
        setPage(toPage);

        const tq = Number(data.totalQty ?? data.sumQty ?? 0);
        const trp = Number(data.totalRp ?? data.sumRp ?? 0);
        setTotalQty(tq);
        setTotalRp(trp);

        if (data.aset) setHeader(data.aset);
      } catch (e: any) {
        push(`❌ ${e.message}`, "err");
        setRows([]);
        setCount(0);
        setTotalQty(0);
        setTotalRp(0);
      } finally {
        setLoading(false);
      }
    },
    [asetId, dateFrom, dateTo, size, push]
  );

  React.useEffect(() => {
    if (asetId) loadPemakaian(1);
  }, [asetId, loadPemakaian]);

  const reset = () => {
    setDateFrom("");
    setDateTo("");
    setRows([]);
    setCount(0);
    setTotalQty(0);
    setTotalRp(0);
    setPage(1);
  };

  const fromIdx = Math.min((page - 1) * size + 1, Math.max(count, 1));
  const toIdx = Math.min(page * size, count);

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Detail Aset</h1>
          <p className="text-[13px] text-gray-700">Lihat ringkasan aset & riwayat pemakaian material.</p>
        </div>

        <div className="flex items-center gap-2">
          {asetId ? (
            <Link
              href={`/aset/${asetId}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          ) : null}

          <Link
            href="/aset"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" /> Kembali ke Aset
          </Link>
        </div>
      </div>

      {/* Info Aset & Ringkasan */}
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">Informasi Aset</div>
          {header ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
              <div className="text-gray-600">NIA</div><div className="font-semibold">{header.nia}</div>
              <div className="text-gray-600">Nama</div><div className="font-semibold">{header.nama}</div>
              <div className="text-gray-600">Kategori</div><div className="font-semibold">{header.kategori}</div>
              <div className="text-gray-600">Lokasi</div><div className="font-semibold">{header.lokasi || "-"}</div>
              <div className="text-gray-600">Tahun</div><div className="font-semibold">{header.tahun ?? "-"}</div>
              <div className="text-gray-600">Nilai Perolehan</div><div className="font-semibold">{fmtRp(header.nilai ?? 0)}</div>
              <div className="text-gray-600">Kondisi</div><div className="font-semibold">{header.kondisi || "-"}</div>
              <div className="text-gray-600">Catatan</div><div className="font-semibold">{header.catatan || "-"}</div>
            </div>
          ) : (
            <div className="text-[14px] text-gray-700">Memuat…</div>
          )}
        </div>

        <div className="md:col-span-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">Ringkasan Pemakaian</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
            <div className="text-gray-600">Total Qty</div><div className="font-semibold">{fmtNum(totalQty)}</div>
            <div className="text-gray-600">Total Nilai (Rp)</div><div className="font-semibold">{fmtRp(totalRp)}</div>
          </div>
        </div>
      </div>

      {/* Filter Pemakaian */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">Filter Pemakaian</div>
        <div className="grid items-end gap-3 md:grid-cols-12">
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

          <div className="md:col-span-6 flex items-center justify-end gap-2">
            <button
              onClick={() => loadPemakaian(1)}
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

      {/* Tabel Pemakaian */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-[14px]">
          <thead className="bg-gray-50">
            <tr className="text-gray-800">
              <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
              <th className="px-3 py-2 text-left font-semibold">No</th>
              <th className="px-3 py-2 text-left font-semibold">Referensi</th>
              <th className="px-3 py-2 text-left font-semibold">Item</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">HPP/Unit (Rp)</th>
              <th className="px-3 py-2 text-right font-semibold">Total (Rp)</th>
              <th className="px-3 py-2 text-left font-semibold">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-700">Memuat…</td></tr>
            )}

            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-700">Tidak ada pemakaian pada rentang ini.</td></tr>
            )}

            {!loading && rows.map((r, i) => (
              <tr key={r.id} className={`${i % 2 ? "bg-gray-50/40" : "bg-white"} border-t`}>
                <td className="px-3 py-2">{fmtDateTime(r.tanggal)}</td>
                <td className="px-3 py-2">{r.nomor ?? "-"}</td>
                <td className="px-3 py-2">{r.referensi ?? "-"}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{r.item.kode}</div>
                  <div className="text-xs text-gray-700">{r.item.nama}</div>
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtNum(r.qty)}{r.item.satuan ? ` ${r.item.satuan}` : ""}
                </td>
                <td className="px-3 py-2 text-right">{fmtRp(r.hargaRp ?? 0)}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmtRp(r.totalRp ?? 0)}</td>
                <td className="px-3 py-2">{r.catatan ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pager */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-[13px] text-gray-800">
          <div>
            {count > 0 ? <>Menampilkan <b>{fromIdx}</b>–<b>{toIdx}</b> dari <b>{count}</b> mutasi</> : <>0 mutasi</>}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => loadPemakaian(page - 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page * size >= count}
              onClick={() => loadPemakaian(page + 1)}
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
