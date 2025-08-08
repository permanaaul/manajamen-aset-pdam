"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ClipboardList,
  Coins,
  Edit,
  FileWarning,
  HardDrive,
  Loader,
  ShieldCheck,
  UserCog,
} from "lucide-react";

interface Pemeliharaan {
  id: number;
  asetId: number;
  aset?: { nia: string; nama: string };
  tanggal: string;
  jenis: string;
  pelaksana: string;
  catatan: string;
  status: string;
  biaya?: number;
}

interface Aset {
  id: number;
  nia: string;
  nama: string;
}

export default function EditPemeliharaan({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<Pemeliharaan | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [asets, setAsets] = useState<Aset[]>([]);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return router.replace("/login");
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    if (!["ADMIN", "TEKNISI"].includes(parsedUser.role)) router.replace("/forbidden");
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pemeliharaanRes, asetRes] = await Promise.all([
          fetch(`/api/pemeliharaan/${params.id}`),
          fetch("/api/inventarisasi"),
        ]);

        if (!pemeliharaanRes.ok) {
          const err = await pemeliharaanRes.json();
          throw new Error(err.error || "Data tidak ditemukan");
        }

        const pemeliharaan = await pemeliharaanRes.json();
        const asetData = asetRes.ok ? await asetRes.json() : [];

        setForm(pemeliharaan);
        setAsets(asetData);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm({ ...form!, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("⏳ Menyimpan perubahan...");

    try {
      const payload = {
        asetId: parseInt(form!.asetId.toString()),
        tanggal: form!.tanggal,
        jenis: form!.jenis,
        pelaksana: form!.pelaksana,
        catatan: form!.catatan,
        status: form!.status,
        biaya: form!.biaya || 0,
      };

      const res = await fetch(`/api/pemeliharaan/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui pemeliharaan");
      }

      setMessage("✅ Berhasil disimpan!");
      setTimeout(() => router.push(`/pemeliharaan/${params.id}`), 1500);
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ ${err.message}`);
    }
  };

  if (loading) {
    return (
      <main className="flex justify-center items-center min-h-screen text-gray-600">
        <Loader className="animate-spin mr-2" />
        Memuat data pemeliharaan...
      </main>
    );
  }

  if (errorMsg || !form) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <FileWarning className="text-red-500 mr-2" />
        <p className="text-red-600 font-semibold">{errorMsg || "Data tidak ditemukan"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-yellow-700 flex items-center gap-2">
          <Edit className="w-6 h-6" /> Edit Pemeliharaan
        </h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
          <div>
            <label className="flex items-center gap-2 font-semibold text-gray-700">
              <HardDrive className="w-4 h-4" /> Nama Aset
            </label>
            <select
              name="asetId"
              value={form.asetId}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
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
            <label className="flex items-center gap-2 font-semibold text-gray-700">
              <Calendar className="w-4 h-4" /> Tanggal
            </label>
            <input
              type="date"
              name="tanggal"
              value={form.tanggal.split("T")[0]}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 font-semibold text-gray-700">
              <ClipboardList className="w-4 h-4" /> Jenis Kegiatan
            </label>
            <input
              type="text"
              name="jenis"
              value={form.jenis}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 font-semibold text-gray-700">
              <UserCog className="w-4 h-4" /> Pelaksana
            </label>
            <input
              type="text"
              name="pelaksana"
              value={form.pelaksana}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 font-semibold text-gray-700">
              <Coins className="w-4 h-4" /> Biaya (Rp)
            </label>
            <input
              type="number"
              name="biaya"
              value={form.biaya || ""}
              onChange={handleChange}
              min="0"
              step="1000"
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 font-semibold text-gray-700">
              <ShieldCheck className="w-4 h-4" /> Status
            </label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            >
              <option value="Terjadwal">Terjadwal</option>
              <option value="Dalam Proses">Dalam Proses</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-gray-700">Catatan</label>
            <textarea
              name="catatan"
              value={form.catatan || ""}
              onChange={handleChange}
              rows={3}
              className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>

          <button
            type="submit"
            className="bg-yellow-600 text-white py-2 px-4 rounded hover:bg-yellow-700 transition flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" /> Simpan Perubahan
          </button>

          {message && (
            <div className="text-center font-medium text-sm text-gray-700 mt-3">{message}</div>
          )}
        </form>
      </div>
    </main>
  );
}
