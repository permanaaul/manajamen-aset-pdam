"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package,
  Tag,
  Barcode,
  MapPin,
  Calendar,
  Coins,
  AlertTriangle,
  Save,
  ArrowLeft,
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

export default function EditAset() {
  const params = useParams();
  const nia = params?.nia as string;
  const [form, setForm] = useState<Aset | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.role !== "ADMIN") router.replace("/forbidden");
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
        setForm(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (nia) fetchAset();
  }, [nia]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form!, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/inventarisasi/${nia}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Gagal memperbarui aset");

      alert("✅ Aset berhasil diperbarui!");
      router.push(`/inventarisasi/${nia}`);
    } catch (err) {
      console.error(err);
      alert("❌ Terjadi kesalahan saat memperbarui aset");
    }
  };

  if (loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">⏳ Memuat data aset...</p>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-red-600">❌ Data aset tidak ditemukan</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow text-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-yellow-700 flex items-center gap-2">
            <Package size={24} /> Edit Aset: {form.nama}
          </h1>
          <button
            onClick={() => router.push(`/inventarisasi/${nia}`)}
            className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Tag size={16} /> Nama Aset
            </label>
            <input
              type="text"
              name="nama"
              value={form.nama}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Barcode size={16} /> Nomor Induk Aset (NIA)
            </label>
            <input
              type="text"
              name="nia"
              value={form.nia}
              disabled
              className="w-full border rounded px-3 py-2 mt-1 bg-gray-100 text-gray-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Tag size={16} /> Kategori
            </label>
            <input
              type="text"
              name="kategori"
              value={form.kategori}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <MapPin size={16} /> Lokasi
            </label>
            <input
              type="text"
              name="lokasi"
              value={form.lokasi}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar size={16} /> Tahun Perolehan
              </label>
              <input
                type="number"
                name="tahun"
                value={form.tahun}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Coins size={16} /> Nilai Perolehan (Rp)
              </label>
              <input
                type="number"
                name="nilai"
                value={form.nilai}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <AlertTriangle size={16} /> Kondisi
            </label>
            <select
              name="kondisi"
              value={form.kondisi}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
            >
              <option value="Baik">Baik</option>
              <option value="Perlu Cek">Perlu Cek</option>
              <option value="Rusak">Rusak</option>
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-yellow-600 text-white py-2 px-4 rounded hover:bg-yellow-700 transition"
          >
            <Save size={18} /> Simpan Perubahan
          </button>
        </form>
      </div>
    </main>
  );
}
