"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  Pencil,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  ClipboardX,
  PackageSearch,
  CalendarDays,
  ShieldCheck,
  UserCog,
  Coins,
  StickyNote,
  Search,
} from "lucide-react";

type UserLocal = { nama: string; role: string };

interface Pemeliharaan {
  id: number;
  aset?: { nama: string } | null;
  tanggal: string;
  status: string;
  jenis?: string;
  biaya?: number | null;
  pelaksana?: string | null;
  catatan?: string | null;
}

const rupiah = (v?: number | null) =>
  v == null ? "-" : `Rp ${new Intl.NumberFormat("id-ID").format(v)}`;

export default function PemeliharaanPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserLocal | null>(null);
  const [list, setList] = useState<Pemeliharaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  // Cek login dan role
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as UserLocal;
    setUser(u);
    if (!["ADMIN", "TEKNISI", "PETUGAS", "PIMPINAN"].includes(u.role)) {
      router.replace("/forbidden");
    }
  }, [router]);

  // Ambil data pemeliharaan
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/pemeliharaan", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal memuat jadwal pemeliharaan");
        setList(data);
      } catch (e: any) {
        setErr(e?.message || "Terjadi kesalahan koneksi ke server");
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((it) =>
      needle
        ? [
            it.aset?.nama,
            it.jenis,
            it.pelaksana,
            it.catatan,
            new Date(it.tanggal).toLocaleDateString("id-ID"),
          ]
            .filter(Boolean)
            .some((f) => String(f).toLowerCase().includes(needle))
        : true
    );
  }, [list, q]);

  const totalBiaya = useMemo(
    () => filtered.reduce((s, it) => s + (typeof it.biaya === "number" ? it.biaya : 0), 0),
    [filtered]
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const base =
      "inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full";
    switch (status.toLowerCase()) {
      case "terjadwal":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>
            <CalendarCheck size={14} /> Terjadwal
          </span>
        );
      case "dalam proses":
        return (
          <span className={`${base} bg-yellow-100 text-yellow-700`}>
            <ClipboardList size={14} /> Dalam Proses
          </span>
        );
      case "selesai":
        return (
          <span className={`${base} bg-green-100 text-green-700`}>
            <ClipboardCheck size={14} /> Selesai
          </span>
        );
      default:
        return (
          <span className={`${base} bg-red-100 text-red-600`}>
            <ClipboardX size={14} /> Tertunda
          </span>
        );
    }
  };

  if (!user || loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">⏳ Memuat jadwal pemeliharaan...</p>
      </main>
    );
  }

  if (err) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-red-600 font-semibold">{err}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-green-700 flex items-center gap-2">
            <ShieldCheck size={24} /> Jadwal Pemeliharaan
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari aset/jenis/petugas/catatan…"
                className="pl-8 pr-3 py-2 border border-gray-300 rounded w-72 focus:ring-2 focus:ring-green-400 focus:outline-none"
              />
            </div>

            {["ADMIN", "TEKNISI"].includes(user.role) && (
              <Link
                href="/pemeliharaan/tambah"
                className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
              >
                <Plus size={16} /> Tambah Pemeliharaan
              </Link>
            )}
          </div>
        </div>

        {/* KPI */}
        <div className="mb-3 text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
          <span>
            Menampilkan <b>{filtered.length}</b> dari <b>{list.length}</b> kegiatan.
          </span>
          <span>
            Total biaya (terfilter): <b>{rupiah(totalBiaya)}</b>
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full table-fixed bg-white border border-gray-300 rounded">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="py-3 px-4 text-left w-[220px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <PackageSearch size={16} /> Nama Aset
                  </div>
                </th>
                <th className="py-3 px-4 text-left w-[130px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <CalendarDays size={16} /> Tanggal
                  </div>
                </th>
                <th className="py-3 px-4 text-left w-[160px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={16} /> Status
                  </div>
                </th>
                <th className="py-3 px-4 text-left w-[220px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <ClipboardList size={16} /> Jenis
                  </div>
                </th>
                <th className="py-3 px-4 text-left w-[180px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <UserCog size={16} /> Petugas
                  </div>
                </th>
                <th className="py-3 px-4 text-left w-[140px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Coins size={16} /> Biaya
                  </div>
                </th>
                <th className="py-3 px-4 text-left">Catatan</th>
                <th className="py-3 px-4 text-left w-[160px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b hover:bg-gray-50 transition duration-150"
                  >
                    <td className="px-4 py-3">{item.aset?.nama || "-"}</td>
                    <td className="px-4 py-3">
                      {item.tanggal
                        ? new Date(item.tanggal).toLocaleDateString("id-ID")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">{item.jenis || "-"}</td>
                    <td className="px-4 py-3">{item.pelaksana || "-"}</td>
                    <td className="px-4 py-3">{rupiah(item.biaya ?? null)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <StickyNote size={14} className="text-gray-400" />
                        {item.catatan || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex flex-wrap gap-2">
                      <Link
                        href={`/pemeliharaan/${item.id}`}
                        className="inline-flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
                      >
                        <Eye size={14} /> Detail
                      </Link>
                      {["ADMIN", "TEKNISI"].includes(user.role) && (
                        <Link
                          href={`/pemeliharaan/${item.id}/edit`}
                          className="inline-flex items-center gap-1 bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition"
                        >
                          <Pencil size={14} /> Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-gray-500">
                    Tidak ada hasil sesuai pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-4 text-sm text-gray-600">
          Terakhir diperbarui: {new Date().toLocaleString("id-ID")}
        </div>
      </div>
    </main>
  );
}
