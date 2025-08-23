"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ReceiptText, RefreshCcw, Search, CalendarDays, Eye } from "lucide-react";

const toIDR = (n: number = 0) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const fmtID = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("id-ID") : "—");

type Row = {
  id: number;
  tanggal: string;
  voucherNo: string;
  voucherDate?: string | null;
  ref?: string | null;
  uraian?: string | null;
  totalDebit: number;
  totalKredit: number;
  balanced: boolean;
  printCount: number;
};

export default function VoucherListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (q.trim()) sp.set("q", q.trim());
    const r = await fetch(`/api/akuntansi/voucher?${sp.toString()}`, { cache: "no-store" });
    const j = await r.json();
    setRows(Array.isArray(j) ? j : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ReceiptText className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">Voucher</h1>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm">
            <RefreshCcw size={16} /> Refresh
          </button>
        </div>

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative">
              <CalendarDays size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"/>
            </div>
            <div className="relative">
              <CalendarDays size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"/>
            </div>
            <div className="md:col-span-2 relative">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari voucher/ref/uraian…" className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"/>
            </div>
            <div>
              <button onClick={load} className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm">
                <RefreshCcw size={16}/> Terapkan
              </button>
            </div>
          </div>

          <div className="p-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">No. Voucher</th>
                  <th className="px-3 py-2 text-left">Ref / Uraian</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Kredit</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-gray-900">
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-600">Memuat…</td></tr>
                ) : rows.length ? rows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtID(r.tanggal)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">{r.voucherNo}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.uraian || r.ref || "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{toIDR(r.totalDebit)}</td>
                    <td className="px-3 py-2 text-right">{toIDR(r.totalKredit)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.balanced ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800">
                          Seimbang
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                          Tidak Seimbang
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link href={`/akuntansi/voucher/${r.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700">
                        <Eye size={14}/> Lihat
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-600">Tidak ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
