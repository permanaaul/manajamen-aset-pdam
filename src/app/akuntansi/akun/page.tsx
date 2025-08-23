// src/app/akuntansi/akun/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Layers, PlusCircle, RefreshCw, Search, Filter, CheckCircle2, XCircle, Info,
  Coins, Landmark, PiggyBank, TrendingUp, Receipt, MinusCircle,
} from "lucide-react";

/* ================= types ================= */
type AkunType =
  | "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | "CONTRA_ASSET" | "CONTRA_REVENUE";
type NormalBalance = "DEBIT" | "CREDIT";

type Akun = {
  id: number;
  kode: string;
  nama: string;
  tipe: AkunType;
  normal: NormalBalance;
  parentId?: number | null;
  parent?: { id: number; kode: string; nama: string } | null;
  isActive?: boolean | null;
  createdAt?: string;
};

/* ================= helpers ================= */
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("id-ID") : "—");
const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/* ================= small UI ================= */
function Stat({
  tone = "default", icon, title, value, sub,
}: {
  tone?: "default" | "blue" | "emerald" | "rose" | "violet" | "amber" | "slate";
  icon: React.ReactNode; title: string; value: string | number; sub?: string;
}) {
  const toneMap: Record<string, string> = {
    default: "bg-gray-50 border-gray-200",
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    rose: "bg-rose-50 border-rose-100",
    violet: "bg-violet-50 border-violet-100",
    amber: "bg-amber-50 border-amber-100",
    slate: "bg-slate-50 border-slate-200",
  };
  return (
    <div className={cn("rounded-2xl border p-4 flex items-center gap-3", toneMap[tone])}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-600">{title}</div>
        <div className="text-xl font-bold text-gray-900 leading-tight">{value}</div>
        {sub ? <div className="text-xs text-gray-500">{sub}</div> : null}
      </div>
    </div>
  );
}

/* ================= page ================= */
export default function AkunListPage() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);

  // data
  const [rows, setRows] = useState<Akun[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [tipe, setTipe] = useState<"SEMUA" | AkunType>("SEMUA");
  const [normal, setNormal] = useState<"SEMUA" | NormalBalance>("SEMUA");
  const [status, setStatus] = useState<"SEMUA" | "AKTIF" | "NONAKTIF">("SEMUA");

  // role guard
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { window.location.href = "/login"; return; }
    const u = JSON.parse(raw);
    setUser(u);
    if (!["ADMIN", "PIMPINAN"].includes(u.role)) window.location.href = "/forbidden";
  }, []);

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/akuntansi/akun?onlyActive=false", { cache: "no-store" });
      const j = r.ok ? await r.json() : [];
      setRows(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat akun.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = [...rows];
    const key = q.trim().toLowerCase();
    if (key) list = list.filter(
      a => a.kode.toLowerCase().includes(key) ||
           a.nama.toLowerCase().includes(key) ||
          (a.parent?.nama || "").toLowerCase().includes(key)
    );
    if (tipe !== "SEMUA") list = list.filter(a => a.tipe === tipe);
    if (normal !== "SEMUA") list = list.filter(a => a.normal === normal);
    if (status !== "SEMUA") list = list.filter(a => (a.isActive ?? true) === (status === "AKTIF"));
    return list.sort((a, b) => a.kode.localeCompare(b.kode));
  }, [rows, q, tipe, normal, status]);

  const stats = useMemo(() => {
    const total = rows.length;
    const aktif = rows.filter(r => r.isActive ?? true).length;
    const non = total - aktif;
    const byType = (t: AkunType) => rows.filter(r => r.tipe === t).length;
    return { total, aktif, non, byType };
  }, [rows]);

  if (!user) return null;

  // === FIX: definisikan kolom via array agar tidak ada whitespace di dalam <colgroup> ===
  const COLS = ["w-[88px]", "", "w-[130px]", "w-[110px]", "w-[280px]", "w-[120px]", "w-[120px]", "w-[90px]"];

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">Akun (COA)</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm" title="Muat ulang">
              <RefreshCw size={16} /> Muat ulang
            </button>
            <Link href="/akuntansi/akun/tambah" className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700" title="Tambah akun">
              <PlusCircle size={16} /> Tambah
            </Link>
          </div>
        </div>

        {/* Insight cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat tone="slate" icon={<Layers size={18} className="text-gray-700" />} title="Total Akun" value={stats.total} />
          <Stat tone="emerald" icon={<CheckCircle2 size={18} className="text-emerald-700" />} title="Aktif" value={stats.aktif} />
          <Stat tone="rose" icon={<XCircle size={18} className="text-rose-700" />} title="Nonaktif" value={stats.non} />
          <Stat tone="amber" icon={<Coins size={18} className="text-amber-700" />} title="Asset" value={stats.byType("ASSET")} />
          <Stat tone="violet" icon={<Landmark size={18} className="text-violet-700" />} title="Liability" value={stats.byType("LIABILITY")} />
          <Stat tone="blue" icon={<TrendingUp size={18} className="text-blue-700" />} title="Revenue" value={stats.byType("REVENUE")} />
        </section>

        {/* Filter */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm sticky top-0 z-10">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-600" />
              <span className="font-semibold text-gray-900">Filter</span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Info size={14} /> Cari bisa berdasarkan <b>kode / nama / induk</b>.
              </span>
            </div>
            {(q || tipe !== "SEMUA" || normal !== "SEMUA" || status !== "SEMUA") && (
              <button
                onClick={() => { setQ(""); setTipe("SEMUA"); setNormal("SEMUA"); setStatus("SEMUA"); }}
                className="text-sm border px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50"
                title="Bersihkan filter"
              >
                Bersihkan
              </button>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari: kode / nama / induk…"
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"
              />
            </div>

            <select value={tipe} onChange={(e) => setTipe(e.target.value as any)} className="border border-gray-300 rounded-lg px-2 py-2 bg-white text-gray-900" title="Filter tipe akun">
              <option value="SEMUA">Semua Tipe</option>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="EQUITY">Equity</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expense</option>
              <option value="CONTRA_ASSET">Contra Asset</option>
              <option value="CONTRA_REVENUE">Contra Revenue</option>
            </select>

            <select value={normal} onChange={(e) => setNormal(e.target.value as any)} className="border border-gray-300 rounded-lg px-2 py-2 bg-white text-gray-900" title="Normal balance">
              <option value="SEMUA">Semua Normal</option>
              <option value="DEBIT">Debit</option>
              <option value="CREDIT">Credit</option>
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="border border-gray-300 rounded-lg px-2 py-2 bg-white text-gray-900" title="Status">
              <option value="SEMUA">Semua Status</option>
              <option value="AKTIF">Aktif</option>
              <option value="NONAKTIF">Nonaktif</option>
            </select>
          </div>
        </section>

        {/* Table */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="p-5 overflow-x-auto">
            <table className="min-w-full table-fixed text-sm border-separate [border-spacing:0]">
              {/* === FIXED: render <col> via array agar tidak ada whitespace di <colgroup> === */}
              <colgroup>
                {COLS.map((c, i) => <col key={i} className={c || undefined} />)}
              </colgroup>

              <thead className="bg-gray-900 text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Kode</th>
                  <th className="px-3 py-2 text-left">Nama</th>
                  <th className="px-3 py-2 text-left">Tipe</th>
                  <th className="px-3 py-2 text-left">Normal</th>
                  <th className="px-3 py-2 text-left">Induk</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Dibuat</th>
                  <th className="px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-gray-900">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-3 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-3 w-40 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-5 w-24 bg-gray-200 rounded-full animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-3 w-52 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-7 w-16 bg-gray-200 rounded animate-pulse" /></td>
                    </tr>
                  ))
                ) : err ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6">
                      <div className="flex items-center gap-2 text-red-700">
                        <Info size={16} /><span>{err}</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length ? (
                  filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono whitespace-nowrap align-middle">{a.kode}</td>
                      <td className="px-3 py-2 align-middle">
                        <div className="truncate max-w-[420px]">{a.nama}</div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                          a.tipe === "ASSET" ? "bg-amber-100 text-amber-800"
                            : a.tipe === "LIABILITY" ? "bg-violet-100 text-violet-800"
                            : a.tipe === "EQUITY" ? "bg-emerald-100 text-emerald-800"
                            : a.tipe === "REVENUE" ? "bg-blue-100 text-blue-800"
                            : a.tipe === "EXPENSE" ? "bg-rose-100 text-rose-800"
                            : "bg-gray-200 text-gray-800"
                        }`}>
                          {a.tipe}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                          a.normal === "DEBIT" ? "bg-emerald-100 text-emerald-800" : "bg-violet-100 text-violet-800"
                        }`}>{a.normal}</span>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {a.parent ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 truncate max-w-[260px]">
                            {a.parent.kode} — {a.parent.nama}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle">
                        {(a.isActive ?? true)
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800"><CheckCircle2 size={14} /> Aktif</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-800"><XCircle size={14} /> Nonaktif</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle">{fmtDate(a.createdAt)}</td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle">
                        <Link href={`/akuntansi/akun/${a.id}`} className="text-blue-600 hover:underline" title="Edit akun">Edit</Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-600">Tidak ada data akun.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
