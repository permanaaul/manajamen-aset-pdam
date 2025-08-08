"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  CalendarCheck,
  Wrench,
  ClipboardList,
  BadgeCheck,
  UserCog,
  StickyNote,
} from "lucide-react";

interface Aset {
  id: number;
  nia: string;
  nama: string;
}

export default function TambahPemeliharaan() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [form, setForm] = useState({
    asetId: "",
    tanggal: "",
    jenis: "",
    biaya: "",
    pelaksana: "",
    catatan: "",
    status: "",
  });
  const [asets, setAsets] = useState<Aset[]>([]);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.replace("/login");
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    if (!["ADMIN", "TEKNISI"].includes(parsedUser.role)) {
      router.replace("/forbidden");
    }
  }, [router]);

  useEffect(() => {
    const fetchAsets = async () => {
      try {
        const res = await fetch("/api/inventarisasi");
        if (res.ok) {
          const data = await res.json();
          setAsets(data);
        } else {
          console.error("Gagal fetch aset");
        }
      } catch (err) {
        console.error("Gagal mengambil aset:", err);
      }
    };
    fetchAsets();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("⏳ Menyimpan pemeliharaan...");

    try {
      const payload = {
        asetId: parseInt(form.asetId),
        tanggal: form.tanggal,
        jenis: form.jenis.trim(),
        biaya: form.biaya ? parseFloat(form.biaya) : 0,
        pelaksana: form.pelaksana.trim(),
        catatan: form.catatan.trim() || null,
        status: form.status,
      };

      const res = await fetch("/api/pemeliharaan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menambahkan pemeliharaan");
      }

      setMessage("✅ Pemeliharaan berhasil ditambahkan!");
      setTimeout(() => {
        router.push("/pemeliharaan");
      }, 1500);
    } catch (error: any) {
      console.error("Error:", error);
      setMessage(`❌ ${error.message || "Terjadi kesalahan server"}`);
    }
  };

  if (!user) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <div className="animate-pulse text-gray-600">Memuat halaman...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-green-700 flex items-center gap-2">
          <PlusCircle className="w-6 h-6" />
          Tambah Pemeliharaan Baru
        </h1>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
          <div>
            <label className="block font-semibold text-gray-700 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Nama Aset
            </label>
            <select
              name="asetId"
              value={form.asetId}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-green-400 transition"
            >
              <option value="">-- Pilih Aset --</option>
              {asets.map((aset) => (
                <option key={aset.id} value={aset.id}>
                  {aset.nama} ({aset.nia})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4" />
              Tanggal Pemeliharaan
            </label>
            <input
              type="date"
              name="tanggal"
              value={form.tanggal}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-green-400 transition"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Jenis Kegiatan
            </label>
            <input
              type="text"
              name="jenis"
              value={form.jenis}
              onChange={handleChange}
              required
              placeholder="Contoh: Servis Pompa"
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-green-400 transition"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" />
              Status
            </label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-green-400 transition"
            >
              <option value="">-- Pilih Status --</option>
              <option value="Terjadwal">Terjadwal</option>
              <option value="Dalam Proses">Dalam Proses</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Pelaksana
            </label>
            <input
              type="text"
              name="pelaksana"
              value={form.pelaksana}
              onChange={handleChange}
              required
              placeholder="Nama Teknisi / Tim"
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-green-400 transition"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Biaya (Rp)
            </label>
            <input
              type="number"
              name="biaya"
              value={form.biaya}
              onChange={handleChange}
              placeholder="Opsional"
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-green-400 transition"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 flex items-center gap-2">
              <StickyNote className="w-4 h-4" />
              Catatan Tambahan
            </label>
            <textarea
              name="catatan"
              value={form.catatan}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-green-400 transition"
              placeholder="Contoh: Ganti seal, cek kabel"
            />
          </div>

          <button
            type="submit"
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition"
          >
            Simpan
          </button>
        </form>

        {message && (
          <div className="mt-4 text-center">
            <p
              className={`inline-block px-3 py-1 rounded font-semibold text-sm ${
                message.includes("✅")
                  ? "bg-green-100 text-green-700"
                  : message.includes("❌")
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {message}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
