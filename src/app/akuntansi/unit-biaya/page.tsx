// src/app/akuntansi/unit-biaya/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Factory,
  PlusCircle,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  Pencil,
  Trash2,
  Layers,
  ShieldCheck,
  ShieldX,
  Info,
} from "lucide-react";

/* ============== Types ============== */
type Jenis =
  | "PRODUKSI"
  | "DISTRIBUSI"
  | "PELAYANAN"
  | "ADMINISTRASI"
  | "UMUM_SDM"
  | "LABORATORIUM"
  | "LAINNYA";

type Row = {
  id: number;
  kode: string;
  nama: string;
  jenis: Jenis;
  isActive?: boolean | null; // API baru
  aktif?: boolean | null;    // fallback API lama
  createdAt?: string;
};

/* ============== Helpers ============== */
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("id-ID") : "—");

const jenisColor = (t?: string | null) => {
  switch (t) {
    case "PRODUKSI":
      return "bg-blue-100 text-blue-700";
    case "DISTRIBUSI":
      return "bg-indigo-100 text-indigo-700";
    case "PELAYANAN":
      return "bg-emerald-100 text-emerald-700";
    case "ADMINISTRASI":
      return "bg-amber-100 text-amber-700";
    case "UMUM_SDM":
      return "bg-pink-100 text-pink-700";
    case "LABORATORIUM":
      return "bg-violet-100 text-violet-700";
    case "LAINNYA":
    default:
      return "bg-gray-100 text-gray-700";
  }
};

/* ============== Page ============== */
export default function UnitBiayaListPage() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);

  // data
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ui states
  const [q, setQ] = useState("");
  const [filterJenis, setFilterJenis] = useState<"SEMUA" | Jenis>("SEMUA");
  const [filterStatus, setFilterStatus] = useState<"SEMUA" | "AKTIF" | "NONAKTIF">("SEMUA");
  const [sortBy, setSortBy] = useState<"nama" | "kode" | "jenis" | "createdAt">("nama");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // role guard
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      window.location.href = "/login";
      return;
    }
    const u = JSON.parse(raw) as { nama: string; role: string };
    setUser(u);
    if (!["ADMIN", "PIMPINAN"].includes(u.role)) {
      window.location.href = "/forbidden";
    }
  }, []);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/akuntansi/unit-biaya", { cache: "no-store" });
      const j = r.ok ? await r.json() : [];
      setList(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat unit biaya.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (id: number) => {
    if (!confirm("Hapus unit biaya ini?")) return;
    try {
      const r = await fetch(`/api/akuntansi/unit-biaya/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      setList((prev) => prev.filter((x) => x.id !== id));
      setToast({ type: "ok", msg: "Unit biaya dihapus." });
      setTimeout(() => setToast(null), 1600);
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "Gagal menghapus unit." });
      setTimeout(() => setToast(null), 1600);
    }
  };

  const dataFiltered = useMemo(() => {
    let rows = [...list];

    // search
    const key = q.trim().toLowerCase();
    if (key) {
      rows = rows.filter((x) => {
        const jenis = (x.jenis ?? "").toString();
        return (
          x.kode.toLowerCase().includes(key) ||
          x.nama.toLowerCase().includes(key) ||
          jenis.toLowerCase().includes(key)
        );
      });
    }

    // filter jenis
    if (filterJenis !== "SEMUA") {
      rows = rows.filter((x) => (x.jenis ?? "") === filterJenis);
    }

    // filter status
    if (filterStatus !== "SEMUA") {
      const active = filterStatus === "AKTIF";
      rows = rows.filter((x) => (typeof x.isActive === "boolean" ? x.isActive : (x.aktif ?? true)) === active);
    }

    // sort
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "nama") return a.nama.localeCompare(b.nama) * dir;
      if (sortBy === "kode") return a.kode.localeCompare(b.kode) * dir;
      if (sortBy === "jenis") return a.jenis.localeCompare(b.jenis) * dir;
      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (ad - bd) * dir;
    });

    return rows;
  }, [list, q, filterJenis, filterStatus, sortBy, sortDir]);

  // quick stats
  const stats = useMemo(() => {
    const total = list.length;
    const active = list.filter((x) => (typeof x.isActive === "boolean" ? x.isActive : (x.aktif ?? true))).length;
    const nonactive = total - active;
    return { total, active, nonactive };
  }, [list]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50 subpixel-antialiased">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="text-blue-600" size={22} />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
                Unit Biaya
              </h1>
              <p className="text-sm text-gray-600">
                Pusat biaya untuk alokasi jurnal dan perbandingan anggaran vs realisasi.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
              title="Muat ulang"
            >
              <RefreshCw size={16} /> Muat ulang
            </button>
            <Link
              href="/akuntansi/unit-biaya/tambah"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              <PlusCircle size={16} /> Tambah
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border rounded-2xl p-4">
            <div className="flex items-center gap-2 text-gray-600 text-xs">
              <Layers size={14} /> Total Unit
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white border rounded-2xl p-4">
            <div className="flex items-center gap-2 text-gray-600 text-xs">
              <ShieldCheck size={14} /> Aktif
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{stats.active}</div>
          </div>
          <div className="bg-white border rounded-2xl p-4">
            <div className="flex items-center gap-2 text-gray-600 text-xs">
              <ShieldX size={14} /> Nonaktif
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{stats.nonactive}</div>
          </div>
        </section>

        {/* Legend */}
        <section className="bg-white border rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-gray-500">
              <Info size={14} /> Legend:
            </span>
            {(
              [
                "PRODUKSI",
                "DISTRIBUSI",
                "PELAYANAN",
                "ADMINISTRASI",
                "UMUM_SDM",
                "LABORATORIUM",
                "LAINNYA",
              ] as Jenis[]
            ).map((j) => (
              <span key={j} className={`px-2 py-0.5 rounded ${jenisColor(j)}`}>{j}</span>
            ))}
          </div>
        </section>

        {/* Toolbar */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* search */}
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari: kode / nama / jenis…"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* filters + sort */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Filter size={14} /> Filter:
              </span>

              {/* filter jenis */}
              <div className="bg-gray-50 rounded-lg p-1 border border-gray-200">
                {(
                  [
                    "SEMUA",
                    "PRODUKSI",
                    "DISTRIBUSI",
                    "PELAYANAN",
                    "ADMINISTRASI",
                    "UMUM_SDM",
                    "LABORATORIUM",
                    "LAINNYA",
                  ] as const
                ).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterJenis(t)}
                    className={`px-2.5 py-1 text-xs rounded-md mr-1 last:mr-0 ${
                      filterJenis === t
                        ? "bg-blue-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* filter status */}
              <div className="bg-gray-50 rounded-lg p-1 border border-gray-200">
                {(["SEMUA", "AKTIF", "NONAKTIF"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 text-xs rounded-md mr-1 last:mr-0 ${
                      filterStatus === s
                        ? "bg-emerald-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* sort */}
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white"
                  title="Urutkan"
                >
                  <option value="nama">Nama</option>
                  <option value="kode">Kode</option>
                  <option value="jenis">Jenis</option>
                  <option value="createdAt">Tanggal Buat</option>
                </select>
                <button
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="inline-flex items-center gap-1 border px-2 py-1 rounded-lg bg-white hover:bg-gray-50 text-sm"
                  title="Arah urutan"
                >
                  <ArrowUpDown size={14} />
                  {sortDir.toUpperCase()}
                </button>
              </div>

              <div className="text-sm text-gray-500 ml-auto">
                Total: <b>{dataFiltered.length}</b> dari <b>{list.length}</b>
              </div>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="overflow-x-auto bg-white border border-gray-200 rounded-2xl shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="px-3 py-2 text-left">Kode</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Jenis</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Dibuat</th>
                <th className="px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-40 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-5 w-24 bg-gray-200 rounded-full animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-7 w-28 bg-gray-200 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : err ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-red-600">{err}</td>
                </tr>
              ) : dataFiltered.length ? (
                dataFiltered.map((u) => {
                  const active = typeof u.isActive === "boolean" ? u.isActive : (u.aktif ?? true);
                  return (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono">{u.kode}</td>
                      <td className="px-3 py-2">{u.nama}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${jenisColor(u.jenis)}`}>
                          {u.jenis}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            active ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{fmtDate(u.createdAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/akuntansi/unit-biaya/${u.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                            title="Edit"
                          >
                            <Pencil size={14} /> Edit
                          </Link>
                          <button
                            onClick={() => onDelete(u.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-red-50 text-red-700 border-red-200"
                            title="Hapus"
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-600">
                      <Factory size={28} className="text-gray-400" />
                      <div className="font-medium">Belum ada unit biaya</div>
                      <div className="text-sm">Klik tombol <b>Tambah</b> di kanan atas untuk membuat unit pertama.</div>
                      <Link
                        href="/akuntansi/unit-biaya/tambah"
                        className="mt-2 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                      >
                        <PlusCircle size={16} /> Tambah Unit Biaya
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 rounded-xl shadow-lg px-4 py-3 text-sm ${
              toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </main>
  );
}
