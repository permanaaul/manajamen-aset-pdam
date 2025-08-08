"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TambahAset() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [form, setForm] = useState({
    nama: "",
    nia: "",
    kategori: "",
    lokasi: "",
    tahun: "",
    nilai: "",
    kondisi: "",
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const router = useRouter();

  // proteksi login & role
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
    setLoading(false);
  }, [router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("⏳ Menyimpan aset...");

    try {
      const res = await fetch("/api/inventarisasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`❌ ${data.error || "Gagal menambahkan aset"}`);
        return;
      }

      setMessage("✅ Aset berhasil ditambahkan!");
      setTimeout(() => {
        router.push("/inventarisasi");
      }, 1200);
    } catch (error) {
      setMessage("❌ Terjadi kesalahan server");
    }
  };

  if (loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">⏳ Memuat halaman...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-blue-700">
          Tambah Aset Baru
        </h1>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
          <div>
            <label className="block font-semibold text-gray-700">Nama Aset</label>
            <input
              type="text"
              name="nama"
              value={form.nama}
              onChange={handleChange}
              required
              placeholder="Contoh: Pompa Booster"
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700">
              Nomor Induk Aset (NIA)
            </label>
            <input
              type="text"
              name="nia"
              value={form.nia}
              onChange={handleChange}
              required
              placeholder="Contoh: 0232200001"
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700">Kategori</label>
            <input
              type="text"
              name="kategori"
              value={form.kategori}
              onChange={handleChange}
              required
              placeholder="Contoh: Pompa, Reservoir, Kendaraan"
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700">Lokasi</label>
            <input
              type="text"
              name="lokasi"
              value={form.lokasi}
              onChange={handleChange}
              required
              placeholder="Contoh: Reservoir Utama"
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-gray-700">
                Tahun Perolehan
              </label>
              <input
                type="number"
                name="tahun"
                min="1900"
                max={new Date().getFullYear()}
                value={form.tahun}
                onChange={handleChange}
                required
                placeholder="2020"
                className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700">
                Nilai Perolehan (Rp)
              </label>
              <input
                type="number"
                name="nilai"
                min="0"
                value={form.nilai}
                onChange={handleChange}
                required
                placeholder="50000000"
                className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-gray-700">Kondisi</label>
            <select
              name="kondisi"
              value={form.kondisi}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              <option value="">-- Pilih Kondisi --</option>
              <option value="Baik">Baik</option>
              <option value="Perlu Cek">Perlu Cek</option>
              <option value="Rusak">Rusak</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Simpan
          </button>
        </form>
        {message && (
          <p className="mt-4 text-center font-semibold">{message}</p>
        )}
      </div>
    </main>
  );
}
