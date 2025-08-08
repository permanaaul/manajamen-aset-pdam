"use client";

import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useRouter } from "next/navigation";
import { BarChart3, ActivitySquare, FileBarChart2 } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Aset {
  id: number;
  kondisi: string;
}

interface Pemeliharaan {
  id: number;
  status: string;
  biaya: number;
}

export default function Laporan() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [asets, setAsets] = useState<Aset[]>([]);
  const [pemeliharaan, setPemeliharaan] = useState<Pemeliharaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [periode, setPeriode] = useState({ bulan: "08", tahun: "2025" });
  const router = useRouter();

  // Proteksi role
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.replace("/login");
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    if (!["ADMIN", "TEKNISI", "PIMPINAN"].includes(parsedUser.role)) {
      router.replace("/forbidden");
    }
  }, [router]);

  // Fetch data aset dan pemeliharaan
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [asetRes, pemeliharaanRes] = await Promise.all([
          fetch("/api/inventarisasi"),
          fetch("/api/pemeliharaan"),
        ]);

        if (!asetRes.ok || !pemeliharaanRes.ok) {
          throw new Error("Gagal memuat data laporan");
        }

        const asetData = await asetRes.json();
        const pemeliharaanData = await pemeliharaanRes.json();

        const cleanPemeliharaan = pemeliharaanData.map((p: any) => ({
          ...p,
          biaya: typeof p.biaya === "string" ? parseFloat(p.biaya) : p.biaya || 0,
        }));

        setAsets(asetData);
        setPemeliharaan(cleanPemeliharaan);
      } catch (err: any) {
        console.error("Error laporan:", err);
        setErrorMsg(err.message || "Terjadi kesalahan server");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (!user || loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <div className="animate-pulse text-gray-500 text-lg">📊 Memuat laporan...</div>
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

  // Hitung jumlah kondisi aset
  const kondisiCounts = ["Baik", "Perlu Cek", "Rusak"].map((kondisi) =>
    asets.filter((a) => a.kondisi === kondisi).length
  );

  // Ringkasan status pemeliharaan
  const statusList = ["Terjadwal", "Dalam Proses", "Selesai"];
  const pemeliharaanSummary = statusList.map((status) => {
    const items = pemeliharaan.filter((p) => p.status === status);
    const totalBiaya = items.reduce((sum, p) => sum + (p.biaya || 0), 0);
    return { status, jumlah: items.length, totalBiaya };
  });

  const totalSeluruhBiaya = pemeliharaanSummary.reduce((sum, s) => sum + s.totalBiaya, 0);

  const dataAset = {
    labels: ["Baik", "Perlu Cek", "Rusak"],
    datasets: [
      {
        label: "Jumlah Aset",
        data: kondisiCounts,
        backgroundColor: ["#16a34a", "#facc15", "#dc2626"],
        borderRadius: 4,
      },
    ],
  };

  const dataPemeliharaan = {
    labels: statusList,
    datasets: [
      {
        label: "Jumlah Pemeliharaan",
        data: pemeliharaanSummary.map((s) => s.jumlah),
        backgroundColor: ["#3b82f6", "#facc15", "#16a34a"],
        borderRadius: 4,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800">
      <div className="p-6 space-y-10 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-700 flex items-center gap-2">
          <FileBarChart2 className="w-7 h-7" /> Laporan Aset & Pemeliharaan
        </h1>

        {/* Filter Periode */}
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">Bulan</label>
            <select
              value={periode.bulan}
              onChange={(e) => setPeriode({ ...periode, bulan: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-yellow-500"
            >
              {[
                "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
              ].map((bulan, idx) => (
                <option key={idx} value={(idx + 1).toString().padStart(2, "0")}>
                  {bulan}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tahun</label>
            <input
              type="number"
              value={periode.tahun}
              onChange={(e) => setPeriode({ ...periode, tahun: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2 w-24 focus:ring-2 focus:ring-yellow-500"
            />
          </div>
        </div>

        {/* Grafik Aset */}
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-3 text-green-700">
            <ActivitySquare className="w-5 h-5" />
            Rekapitulasi Kondisi Aset
          </h2>
          <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition duration-300">
            <Bar data={dataAset} />
          </div>
        </div>

        {/* Grafik Pemeliharaan */}
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-3 text-blue-700">
            <BarChart3 className="w-5 h-5" />
            Rekapitulasi Status Pemeliharaan
          </h2>
          <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition duration-300">
            <Bar data={dataPemeliharaan} />
          </div>
        </div>

        {/* Tabel Ringkasan */}
        <div>
          <h2 className="text-xl font-bold mb-4">
            Ringkasan Pemeliharaan ({periode.bulan}/{periode.tahun})
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded shadow-sm text-sm">
              <thead className="bg-yellow-500 text-white">
                <tr>
                  <th className="py-2 px-4 text-left">Status</th>
                  <th className="py-2 px-4 text-left">Jumlah</th>
                  <th className="py-2 px-4 text-left">Total Biaya</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {pemeliharaanSummary.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-100">
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">{row.jumlah}</td>
                    <td className="px-4 py-2">
                      Rp {row.totalBiaya.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-2 text-right" colSpan={2}>
                    Total Seluruh Biaya
                  </td>
                  <td className="px-4 py-2">
                    Rp {totalSeluruhBiaya.toLocaleString("id-ID")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
