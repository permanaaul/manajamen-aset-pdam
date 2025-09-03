"use client";

import React from "react";
import Link from "next/link";
import { Plus, Filter as FilterIcon, RotateCcw } from "lucide-react";
import useToast from "@/components/Toast";

type Row = {
  id: number;
  no: string;
  tanggal: string | null;
  aset: { id: number; nia: string; nama: string } | null;
  pelaksana: string | null;
  jenis: string | null;
  status: string | null;
  biaya: number | null;
  catatan: string | null;
  jumlahItem: number;
};

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";
const fmtRp = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    : "Rp 0";

export default function PemeliharaanList() {
  const { View, push } = useToast();

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const [rows, setRows] = React.useState<Row[]>([]);
  const [count, setCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [size] = React.useState(20);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (toPage = 1) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (status) sp.set("status", status);
      if (dateFrom) sp.set("dateFrom", dateFrom);
      if (dateTo) sp.set("dateTo", dateTo);
      sp.set("page", String(toPage));
      sp.set("size", String(size));

      const res = await fetch(`/api/pemeliharaan?${sp.toString()}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal memuat data");
      setRows(d.rows || []);
      setCount(d.count || 0);
      setPage(toPage);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setLoading(false);
    }
  }, [q, status, dateFrom, dateTo, size, push]);

  React.useEffect(() => { load(1); }, []); // awal

  const reset = () => {
    setQ(""); setStatus(""); setDateFrom(""); setDateTo("");
    setRows([]); setCount(0); setPage(1);
  };

  const from = Math.min((page - 1) * size + 1, Math.max(count, 1));
  const to = Math.min(page * size, count);

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold">Pemeliharaan</h1>
          <p className="text-[13px] text-gray-700">Kelola pekerjaan pemeliharaan aset dan konsumsi sparepart.</p>
        </div>
        <Link
          href="/pemeliharaan/tambah"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white px-3 py-2 font-semibold hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Tambah
        </Link>
      </div>

      {/* Filter */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid items-end gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1 block text-sm font-semibold">Cari</label>
            <input
              value={q} onChange={(e)=>setQ(e.target.value)} placeholder="NIA/Nama aset, pelaksana, catatan…"
              className="h-11 w-full rounded-xl border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold">Status</label>
            <select value={status} onChange={(e)=>setStatus(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">(semua)</option>
              <option value="OPEN">OPEN</option>
              <option value="SELESAI">SELESAI</option>
              <option value="BATAL">BATAL</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold">Dari</label>
            <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold">Sampai</label>
            <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <button onClick={()=>load(1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50">
              <FilterIcon className="h-4 w-4" /> Terapkan
            </button>
            <button onClick={reset}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50">
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
              <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
              <th className="px-3 py-2 text-left font-semibold">No</th>
              <th className="px-3 py-2 text-left font-semibold">Aset</th>
              <th className="px-3 py-2 text-left font-semibold">Pelaksana</th>
              <th className="px-3 py-2 text-left font-semibold">Jenis</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-right font-semibold">Biaya (Rp)</th>
              <th className="px-3 py-2 text-left font-semibold">Item</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={8} className="px-3 py-8 text-center">Memuat…</td></tr>)}
            {!loading && rows.length === 0 && (<tr><td colSpan={8} className="px-3 py-8 text-center">Tidak ada data.</td></tr>)}
            {!loading && rows.map((r, i)=>(
              <tr key={r.id} className={`${i%2?"bg-gray-50/40":"bg-white"} border-t`}>
                <td className="px-3 py-2">{fmtDateTime(r.tanggal)}</td>
                <td className="px-3 py-2">
                  <Link href={`/pemeliharaan/${r.id}`} className="font-semibold text-indigo-700 hover:underline">{r.no}</Link>
                </td>
                <td className="px-3 py-2">
                  {r.aset ? (<>
                    <div className="font-semibold">{r.aset.nia}</div>
                    <div className="text-xs text-gray-700">{r.aset.nama}</div>
                  </>) : "-"}
                </td>
                <td className="px-3 py-2">{r.pelaksana || "-"}</td>
                <td className="px-3 py-2">{r.jenis || "-"}</td>
                <td className="px-3 py-2">{r.status || "-"}</td>
                <td className="px-3 py-2 text-right">{fmtRp(r.biaya)}</td>
                <td className="px-3 py-2">{r.jumlahItem ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t px-4 py-3 text-[13px]">
          <div>{count>0? <>Menampilkan <b>{Math.min((page-1)*size+1, count)}</b>–<b>{Math.min(page*size, count)}</b> dari <b>{count}</b> data</> : <>0 data</>}</div>
          <div className="flex items-center gap-2">
            <button disabled={page<=1} onClick={()=>load(page-1)} className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">Prev</button>
            <button disabled={page*size>=count} onClick={()=>load(page+1)} className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
