"use client";

import { useEffect, useState } from "react";
import { Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  BarChart,
  PieChart,
  Loader2,
  Activity,
  BadgeCheck,
  Wrench,
  Coins,
} from "lucide-react";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Aset {
  id: number;
  nama: string;
  kondisi: string;
}

interface Pemeliharaan {
  id: number;
  aset?: { nama: string } | null;
  tanggal: string;
  status: string;
  pelaksana: string;
  biaya: number | string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [asets, setAsets] = useState<Aset[]>([]);
  const [pemeliharaan, setPemeliharaan] = useState<Pemeliharaan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [asetRes, pemeliharaanRes] = await Promise.all([
          fetch("/api/inventarisasi"),
          fetch("/api/pemeliharaan"),
        ]);

        const asetData = asetRes.ok ? await asetRes.json() : [];
        const pemeliharaanData = pemeliharaanRes.ok
          ? await pemeliharaanRes.json()
          : [];

        setAsets(asetData);
        setPemeliharaan(pemeliharaanData);
      } catch (err) {
        console.error("Gagal fetch dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (!user) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">🔒 Memeriksa otentikasi pengguna...</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen text-gray-500">
        <Loader2 className="animate-spin w-8 h-8 mb-4" />
        Memuat data dashboard...
      </main>
    );
  }

  const kondisiCounts = {
    Baik: asets.filter((a) => a.kondisi === "Baik").length,
    "Perlu Cek": asets.filter((a) => a.kondisi === "Perlu Cek").length,
    Rusak: asets.filter((a) => a.kondisi === "Rusak").length,
  };

  const statusCounts = {
    Terjadwal: pemeliharaan.filter((p) => p.status === "Terjadwal").length,
    "Dalam Proses": pemeliharaan.filter((p) => p.status === "Dalam Proses").length,
    Selesai: pemeliharaan.filter((p) => p.status === "Selesai").length,
  };

  const totalBiaya = pemeliharaan.reduce(
    (sum, p) => sum + (Number(p.biaya) || 0),
    0
  );

  const formatRupiah = (angka: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(angka);

  const pieData = {
    labels: ["Baik", "Perlu Cek", "Rusak"],
    datasets: [
      {
        data: [
          kondisiCounts.Baik,
          kondisiCounts["Perlu Cek"],
          kondisiCounts.Rusak,
        ],
        backgroundColor: ["#16a34a", "#facc15", "#dc2626"],
      },
    ],
  };

  const barData = {
    labels: ["Terjadwal", "Dalam Proses", "Selesai"],
    datasets: [
      {
        label: "Jumlah Pemeliharaan",
        data: [
          statusCounts.Terjadwal,
          statusCounts["Dalam Proses"],
          statusCounts.Selesai,
        ],
        backgroundColor: ["#3b82f6", "#facc15", "#16a34a"],
      },
    ],
  };

  const upcoming = pemeliharaan
    .filter((p) => new Date(p.tanggal) >= new Date())
    .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
    .slice(0, 5);

  const badgeStatus = (status: string) => {
    switch (status) {
      case "Terjadwal":
        return "bg-blue-500 text-white";
      case "Dalam Proses":
        return "bg-yellow-400 text-black";
      case "Selesai":
        return "bg-green-600 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  return (
    <main className="p-6 bg-gray-50 min-h-screen text-gray-800">
      <h1 className="text-3xl font-bold text-blue-700 mb-4">
        Selamat Datang, {user.nama}
      </h1>
      <p className="text-lg text-gray-700 mb-6">
        Anda login sebagai <span className="font-semibold">{user.role}</span>.
      </p>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow text-center hover:shadow-md transition">
          <Activity className="mx-auto text-blue-500 mb-2" />
          <h3 className="text-gray-600 font-semibold">Total Aset</h3>
          <p className="text-2xl font-bold">{asets.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow text-center hover:shadow-md transition">
          <BadgeCheck className="mx-auto text-green-600 mb-2" />
          <h3 className="text-gray-600 font-semibold">Aset Baik</h3>
          <p className="text-2xl font-bold text-green-600">{kondisiCounts.Baik}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow text-center hover:shadow-md transition">
          <Wrench className="mx-auto text-yellow-500 mb-2" />
          <h3 className="text-gray-600 font-semibold">Pemeliharaan Terjadwal</h3>
          <p className="text-2xl font-bold text-blue-600">
            {statusCounts.Terjadwal}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow text-center hover:shadow-md transition">
          <Coins className="mx-auto text-red-500 mb-2" />
          <h3 className="text-gray-600 font-semibold">Total Biaya</h3>
          <p className="text-xl font-bold text-red-600">{formatRupiah(totalBiaya)}</p>
        </div>
      </div>

      {/* Grafik */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-bold mb-4 text-gray-700 flex items-center gap-2">
            <PieChart className="w-5 h-5" /> Kondisi Aset
          </h2>
          <Pie data={pieData} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-bold mb-4 text-gray-700 flex items-center gap-2">
            <BarChart className="w-5 h-5" /> Status Pemeliharaan
          </h2>
          <Bar data={barData} />
        </div>
      </div>

      {/* Reminder */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-bold mb-4 text-gray-700">
          Pemeliharaan Terdekat
        </h2>
        {upcoming.length > 0 ? (
          <table className="min-w-full border rounded">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="px-4 py-2 text-left">Nama Aset</th>
                <th className="px-4 py-2 text-left">Tanggal</th>
                <th className="px-4 py-2 text-left">Petugas</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-2">{p.aset?.nama || "-"}</td>
                  <td className="px-4 py-2">
                    {new Date(p.tanggal).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-4 py-2">{p.pelaksana}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeStatus(
                        p.status
                      )}`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">Tidak ada jadwal pemeliharaan terdekat.</p>
        )}
      </div>
    </main>
  );
}
