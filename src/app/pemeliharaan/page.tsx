"use client";

import { useEffect, useState } from "react";
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
  StickyNote
} from "lucide-react";

interface Pemeliharaan {
  id: number;
  aset?: { nama: string } | null;
  tanggal: string;
  status: string;
  jenis?: string;
  biaya?: number;
  pelaksana?: string;
  catatan?: string;
}

export default function PemeliharaanPage() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [jadwal, setJadwal] = useState<Pemeliharaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (!["ADMIN", "TEKNISI", "PETUGAS", "PIMPINAN"].includes(parsedUser.role)) {
        router.replace("/forbidden");
      }
    } else {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          const res = await fetch("/api/pemeliharaan");
          const data = await res.json();
          if (!res.ok) {
            setErrorMsg(data.error || "Gagal memuat jadwal pemeliharaan");
            return;
          }
          setJadwal(data);
        } catch (err) {
          console.error("Gagal fetch pemeliharaan:", err);
          setErrorMsg("Terjadi kesalahan koneksi ke server");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [user]);

  if (!user || loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">⏳ Memuat jadwal pemeliharaan...</p>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-red-600 font-semibold">{errorMsg}</p>
      </main>
    );
  }

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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-green-700 flex items-center gap-2">
            <ShieldCheck size={24} /> Jadwal Pemeliharaan
          </h1>
          {["ADMIN", "TEKNISI"].includes(user.role) && (
            <a
              href="/pemeliharaan/tambah"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
            >
              <Plus size={16} /> Tambah Pemeliharaan
            </a>
          )}
        </div>

        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full table-fixed bg-white border border-gray-300 rounded">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="py-3 px-4 text-left w-[180px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <PackageSearch size={16} /> Nama Aset
                  </div>
                </th>
                <th className="py-3 px-4 text-left w-[130px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <CalendarDays size={16} /> Tanggal
                  </div>
                </th>
                <th className="py-3 px-4 text-left w-[150px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={16} /> Status
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
                <th className="py-3 px-4 text-left w-[240px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <StickyNote size={16} /> Catatan
                  </div>
                </th>
                <th className="py-3 px-4 text-left w-[150px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {jadwal.length > 0 ? (
                jadwal.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-100 transition duration-150">
                    <td className="px-4 py-3">{item.aset?.nama || "Tidak ada data aset"}</td>
                    <td className="px-4 py-3">
                      {item.tanggal
                        ? new Date(item.tanggal).toLocaleDateString("id-ID")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">{item.pelaksana || "-"}</td>
                    <td className="px-4 py-3">
                      {item.biaya !== undefined && item.biaya !== null
                        ? `Rp ${new Intl.NumberFormat("id-ID").format(item.biaya)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{item.catatan || "-"}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <a
                        href={`/pemeliharaan/${item.id}`}
                        className="inline-flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
                      >
                        <Eye size={14} /> Detail
                      </a>
                      {["ADMIN", "TEKNISI"].includes(user.role) && (
                        <a
                          href={`/pemeliharaan/${item.id}/edit`}
                          className="inline-flex items-center gap-1 bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition"
                        >
                          <Pencil size={14} /> Edit
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    Belum ada jadwal pemeliharaan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
