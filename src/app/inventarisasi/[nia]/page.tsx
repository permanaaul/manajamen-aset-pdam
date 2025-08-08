"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package,
  Tag,
  MapPin,
  Calendar,
  Coins,
  BadgeCheck,
  AlertTriangle,
  ArrowLeft,
  Pencil,
  Trash2,
  Barcode,
} from "lucide-react";

interface Aset {
  nama: string;
  kategori: string;
  nia: string;
  lokasi: string;
  tahun: string;
  nilai: number;
  kondisi: string;
}

export default function DetailAset() {
  const params = useParams();
  const nia = params?.nia as string;
  const [aset, setAset] = useState<Aset | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const router = useRouter();

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

  useEffect(() => {
    const fetchAset = async () => {
      try {
        const res = await fetch(`/api/inventarisasi/${nia}`);
        if (!res.ok) throw new Error("Aset tidak ditemukan");
        const data = await res.json();
        setAset(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (nia) fetchAset();
  }, [nia]);

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

  if (loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">⏳ Memuat detail aset...</p>
      </main>
    );
  }

  if (!aset) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-red-600">❌ Aset tidak ditemukan</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow text-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
            <Package size={24} /> Detail Aset
          </h1>
          <button
            onClick={() => router.push("/inventarisasi")}
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
        </div>

        <div className="grid gap-4 text-base leading-relaxed">
          <div className="flex items-center gap-3">
            <Tag size={20} className="text-gray-500" />
            <span><b>Nama:</b> {aset.nama}</span>
          </div>
          <div className="flex items-center gap-3">
            <Barcode size={20} className="text-gray-500" />
            <span><b>NIA:</b> {aset.nia}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin size={20} className="text-gray-500" />
            <span><b>Lokasi:</b> {aset.lokasi}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-gray-500" />
            <span><b>Tahun Perolehan:</b> {aset.tahun}</span>
          </div>
          <div className="flex items-center gap-3">
            <Coins size={20} className="text-gray-500" />
            <span><b>Nilai:</b> Rp {Number(aset.nilai).toLocaleString("id-ID")}</span>
          </div>
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-gray-500" />
            <span><b>Kondisi:</b> <StatusBadge status={aset.kondisi} /></span>
          </div>
        </div>

        {user?.role === "ADMIN" && (
          <div className="flex gap-4 mt-6">
            <a
              href={`/inventarisasi/${aset.nia}/edit`}
              className="inline-flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition"
            >
              <Pencil size={16} /> Edit
            </a>
            <button
              onClick={async () => {
                if (confirm("Yakin ingin menghapus aset ini?")) {
                  const res = await fetch(`/api/inventarisasi/${aset.nia}`, {
                    method: "DELETE",
                  });
                  if (res.ok) {
                    alert("✅ Aset berhasil dihapus");
                    router.push("/inventarisasi");
                  } else {
                    alert("❌ Gagal menghapus aset");
                  }
                }
              }}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
            >
              <Trash2 size={16} /> Hapus
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
