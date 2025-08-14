"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
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
  CalendarClock,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  FileText,
} from "lucide-react";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  ChartTitle,
  Tooltip,
  Legend
);

interface Aset {
  id: number;
  nama: string;
  kondisi: string; // "Baik" | "Perlu Cek" | "Rusak" | string
}

interface Pemeliharaan {
  id: number;
  aset?: { nama: string } | null;
  tanggal: string; // ISO
  status: string; // "Terjadwal" | "Dalam Proses" | "Selesai" | string
  pelaksana: string;
  biaya: number | string;
}

/* Helpers */
const num = (v: number | string | null | undefined) =>
  v == null || v === "" ? 0 : Number(v);
const toIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const badgeClass = (status: string) => {
  switch (status) {
    case "Terjadwal":
      return "bg-blue-500/10 text-blue-700 ring-1 ring-blue-200";
    case "Dalam Proses":
      return "bg-amber-400/20 text-amber-700 ring-1 ring-amber-200";
    case "Selesai":
      return "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-200";
    default:
      return "bg-gray-500/10 text-gray-700 ring-1 ring-gray-200";
  }
};

export default function DashboardPage() {
  const router = useRouter();

  /* === State hooks (urutan tetap) === */
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [asets, setAsets] = useState<Aset[]>([]);
  const [pemeliharaan, setPemeliharaan] = useState<Pemeliharaan[]>([]);
  const [loading, setLoading] = useState(true);

  /* === Effects === */
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
    else router.replace("/login");
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [asetRes, pemRes] = await Promise.all([
          fetch("/api/inventarisasi", { cache: "no-store" }),
          fetch("/api/pemeliharaan", { cache: "no-store" }),
        ]);
        const asetData = asetRes.ok ? await asetRes.json() : [];
        const pemData = pemRes.ok ? await pemRes.json() : [];
        setAsets(asetData);
        setPemeliharaan(
          (pemData as Pemeliharaan[]).map((p) => ({ ...p, biaya: num(p.biaya) }))
        );
      } catch (err) {
        console.error("Gagal fetch dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* === Derived values (semua sebelum return) === */
  const kondisiCounts = useMemo(
    () => ({
      Baik: asets.filter((a) => a.kondisi === "Baik").length,
      "Perlu Cek": asets.filter((a) => a.kondisi === "Perlu Cek").length,
      Rusak: asets.filter((a) => a.kondisi === "Rusak").length,
    }),
    [asets]
  );

  const statusCounts = useMemo(
    () => ({
      Terjadwal: pemeliharaan.filter((p) => p.status === "Terjadwal").length,
      "Dalam Proses": pemeliharaan.filter((p) => p.status === "Dalam Proses").length,
      Selesai: pemeliharaan.filter((p) => p.status === "Selesai").length,
    }),
    [pemeliharaan]
  );

  const totalAset = asets.length;
  const totalKegiatan =
    statusCounts.Terjadwal +
    statusCounts["Dalam Proses"] +
    statusCounts.Selesai;
  const totalBiaya = useMemo(
    () => pemeliharaan.reduce((sum, p) => sum + num(p.biaya), 0),
    [pemeliharaan]
  );
  const completionRate = useMemo(
    () =>
      totalKegiatan === 0
        ? 0
        : Math.round((statusCounts.Selesai / totalKegiatan) * 100),
    [statusCounts, totalKegiatan]
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const upcoming = useMemo(
    () =>
      [...pemeliharaan]
        .filter((p) => (p.tanggal ? new Date(p.tanggal) >= today : false))
        .sort(
          (a, b) =>
            new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
        )
        .slice(0, 6),
    [pemeliharaan, today]
  );

  // === Pengganti kartu "Terlambat": Hotspot Aset (12 bulan) ===
  const lastYearStart = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const hotspotAssets = useMemo(() => {
    const map = new Map<
      string,
      { count: number; lastISO: string | null; biaya: number }
    >();
    for (const p of pemeliharaan) {
      if (!p.tanggal) continue;
      const t = new Date(p.tanggal);
      if (t < lastYearStart) continue;
      const key = p.aset?.nama || "(Tanpa Nama)";
      const curr = map.get(key) || { count: 0, lastISO: null, biaya: 0 };
      curr.count += 1;
      curr.biaya += num(p.biaya);
      if (!curr.lastISO || t > new Date(curr.lastISO)) curr.lastISO = p.tanggal;
      map.set(key, curr);
    }
    return Array.from(map.entries())
      .map(([nama, v]) => ({
        nama,
        count: v.count,
        last: v.lastISO ? new Date(v.lastISO) : null,
        biaya: v.biaya,
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          (b.last?.getTime() || 0) - (a.last?.getTime() || 0)
      )
      .slice(0, 6);
  }, [pemeliharaan, lastYearStart]);

  const pieData = useMemo(
    () => ({
      labels: ["Baik", "Perlu Cek", "Rusak"],
      datasets: [
        {
          data: [
            kondisiCounts.Baik,
            kondisiCounts["Perlu Cek"],
            kondisiCounts.Rusak,
          ],
          backgroundColor: ["#16a34a", "#facc15", "#dc2626"],
          borderWidth: 0,
        },
      ],
    }),
    [kondisiCounts]
  );

  const barData = useMemo(
    () => ({
      labels: ["Terjadwal", "Dalam Proses", "Selesai"],
      datasets: [
        {
          label: "Jumlah Pemeliharaan",
          data: [
            statusCounts.Terjadwal,
            statusCounts["Dalam Proses"],
            statusCounts.Selesai,
          ],
          backgroundColor: ["#3b82f6", "#f59e0b", "#16a34a"],
          borderRadius: 8,
        },
      ],
    }),
    [statusCounts]
  );

  const chartOptions = useMemo(
    () =>
      ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      }) as const,
    []
  );

  /* === Guards === */
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

  /* === UI === */
  return (
    <main className="min-h-screen bg-gray-50 text-gray-800">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-blue-700">
              Halo, {user.nama.split(" ")[0]} 👋
            </h1>
            <p className="text-sm text-gray-600">
              Peran: <span className="font-semibold">{user.role}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/pemeliharaan/tambah"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm"
            >
              <PlusCircle className="w-4 h-4" /> Tambah Pemeliharaan
            </Link>
            <Link
              href="/laporan"
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg hover:bg-white text-sm"
            >
              <FileText className="w-4 h-4" /> Lihat Laporan
            </Link>
          </div>
        </header>

        {/* KPI Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI
            icon={<Activity className="w-5 h-5 text-blue-600" />}
            label="Total Aset"
            value={totalAset.toLocaleString("id-ID")}
            hint={`${kondisiCounts.Baik} baik • ${kondisiCounts["Perlu Cek"]} perlu cek • ${kondisiCounts.Rusak} rusak`}
          />
          <KPI
            icon={<Wrench className="w-5 h-5 text-amber-600" />}
            label="Aktivitas Pemeliharaan"
            value={totalKegiatan.toLocaleString("id-ID")}
            hint={`${statusCounts.Terjadwal} terjadwal • ${statusCounts["Dalam Proses"]} proses • ${statusCounts.Selesai} selesai`}
          />
          <KPI
            icon={<Coins className="w-5 h-5 text-rose-600" />}
            label="Total Biaya"
            value={toIDR(totalBiaya)}
            hint="Akumulasi seluruh kegiatan"
          />
          <KPI
            icon={<BadgeCheck className="w-5 h-5 text-emerald-600" />}
            label="Completion Rate"
            value={`${completionRate}%`}
            hint="Selesai ÷ total kegiatan"
          />
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Kondisi Aset" icon={<PieChart className="w-5 h-5 text-emerald-700" />}>
            <div className="h-64">
              <Pie data={pieData} />
            </div>
          </Card>

        <Card title="Status Pemeliharaan" icon={<BarChart className="w-5 h-5 text-blue-700" />}>
            <div className="h-64">
              <Bar data={barData} options={chartOptions} />
            </div>
          </Card>
        </section>

        {/* 3 kolom: Upcoming, Hotspot Aset, Top Cost */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <ListCard
            title="Pemeliharaan Terdekat"
            icon={<CalendarClock className="w-5 h-5 text-blue-700" />}
            emptyText="Tidak ada jadwal pemeliharaan terdekat."
            rows={upcoming.map((p) => ({
              id: p.id,
              left: p.aset?.nama || "-",
              right: new Date(p.tanggal).toLocaleDateString("id-ID"),
              meta: p.pelaksana || "-",
              badge: p.status,
            }))}
          />

          <ListCard
            title="Hotspot Aset (12 bulan)"
            icon={<AlertTriangle className="w-5 h-5 text-amber-700" />}
            emptyText="Belum ada data pemeliharaan dalam 12 bulan terakhir."
            rows={hotspotAssets.map((h) => ({
              id: h.nama,
              left: h.nama,
              right: `${h.count}x`,
              meta: `${h.last ? "Terakhir: " + h.last.toLocaleDateString("id-ID") + " • " : ""}Biaya: ${toIDR(
                h.biaya
              )}`,
            }))}
            footer={
              hotspotAssets.length > 0 ? (
                <div className="text-sm text-amber-700">
                  Prioritaskan inspeksi preventif untuk mengurangi frekuensi & biaya.
                </div>
              ) : null
            }
          />

          <Card title="Biaya Terbesar" icon={<Coins className="w-5 h-5 text-rose-700" />}>
            {pemeliharaan.length === 0 ? (
              <div className="text-sm text-gray-500">Belum ada data biaya.</div>
            ) : (
              <ul className="divide-y">
                {[...pemeliharaan]
                  .sort((a, b) => num(b.biaya) - num(a.biaya))
                  .slice(0, 6)
                  .map((p) => (
                    <li key={p.id} className="py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.aset?.nama || "-"}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(p.tanggal).toLocaleDateString("id-ID")} • {p.pelaksana || "-"}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-rose-700">{toIDR(num(p.biaya))}</div>
                    </li>
                  ))}
              </ul>
            )}
            <div className="mt-3">
              <Link
                href="/pemeliharaan"
                className="inline-flex items-center gap-2 text-blue-700 hover:underline text-sm"
              >
                Lihat semua <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

/* ==== UI Blocks ==== */
function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div>{icon}</div>
        <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      </div>
      <div className="mt-3 text-2xl font-extrabold text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function ListCard({
  title,
  icon,
  rows,
  emptyText,
  footer,
}: {
  title: string;
  icon?: React.ReactNode;
  rows: {
    id: number | string;
    left: string;
    right: string;
    meta?: string;
    badge?: string;
    badgeOverrideClass?: string;
  }[];
  emptyText: string;
  footer?: React.ReactNode;
}) {
  return (
    <Card title={title} icon={icon}>
      {rows.length === 0 ? (
        <div className="text-sm text-gray-500">{emptyText}</div>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{r.left}</div>
                <div className="text-xs text-gray-500">{r.meta}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {r.badge && (
                  <span
                    className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                      r.badgeOverrideClass || badgeClass(r.badge)
                    }`}
                  >
                    {r.badge}
                  </span>
                )}
                <div className="text-sm text-gray-700">{r.right}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="pt-3">{footer}</div>}
    </Card>
  );
}
