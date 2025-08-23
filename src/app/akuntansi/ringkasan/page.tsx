// src/app/akuntansi/ringkasan/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Notebook,
  Tags,
  Layers,
  RefreshCcw,
  TriangleAlert,
  ArrowRight,
} from "lucide-react";

/* =============== helpers =============== */
const toIDR = (n: number = 0) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

/* =============== types (longgar) =============== */
type RingkasanAPI = {
  totalBiaya?: number;
  statusSummary?: Array<{ status: string; jumlah?: number; totalBiaya?: number }>;

  perKategori?: Array<{ nama?: string; kategori?: string; total?: number }>;
  penyusutanPerKategori?: Array<{ kategori?: string; akumulasi?: number; nilaiBuku?: number }>;
  asetPerKategori?: Array<{ kategori?: string; totalNilai?: number }>;

  jurnal?: any[];
  totalKategori?: number;
  totalUnit?: number;
};

/* =============== page =============== */
export default function RingkasanAkuntansiPage() {
  const router = useRouter();

  // ===== role guard (client) =====
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) {
        router.replace("/login");
        return;
      }
      const u = JSON.parse(raw) as { nama: string; role: string };
      setUser(u);

      const allowed = ["ADMIN", "PIMPINAN"]; // ubah kalau mau
      if (!allowed.includes(u.role)) {
        router.replace("/forbidden");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  // ===== data states =====
  const [data, setData] = useState<RingkasanAPI | null>(null);
  const [jurnalCount, setJurnalCount] = useState<number>(0);
  const [kategoriCount, setKategoriCount] = useState<number>(0);
  const [unitCount, setUnitCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  // ===== fetch =====
  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/akuntansi/laporan/ringkasan", {
        cache: "no-store",
        signal,
      });
      if (!r.ok) throw new Error(`Ringkasan: ${r.status} ${r.statusText}`);
      const json: RingkasanAPI = await r.json();

      const [jRes, kRes, uRes] = await Promise.allSettled([
        fetch("/api/akuntansi/jurnal", { cache: "no-store", signal }),
        fetch("/api/akuntansi/kategori-biaya", { cache: "no-store", signal }),
        fetch("/api/akuntansi/unit-biaya", { cache: "no-store", signal }),
      ]);

      const jOk = jRes.status === "fulfilled" && jRes.value.ok;
      const kOk = kRes.status === "fulfilled" && kRes.value.ok;
      const uOk = uRes.status === "fulfilled" && uRes.value.ok;

      const jJson = jOk ? await jRes.value!.json() : null;
      const kJson = kOk ? await kRes.value!.json() : null;
      const uJson = uOk ? await uRes.value!.json() : null;

      setData(json);
      setJurnalCount(Array.isArray(json?.jurnal) ? json!.jurnal!.length : Array.isArray(jJson) ? jJson.length : 0);
      setKategoriCount(typeof json?.totalKategori === "number" ? json!.totalKategori! : Array.isArray(kJson) ? kJson.length : 0);
      setUnitCount(typeof json?.totalUnit === "number" ? json!.totalUnit! : Array.isArray(uJson) ? uJson.length : 0);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        setErr(e?.message || "Gagal memuat ringkasan.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  // ===== normalisasi =====
  const totalBiaya = useMemo(() => {
    if (!data) return 0;
    if (typeof data.totalBiaya === "number") return data.totalBiaya;
    if (Array.isArray(data.statusSummary)) {
      return data.statusSummary.reduce((s, r) => s + (Number(r.totalBiaya) || 0), 0);
    }
    return 0;
  }, [data]);

  const perKategori = useMemo(() => {
    if (!data) return [] as Array<{ nama: string; total: number }>;
    if (Array.isArray(data.perKategori)) {
      return data.perKategori.map((x) => ({
        nama: x.nama ?? x.kategori ?? "-",
        total: Number(x.total) || 0,
      }));
    }
    if (Array.isArray(data.penyusutanPerKategori)) {
      return data.penyusutanPerKategori.map((x) => ({
        nama: x.kategori ?? "-",
        total: Number(x.nilaiBuku ?? x.akumulasi ?? 0) || 0,
      }));
    }
    if (Array.isArray(data.asetPerKategori)) {
      return data.asetPerKategori.map((x) => ({
        nama: x.kategori ?? "-",
        total: Number(x.totalNilai ?? 0) || 0,
      }));
    }
    return [];
  }, [data]);

  // ===== UI states =====
  if (!user) {
    return (
      <main className="p-6">
        <div className="animate-pulse text-gray-500">Menyiapkan halaman…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 subpixel-antialiased">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Ringkasan Akuntansi
            </h1>
            <p className="text-gray-500 text-sm">
              Hi, <b className="text-gray-700">{user.nama}</b> — pantau biaya & jurnal akuntansi terintegrasi aset.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
              title="Muat ulang data"
            >
              <RefreshCcw size={16} /> Refresh
            </button>
            <Link
              href="/akuntansi/jurnal"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              <Notebook size={16} />
              Lihat Jurnal
            </Link>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <TriangleAlert className="shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-semibold">Gagal memuat data</div>
              <div className="text-sm">{err}</div>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <Skeleton />
        ) : (
          <>
            {/* KPI */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI
                icon={<Wallet className="text-emerald-600" size={18} />}
                label="Total Biaya"
                value={toIDR(totalBiaya)}
              />
              <KPI
                icon={<Notebook className="text-indigo-600" size={18} />}
                label="Jumlah Jurnal"
                value={jurnalCount.toLocaleString("id-ID")}
              />
              <KPI
                icon={<Tags className="text-amber-600" size={18} />}
                label="Kategori Biaya"
                value={kategoriCount.toLocaleString("id-ID")}
              />
              <KPI
                icon={<Layers className="text-pink-600" size={18} />}
                label="Unit Biaya"
                value={unitCount.toLocaleString("id-ID")}
              />
            </section>

            {/* Tabel per-kategori */}
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Ringkasan per Kategori</h2>
                <Link
                  href="/akuntansi/kategori-biaya"
                  className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  Kelola Kategori <ArrowRight size={14} />
                </Link>
              </div>
              <div className="p-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Kategori</th>
                      <th className="px-3 py-2 text-left">Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {perKategori.length ? (
                      perKategori.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2">{r.nama}</td>
                          <td className="px-3 py-2">{toIDR(r.total)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-6 text-center text-gray-500" colSpan={2}>
                          Belum ada data ringkasan kategori.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

/* =============== small UI helpers =============== */
function KPI({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div className="text-gray-500">{icon}</div>
        <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      </div>
      <div className="mt-3 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <section className="animate-pulse grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="mt-3 h-7 w-32 bg-gray-200 rounded" />
        </div>
      ))}
      <div className="sm:col-span-2 lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 mt-4">
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="h-8 bg-gray-100 rounded mb-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded mb-2" />
        ))}
      </div>
    </section>
  );
}
