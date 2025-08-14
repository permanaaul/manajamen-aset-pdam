"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  AlertTriangle,
  Eye,
  Pencil,
  Trash2,
  Plus,
  PackageSearch,
  Package,
  Tag,
  Barcode,
  MapPin,
  ActivitySquare,
  Settings,
  Search,
  XCircle,
  RefreshCw,
  Copy as CopyIcon,
} from "lucide-react";

type AsetItem = {
  nama: string;
  nia: string;
  kategori: string;
  lokasi: string;
  tahun: number;
  nilai: string; // Prisma Decimal -> string
  kondisi: "Baik" | "Perlu Cek" | "Rusak" | string;
  createdAt: string;
};

const labelKategori = (k: string) => k.replace(/_/g, " ");
const rupiah = (v: string | number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    .format(typeof v === "string" ? Number(v) : v);

export default function Inventarisasi() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [data, setData] = useState<AsetItem[]>([]);
  const [loading, setLoading] = useState(true);

  // search
  const [q, setQ] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);

  // toast
  const [toast, setToast] = useState<string | null>(null);

  const router = useRouter();

  // auth guard
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (!["ADMIN", "PETUGAS"].includes(parsedUser.role)) router.replace("/forbidden");
    } else {
      router.replace("/login");
    }
  }, [router]);

  const fetchData = async (keyword = "") => {
    try {
      const params = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
      const res = await fetch(`/api/inventarisasi${params}`, { cache: "no-store" });
      const result = await res.json();
      if (res.ok) setData(result);
      else console.error(result.error);
    } catch (e) {
      console.error("Gagal fetch data inventaris:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  // reset ke halaman 1 saat search/pageSize berubah
  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = useMemo(() => data.slice(start, start + pageSize), [data, start, pageSize]);

  if (!user || loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">⏳ Memuat data inventaris...</p>
      </main>
    );
  }

  const KondisiBadge = ({ kondisi }: { kondisi: string }) => {
    const base = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium";
    switch (kondisi) {
      case "Baik":
        return <span className={`${base} bg-green-100 text-green-700`}><BadgeCheck size={14}/> Baik</span>;
      case "Perlu Cek":
        return <span className={`${base} bg-yellow-100 text-yellow-700`}><AlertTriangle size={14}/> Perlu Cek</span>;
      case "Rusak":
        return <span className={`${base} bg-red-100 text-red-700`}><AlertTriangle size={14}/> Rusak</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-600`}>{kondisi}</span>;
    }
  };

  const doSearch = () => {
    setLoading(true);
    fetchData(q.trim());
  };

  const clearAll = () => {
    setQ("");
    setLoading(true);
    fetchData("");
  };

  const copyNIA = async (nia: string) => {
    try {
      await navigator.clipboard.writeText(nia);
      setToast("NIA disalin ke clipboard");
    } catch {
      setToast("Gagal menyalin NIA");
    } finally {
      setTimeout(() => setToast(null), 1200);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
            <PackageSearch size={24} /> Inventarisasi Aset PDAM
          </h1>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            {/* Search */}
            <div className="flex flex-col gap-1">
              <label htmlFor="search" className="text-xs font-semibold text-gray-600">Pencarian</label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                  <input
                    id="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSearch()}
                    placeholder="Cari berdasarkan NIA, Nama, atau Lokasi (tekan Enter)"
                    className="bg-white placeholder-gray-500 pl-8 pr-3 py-2 border border-gray-300 rounded w-80 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={doSearch}
                  className="inline-flex items-center gap-2 px-3 py-2 border rounded text-gray-700 hover:bg-gray-100"
                  title="Cari"
                >
                  Cari
                </button>
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 px-3 py-2 border rounded text-red-600 hover:bg-red-50"
                  title="Hapus pencarian"
                >
                  <XCircle size={16} /> Hapus
                </button>
              </div>
              <p className="text-xs text-gray-500">Contoh: “02322”, “Booster”, “Reservoir”.</p>
            </div>

            {/* Tambah */}
            {["ADMIN", "PETUGAS"].includes(user.role) && (
              <Link
                href="/inventarisasi/tambah"
                className="h-[40px] inline-flex items-center gap-2 bg-green-600 text-white px-4 rounded hover:bg-green-700 transition"
              >
                <Plus size={16} /> Tambah Aset
              </Link>
            )}
          </div>
        </div>

        {/* Count + page size + reload */}
        <div className="mb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm text-gray-600">
          <div>Menampilkan <span className="font-semibold">{pageItems.length}</span> dari <span className="font-semibold">{data.length}</span> aset.</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span>Baris/hal:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as 10 | 25 | 50)}
                className="border border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <button
              onClick={() => { setLoading(true); fetchData(q.trim()); }}
              className="inline-flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-100"
              title="Muat ulang data"
            >
              <RefreshCw size={16} /> Muat Ulang
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full bg-white border border-gray-200 rounded">
            <thead className="bg-blue-600 text-white sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 text-left w-[22%]">
                  <div className="flex items-center gap-1"><Package size={16} /> Nama Aset</div>
                </th>
                <th className="py-3 px-4 text-left w-[14%]">
                  <div className="flex items-center gap-1"><Tag size={16} /> Kategori</div>
                </th>
                <th className="py-3 px-4 text-left w-[14%]">
                  <div className="flex items-center gap-1"><Barcode size={16} /> NIA</div>
                </th>
                <th className="py-3 px-4 text-left w-[18%]">
                  <div className="flex items-center gap-1"><MapPin size={16} /> Lokasi</div>
                </th>
                <th className="py-3 px-4 text-left w-[10%]">
                  <div className="flex items-center gap-1"><ActivitySquare size={16} /> Kondisi</div>
                </th>
                <th className="py-3 px-4 text-left w-[7%]">Tahun</th>
                <th className="py-3 px-4 text-right w-[10%]">Nilai (Rp)</th>
                <th className="py-3 px-4 text-left w-[15%]">
                  <div className="flex items-center gap-1"><Settings size={16} /> Aksi</div>
                </th>
              </tr>
            </thead>

            <tbody className="text-gray-700">
              {pageItems.length > 0 ? (
                pageItems.map((aset, i) => (
                  <tr key={aset.nia ?? i} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} border-b-2 border-neutral-300`}>
                    <td className="px-4 py-4">{aset.nama}</td>
                    <td className="px-4 py-4">{labelKategori(aset.kategori)}</td>
                    <td className="px-4 py-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span>{aset.nia}</span>
                        <button
                          type="button"
                          onClick={() => copyNIA(aset.nia)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 border rounded text-gray-700 hover:bg-gray-100"
                          title="Salin NIA"
                        >
                          <CopyIcon size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">{aset.lokasi}</td>
                    <td className="px-4 py-4"><KondisiBadge kondisi={aset.kondisi} /></td>
                    <td className="px-4 py-4">{aset.tahun}</td>
                    <td className="px-4 py-4 text-right">{rupiah(aset.nilai)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/inventarisasi/${aset.nia}`} className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition">
                          <Eye size={16} /> Detail
                        </Link>
                        {user.role === "ADMIN" && (
                          <>
                            <Link href={`/inventarisasi/${aset.nia}/edit`} className="inline-flex items-center gap-1 bg-yellow-500 text-white px-3 py-1.5 rounded hover:bg-yellow-600 transition">
                              <Pencil size={16} /> Edit
                            </Link>
                            <button
                              onClick={async () => {
                                if (confirm("Yakin ingin menghapus aset ini?")) {
                                  const res = await fetch(`/api/inventarisasi/${aset.nia}`, { method: "DELETE" });
                                  if (res.ok) setData((prev) => prev.filter((item) => item.nia !== aset.nia));
                                  else alert("Gagal menghapus aset!");
                                }
                              }}
                              className="inline-flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition"
                            >
                              <Trash2 size={16} /> Hapus
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-gray-500">Tidak ada data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-gray-700">
          <div>Halaman <span className="font-semibold">{page}</span> dari <span className="font-semibold">{totalPages}</span></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(1)} disabled={page === 1} className={`px-3 py-1.5 border rounded ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>« Awal</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`px-3 py-1.5 border rounded ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>‹ Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`px-3 py-1.5 border rounded ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>Next ›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className={`px-3 py-1.5 border rounded ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>Akhir »</button>
          </div>
        </div>

        {/* Toast */}
        {toast && <div className="fixed bottom-6 right-6 bg-black text-white text-sm px-3 py-2 rounded shadow">{toast}</div>}
      </div>
    </main>
  );
}
