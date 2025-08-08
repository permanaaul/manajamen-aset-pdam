"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Coins,
  UserCog,
  StickyNote,
  ShieldCheck,
  Pencil,
  Trash2,
} from "lucide-react";

interface Pemeliharaan {
  id: string;
  aset?: { nama: string; nia: string };
  tanggal: string;
  jenis: string;
  biaya?: number;
  pelaksana: string;
  catatan?: string;
  status: string;
}

export default function DetailPemeliharaan({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<Pemeliharaan | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.replace("/login");
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/pemeliharaan/${params.id}`);
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Data pemeliharaan tidak ditemukan");
          return;
        }
        setItem(data);
      } catch (error) {
        console.error("Gagal memuat data:", error);
        setErrorMsg("Terjadi kesalahan koneksi ke server");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">⏳ Memuat detail pemeliharaan...</p>
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

  if (!item) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-red-600">❌ Data pemeliharaan tidak ditemukan</p>
      </main>
    );
  }

  const renderBadgeStatus = (status: string) => {
    switch (status) {
      case "Selesai":
        return (
          <span className="inline-flex items-center bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
            <BadgeCheck className="w-4 h-4 mr-1" /> Selesai
          </span>
        );
      case "Dalam Proses":
        return (
          <span className="inline-flex items-center bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
            <ClipboardList className="w-4 h-4 mr-1" /> Dalam Proses
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
            <ShieldCheck className="w-4 h-4 mr-1" /> Terjadwal
          </span>
        );
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow text-gray-800">
        <h1 className="text-2xl font-bold mb-6 text-green-700 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> Detail Pemeliharaan
        </h1>
        <ul className="space-y-4 text-base leading-relaxed">
          <li className="flex items-center gap-2">
            <ClipboardList className="text-gray-500 w-5 h-5" />
            <span className="font-medium text-gray-700">Nama Aset:</span>{" "}
            {item.aset?.nama || "-"} ({item.aset?.nia})
          </li>
          <li className="flex items-center gap-2">
            <CalendarDays className="text-gray-500 w-5 h-5" />
            <span className="font-medium text-gray-700">Tanggal:</span>{" "}
            {new Date(item.tanggal).toLocaleDateString("id-ID")}
          </li>
          <li className="flex items-center gap-2">
            <ClipboardList className="text-gray-500 w-5 h-5" />
            <span className="font-medium text-gray-700">Jenis Kegiatan:</span>{" "}
            {item.jenis}
          </li>
          <li className="flex items-center gap-2">
            <Coins className="text-gray-500 w-5 h-5" />
            <span className="font-medium text-gray-700">Biaya:</span>{" "}
            {item.biaya ? `Rp ${item.biaya.toLocaleString("id-ID")}` : "-"}
          </li>
          <li className="flex items-center gap-2">
            <UserCog className="text-gray-500 w-5 h-5" />
            <span className="font-medium text-gray-700">Pelaksana:</span>{" "}
            {item.pelaksana}
          </li>
          <li className="flex items-center gap-2">
            <StickyNote className="text-gray-500 w-5 h-5" />
            <span className="font-medium text-gray-700">Catatan:</span>{" "}
            {item.catatan || "-"}
          </li>
          <li className="flex items-center gap-2">
            <BadgeCheck className="text-gray-500 w-5 h-5" />
            <span className="font-medium text-gray-700">Status:</span>{" "}
            {renderBadgeStatus(item.status)}
          </li>
        </ul>

        {["ADMIN", "TEKNISI"].includes(user?.role || "") && (
          <div className="flex gap-4 mt-6">
            <a
              href={`/pemeliharaan/${item.id}/edit`}
              className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition"
            >
              <Pencil className="w-4 h-4" /> Edit
            </a>
            <button
              onClick={async () => {
                if (confirm("Yakin ingin menghapus jadwal ini?")) {
                  try {
                    const res = await fetch(`/api/pemeliharaan/${item.id}`, {
                      method: "DELETE",
                    });
                    if (res.ok) {
                      alert("✅ Jadwal berhasil dihapus");
                      router.push("/pemeliharaan");
                    } else {
                      const errData = await res.json();
                      alert(`❌ Gagal menghapus jadwal: ${errData.error || "Server error"}`);
                    }
                  } catch (err) {
                    console.error("Delete error:", err);
                    alert("❌ Terjadi kesalahan koneksi ke server");
                  }
                }
              }}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
            >
              <Trash2 className="w-4 h-4" /> Hapus
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
