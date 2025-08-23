// src/app/akuntansi/kategori-biaya/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Layers,
  PlusCircle,
  Trash2,
  Pencil,
  RefreshCw,
  Filter,
  Search,
  ArrowUpDown,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* ============== Types ============== */
type Kategori = {
  id: number;
  kode: string;
  nama: string;
  tipe?: "BIAYA" | "PENDAPATAN" | "ASET" | null;
  isActive?: boolean | null; // skema baru
  aktif?: boolean | null;    // fallback skema lama
  createdAt?: string | null;
};

/* ============== Helpers ============== */
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID") : "—";

const tipeColor = (t?: string | null) => {
  switch (t) {
    case "BIAYA":
      return "bg-blue-100 text-blue-800";
    case "PENDAPATAN":
      return "bg-emerald-100 text-emerald-800";
    case "ASET":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

/* ============== Small UI bits ============== */
function Badge({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`px-2 py-[3px] rounded text-xs font-medium ${className}`}>{children}</span>
  );
}

function GhostButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean; className?: string }
) {
  const { danger, className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-sm
        ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-gray-300 text-gray-800 hover:bg-gray-50"}
        ${className}`}
    />
  );
}

/* ============== Page ============== */
export default function KategoriBiayaListPage() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);

  // data
  const [list, setList] = useState<Kategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ui states
  const [q, setQ] = useState("");
  const [filterTipe, setFilterTipe] =
    useState<"SEMUA" | "BIAYA" | "PENDAPATAN" | "ASET">("SEMUA");
  const [filterStatus, setFilterStatus] =
    useState<"SEMUA" | "AKTIF" | "NONAKTIF">("SEMUA");
  const [sortBy, setSortBy] = useState<"nama" | "kode" | "createdAt">("nama");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

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
      const r = await fetch("/api/akuntansi/kategori-biaya", { cache: "no-store" });
      const j = r.ok ? await r.json() : [];
      setList(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat kategori biaya.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (id: number) => {
    if (!confirm("Hapus kategori ini?")) return;
    try {
      const r = await fetch(`/api/akuntansi/kategori-biaya/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      setList((prev) => prev.filter((x) => x.id !== id));
      setToast({ type: "ok", msg: "Kategori dihapus." });
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "Gagal menghapus kategori." });
    }
  };

  const dataFiltered = useMemo(() => {
    let rows = [...list];

    // search
    const key = q.trim().toLowerCase();
    if (key) {
      rows = rows.filter((x) => {
        const tipe = (x.tipe ?? "").toString();
        return (
          x.kode.toLowerCase().includes(key) ||
          x.nama.toLowerCase().includes(key) ||
          tipe.toLowerCase().includes(key)
        );
      });
    }

    // filter tipe
    if (filterTipe !== "SEMUA") {
      rows = rows.filter((x) => (x.tipe ?? "") === filterTipe);
    }

    // filter status
    if (filterStatus !== "SEMUA") {
      const active = filterStatus === "AKTIF";
      rows = rows.filter(
        (x) => (typeof x.isActive === "boolean" ? x.isActive : (x.aktif ?? true)) === active
      );
    }

    // sort
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "nama") return a.nama.localeCompare(b.nama) * dir;
      if (sortBy === "kode") return a.kode.localeCompare(b.kode) * dir;
      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (ad - bd) * dir;
    });

    return rows;
  }, [list, q, filterTipe, filterStatus, sortBy, sortDir]);

  // ringkasan kecil
  const totalAktif = useMemo(
    () =>
      list.filter((x) =>
        typeof x.isActive === "boolean" ? x.isActive : (x.aktif ?? true)
      ).length,
    [list]
  );

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Kategori Biaya
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm text-gray-800"
              title="Muat ulang"
            >
              <RefreshCw size={16} /> Muat ulang
            </button>
            <Link
              href="/akuntansi/kategori-biaya/tambah"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              <PlusCircle size={16} /> Tambah
            </Link>
          </div>
        </div>

        {/* Ringkasan mini */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="text-xs text-gray-600">Total Kategori</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{list.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="text-xs text-gray-600">Aktif</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{totalAktif}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="text-xs text-gray-600">Tampilkan</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{dataFiltered.length}</div>
          </div>
        </div>

        {/* Toolbar */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* search */}
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari: kode / nama / tipe…"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* filters + sort */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <Filter size={14} /> Filter:
              </span>

              {/* filter tipe */}
              <div className="bg-gray-50 rounded-lg p-1 border border-gray-200">
                {(["SEMUA", "BIAYA", "PENDAPATAN", "ASET"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterTipe(t)}
                    className={`px-2.5 py-1 text-xs rounded-md mr-1 last:mr-0 ${
                      filterTipe === t
                        ? "bg-blue-600 text-white"
                        : "text-gray-800 hover:bg-gray-100"
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
                        : "text-gray-800 hover:bg-gray-100"
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
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white text-gray-900"
                  title="Urutkan"
                >
                  <option value="nama">Nama</option>
                  <option value="kode">Kode</option>
                  <option value="createdAt">Tanggal Buat</option>
                </select>
                <button
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="inline-flex items-center gap-1 border px-2 py-1 rounded-lg bg-white hover:bg-gray-50 text-sm text-gray-800"
                  title="Arah urutan"
                >
                  <ArrowUpDown size={14} />
                  {sortDir.toUpperCase()}
                </button>
              </div>

              <div className="text-sm text-gray-600 ml-auto">
                Total: <b>{dataFiltered.length}</b> dari <b>{list.length}</b>
              </div>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="overflow-x-auto bg-white border border-gray-200 rounded-2xl shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900 text-white sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Kode</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Tipe</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Dibuat</th>
                <th className="px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-3">
                      <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : err ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6">
                    <div className="flex items-center gap-2 text-red-700">
                      <Info size={16} />
                      <span>{err}</span>
                    </div>
                  </td>
                </tr>
              ) : dataFiltered.length ? (
                dataFiltered.map((k) => {
                  const active =
                    typeof k.isActive === "boolean" ? k.isActive : (k.aktif ?? true);
                  return (
                    <tr key={k.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono">{k.kode}</td>
                      <td className="px-3 py-2">{k.nama}</td>
                      <td className="px-3 py-2">
                        <Badge className={tipeColor(k.tipe)}>{k.tipe ?? "—"}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {active ? (
                          <Badge className="bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                            <CheckCircle2 size={14} /> Aktif
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-200 text-gray-800 inline-flex items-center gap-1">
                            <XCircle size={14} /> Nonaktif
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{fmtDate(k.createdAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/akuntansi/kategori-biaya/${k.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-sm text-gray-800"
                            title="Edit"
                          >
                            <Pencil size={14} /> Edit
                          </Link>
                          <GhostButton
                            danger
                            onClick={() => onDelete(k.id)}
                            title="Hapus"
                          >
                            <Trash2 size={14} /> Hapus
                          </GhostButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-600">
                    Belum ada kategori. Klik <b>Tambah</b> di kanan atas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 rounded-xl shadow-lg px-4 py-3 text-sm flex items-center gap-2 ${
              toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.type === "ok" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {toast.msg}
          </div>
        )}
      </div>
    </main>
  );
}
