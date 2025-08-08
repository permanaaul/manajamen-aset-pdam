"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

export default function Inventarisasi() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // proteksi login + role
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      if (!["ADMIN", "PETUGAS"].includes(parsedUser.role)) {
        router.replace("/forbidden");
      }
    } else {
      router.replace("/login");
    }
  }, [router]);

  // ambil data inventaris dari backend
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          const res = await fetch("/api/inventarisasi");
          const result = await res.json();
          if (res.ok) {
            setData(result);
          } else {
            console.error(result.error);
          }
        } catch (error) {
          console.error("Gagal fetch data inventaris:", error);
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
        <p className="text-gray-600">⏳ Memuat data inventaris...</p>
      </main>
    );
  }

  // Komponen Badge status
  const StatusBadge = ({ status }: { status: string }) => {
    const base = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "Baik":
        return <span className={`${base} bg-green-100 text-green-700`}><BadgeCheck size={14} /> Baik</span>;
      case "Perlu Cek":
        return <span className={`${base} bg-yellow-100 text-yellow-700`}><AlertTriangle size={14} /> Perlu Cek</span>;
      case "Rusak":
        return <span className={`${base} bg-red-100 text-red-700`}><AlertTriangle size={14} /> Rusak</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-600`}>{status}</span>;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
            <PackageSearch size={24} /> Inventarisasi Aset PDAM
        </h1>

          {["ADMIN", "PETUGAS"].includes(user.role) && (
            <a
              href="/inventarisasi/tambah"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
            >
              <Plus size={16} /> Tambah Aset
            </a>
          )}
        </div>

        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full bg-white border border-gray-300 rounded">
          <thead className="bg-blue-600 text-white">
  <tr>
    <th className="py-3 px-4 text-left">
      <div className="flex items-center gap-1"><Package size={16} /> Nama Aset</div>
    </th>
    <th className="py-3 px-4 text-left">
      <div className="flex items-center gap-1"><Tag size={16} /> Kategori</div>
    </th>
    <th className="py-3 px-4 text-left">
      <div className="flex items-center gap-1"><Barcode size={16} /> NIA</div>
    </th>
    <th className="py-3 px-4 text-left">
      <div className="flex items-center gap-1"><MapPin size={16} /> Lokasi</div>
    </th>
    <th className="py-3 px-4 text-left">
      <div className="flex items-center gap-1"><ActivitySquare size={16} /> Status</div>
    </th>
    <th className="py-3 px-4 text-left">
      <div className="flex items-center gap-1"><Settings size={16} /> Aksi</div>
    </th>
  </tr>
</thead>


            <tbody className="text-gray-700">
              {data.length > 0 ? (
                data.map((aset, i) => (
                  <tr key={i} className="border-b hover:bg-gray-100 transition duration-150">
                    <td className="px-4 py-3">{aset.nama}</td>
                    <td className="px-4 py-3">{aset.kategori}</td>
                    <td className="px-4 py-3">{aset.nia}</td>
                    <td className="px-4 py-3">{aset.lokasi}</td>
                    <td className="px-4 py-3"><StatusBadge status={aset.status} /></td>
                    <td className="px-4 py-3 flex gap-2">
                      <a
                        href={`/inventarisasi/${aset.nia}`}
                        className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                      >
                        <Eye size={16} /> Detail
                      </a>
                      {user.role === "ADMIN" && (
                        <>
                          <a
                            href={`/inventarisasi/${aset.nia}?edit=true`}
                            className="inline-flex items-center gap-1 bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition"
                          >
                            <Pencil size={16} /> Edit
                          </a>
                          <button
                            onClick={async () => {
                              if (confirm("Yakin ingin menghapus aset ini?")) {
                                const res = await fetch(
                                  `/api/inventarisasi/${aset.nia}`,
                                  { method: "DELETE" }
                                );
                                if (res.ok) {
                                  setData((prev) =>
                                    prev.filter((item) => item.nia !== aset.nia)
                                  );
                                } else {
                                  alert("Gagal menghapus aset!");
                                }
                              }
                            }}
                            className="inline-flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition"
                          >
                            <Trash2 size={16} /> Hapus
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    Belum ada data inventaris.
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
