"use client";

import React from "react";
import Link from "next/link";
import { Search, RotateCcw, Plus, ChevronLeft } from "lucide-react";
import useToast from "@/components/Toast";

type AsetRow = {
  id: number;
  nia: string;
  nama: string;
  kategori: string;
  lokasi: string | null;
  tahun: number | null;
  nilai: number | null;
  kondisi: string | null;
};

type ListResp = {
  rows: AsetRow[];
  count: number;
  page: number;
  size: number;
};

const fmtRp = (n?: number | null) =>
  typeof n === "number" ? n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }) : "Rp 0";

export default function AsetPage() {
  const { View, push } = useToast();
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [size] = React.useState(15);
  const [rows, setRows] = React.useState<AsetRow[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (toPage = 1) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      sp.set("page", String(toPage));
      sp.set("size", String(size));

      const res = await fetch(`/api/aset?${sp.toString()}`, { cache: "no-store" });
      const data: ListResp | any = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat aset");
      setRows(data.rows ?? []);
      setCount(data.count ?? 0);
      setPage(toPage);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [q, size, push]);

  React.useEffect(() => { load(1); /* initial */ }, []); // eslint-disable-line

  const reset = () => {
    setQ("");
    load(1);
  };

  const from = Math.min((page - 1) * size + 1, Math.max(count, 1));
  const to = Math.min(page * size, count);

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Master Aset</h1>
          <p className="text-[13px] text-gray-700">Kelola data aset. Klik baris untuk melihat detail & riwayat pemakaian material.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" /> Kembali
          </Link>
          <Link
            href="/aset/tambah"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> Tambah Aset
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">Filter</div>
        <div className="grid items-end gap-3 md:grid-cols-12">
          <div className="md:col-span-9">
            <label className="mb-1 block text-sm font-semibold text-gray-900">Cari</label>
            <div className="flex h-12 items-center rounded-xl border border-gray-300 bg-white px-3">
              <Search className="mr-2 h-5 w-5 shrink-0 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ketik NIA / nama / kategori / lokasi…"
                className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="md:col-span-3 flex items-center justify-end gap-2">
            <button
              onClick={() => load(1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50"
            >
              Terapkan
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

      {/* Tabel */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-[14px]">
          <thead className="bg-gray-50">
            <tr className="text-gray-800">
              <th className="px-3 py-2 text-left font-semibold">NIA</th>
              <th className="px-3 py-2 text-left font-semibold">Nama</th>
              <th className="px-3 py-2 text-left font-semibold">Kategori</th>
              <th className="px-3 py-2 text-left font-semibold">Lokasi</th>
              <th className="px-3 py-2 text-right font-semibold">Tahun</th>
              <th className="px-3 py-2 text-right font-semibold">Nilai</th>
              <th className="px-3 py-2 text-left font-semibold">Kondisi</th>
              <th className="px-3 py-2 text-left font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-700">Memuat…</td></tr>
            )}

            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-700">Tidak ada data. Klik <b>Tambah Aset</b> untuk membuat entri.</td></tr>
            )}

            {!loading && rows.map((r, i) => (
              <tr key={r.id} className={`${i % 2 ? "bg-gray-50/40" : "bg-white"} border-t`}>
                <td className="px-3 py-2">{r.nia}</td>
                <td className="px-3 py-2 font-semibold">{r.nama}</td>
                <td className="px-3 py-2">{r.kategori}</td>
                <td className="px-3 py-2">{r.lokasi ?? "-"}</td>
                <td className="px-3 py-2 text-right">{r.tahun ?? "-"}</td>
                <td className="px-3 py-2 text-right">{fmtRp(r.nilai)}</td>
                <td className="px-3 py-2">{r.kondisi ?? "-"}</td>
                <td className="px-3 py-2">
                  <Link
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm font-medium hover:bg-gray-50"
                    href={`/aset/${r.id}`}
                  >
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pager */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-[13px] text-gray-800">
          <div>
            {count > 0 ? <>Menampilkan <b>{from}</b>–<b>{to}</b> dari <b>{count}</b> aset</> : <>0 aset</>}
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
