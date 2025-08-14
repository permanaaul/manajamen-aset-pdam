"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PDFDownloadLink } from "@react-pdf/renderer";
import LaporanPDF from "@/app/components/LaporanPDF";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  type ChartData,
} from "chart.js";
import { Bar } from "react-chartjs-2";

import {
  FileBarChart2,
  Download,
  Filter,
  RotateCcw,
  Boxes,
  BarChart3,
  ActivitySquare,
  Calendar as CalendarIcon,
  TrendingUp,
  Layers,
  Target,
  PackageSearch,
} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);

/* ============== Types ============== */
type UserLocal = { nama: string; role: string } | null;

type Strategi = "PREVENTIF" | "KOREKTIF" | "PREDIKTIF" | string;
type StatusPem = "Terjadwal" | "Dalam Proses" | "Selesai" | string;

interface Aset {
  id: number;
  nia: string;
  nama: string;
  kategori: string;
  lokasi: string;
  tahun: number;
  nilai: number | string;
  kondisi: "Baik" | "Perlu Cek" | "Rusak" | string;
}

interface Pemeliharaan {
  id: number;
  asetId?: number;
  aset?: { nia: string; nama: string; kategori?: string } | null;
  tanggal?: string; // ISO
  jenis?: string;
  pelaksana?: string;
  catatan?: string | null;
  status: StatusPem;
  biaya: number | string | null;

  // opsional (kalau schema sudah diupgrade)
  strategi?: Strategi | null;
  downtimeJam?: number | string | null;
}

/* ============== Helpers ============== */
const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
const toRupiah = (v: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(typeof v === "string" ? Number(v) : v);
const labelKategori = (k: string) => k.replace(/_/g, " ");

/* ===================================== */
export default function Laporan() {
  const router = useRouter();

  // base state
  const [user, setUser] = useState<UserLocal>(null);
  const [asets, setAsets] = useState<Aset[]>([]);
  const [pemeliharaan, setPemeliharaan] = useState<Pemeliharaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("Semua");
  const [filterStrategi, setFilterStrategi] = useState<string>("Semua");
  const [filterKategori, setFilterKategori] = useState<string>("Semua");

  // search
  const [qPem, setQPem] = useState("");
  const [qAset, setQAset] = useState("");

  /* -------- Guards -------- */
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u = JSON.parse(raw);
    setUser(u);
    if (!["ADMIN", "TEKNISI", "PIMPINAN"].includes(u.role)) {
      router.replace("/forbidden");
    }
  }, [router]);

  /* -------- Fetch -------- */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [asetRes, pemRes] = await Promise.all([
          fetch("/api/inventarisasi", { cache: "no-store" }),
          fetch("/api/pemeliharaan", { cache: "no-store" }),
        ]);
        if (!asetRes.ok || !pemRes.ok) throw new Error("Gagal memuat data laporan");

        const asetData = (await asetRes.json()) as Aset[];
        const pemData = (await pemRes.json()) as Pemeliharaan[];

        // normalisasi biaya
        const cleanPem = pemData.map((p) => ({
          ...p,
          biaya: p.biaya == null ? 0 : typeof p.biaya === "string" ? Number(p.biaya) : p.biaya,
        }));

        setAsets(asetData);
        setPemeliharaan(cleanPem);
      } catch (e: any) {
        setErrorMsg(e?.message || "Terjadi kesalahan server");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* -------- Derived: kategori options -------- */
  const kategoriOptions = useMemo(() => {
    const set = new Set<string>();
    asets.forEach((a) => set.add(a.kategori));
    return ["Semua", ...Array.from(set)];
  }, [asets]);

  /* -------- Derived: filtered aset (untuk chart kondisi) -------- */
  const asetFiltered = useMemo(() => {
    const byKategori =
      filterKategori === "Semua" ? asets : asets.filter((a) => a.kategori === filterKategori);

    if (!qAset.trim()) return byKategori;

    const key = qAset.trim().toLowerCase();
    return byKategori.filter(
      (a) =>
        a.nia.toLowerCase().includes(key) ||
        a.nama.toLowerCase().includes(key) ||
        a.lokasi.toLowerCase().includes(key) ||
        a.kategori.toLowerCase().includes(key) ||
        String(a.tahun).includes(key)
    );
  }, [asets, qAset, filterKategori]);

  /* -------- Derived: filtered pemeliharaan -------- */
  const pemFiltered = useMemo(() => {
    let list = [...pemeliharaan];

    // by tanggal
    if (fromDate) list = list.filter((p) => (p.tanggal ? p.tanggal.slice(0, 10) >= fromDate : true));
    if (toDate) list = list.filter((p) => (p.tanggal ? p.tanggal.slice(0, 10) <= toDate : true));

    // by status
    if (filterStatus !== "Semua") list = list.filter((p) => p.status === filterStatus);

    // by strategi (opsional)
    if (filterStrategi !== "Semua")
      list = list.filter((p) => (p.strategi ? String(p.strategi) === filterStrategi : false));

    // by kategori aset dari join
    if (filterKategori !== "Semua")
      list = list.filter((p) => p.aset?.kategori === filterKategori);

    // search bar detail table
    if (qPem.trim()) {
      const key = qPem.trim().toLowerCase();
      list = list.filter((p) => {
        const tanggal = p.tanggal ? new Date(p.tanggal).toLocaleDateString("id-ID") : "-";
        return (
          tanggal.toLowerCase().includes(key) ||
          (p.aset?.nia ?? "-").toLowerCase().includes(key) ||
          (p.aset?.nama ?? "-").toLowerCase().includes(key) ||
          (p.jenis ?? "-").toLowerCase().includes(key) ||
          (p.status ?? "-").toLowerCase().includes(key) ||
          (p.pelaksana ?? "-").toLowerCase().includes(key) ||
          (p.catatan ?? "-").toLowerCase().includes(key)
        );
      });
    }

    return list;
  }, [pemeliharaan, fromDate, toDate, filterStatus, filterStrategi, filterKategori, qPem]);

  /* -------- KPIs -------- */
  const totalAset = asetFiltered.length;
  const totalNilai = useMemo(
    () => asetFiltered.reduce((s, a) => s + num(a.nilai), 0),
    [asetFiltered]
  );
  const jumlahPem = pemFiltered.length;
  const totalBiayaAll = useMemo(
    () => pemFiltered.reduce((s, p) => s + num(p.biaya), 0),
    [pemFiltered]
  );
  const rataDowntime = useMemo(() => {
    const withDT = pemFiltered.filter((p) => p.downtimeJam != null);
    if (withDT.length === 0) return 0;
    const s = withDT.reduce((acc, p) => acc + num(p.downtimeJam), 0);
    return +(s / withDT.length).toFixed(1);
  }, [pemFiltered]);
  const ratioPreventifKorektif = useMemo(() => {
    const total = pemFiltered.length || 1;
    const prev = pemFiltered.filter((p) => p.strategi === "PREVENTIF").length;
    const kor = pemFiltered.filter((p) => p.strategi === "KOREKTIF").length;
    return {
      prevPct: Math.round((prev / total) * 100),
      korPct: Math.round((kor / total) * 100),
    };
  }, [pemFiltered]);

  /* -------- Chart: Kondisi Aset -------- */
  const kondisiLabels = ["Baik", "Perlu Cek", "Rusak"] as const;
  const kondisiCounts = kondisiLabels.map(
    (k) => asetFiltered.filter((a) => a.kondisi === k).length
  );
  const dataAset: ChartData<"bar", number[], string> = {
    labels: kondisiLabels as unknown as string[],
    datasets: [
      {
        label: "Jumlah Aset",
        data: kondisiCounts,
        backgroundColor: ["#16a34a", "#facc15", "#dc2626"],
        borderRadius: 6,
      },
    ],
  };

  /* -------- Chart: Status Pemeliharaan -------- */
  const statusLabels = ["Terjadwal", "Dalam Proses", "Selesai"] as const;
  const statusCounts = statusLabels.map(
    (s) => pemFiltered.filter((p) => p.status === s).length
  );
  const dataPem: ChartData<"bar", number[], string> = {
    labels: statusLabels as unknown as string[],
    datasets: [
      {
        label: "Jumlah Pemeliharaan",
        data: statusCounts,
        backgroundColor: ["#3b82f6", "#f59e0b", "#16a34a"],
        borderRadius: 6,
      },
    ],
  };

  /* -------- Table rows -------- */
  const pemRows = useMemo(() => {
    return pemFiltered.map((p) => ({
      id: p.id,
      tanggal: p.tanggal ? new Date(p.tanggal).toLocaleDateString("id-ID") : "-",
      nia: p.aset?.nia ?? "-",
      nama: p.aset?.nama ?? "-",
      jenis: p.jenis ?? "-",
      status: p.status ?? "-",
      pelaksana: p.pelaksana ?? "-",
      biaya: num(p.biaya),
      catatan: p.catatan ?? "-",
    }));
  }, [pemFiltered]);

  /* =================== AGREGAT untuk PDF =================== */

  // Ringkasan status untuk PDF (jumlah + total biaya)
  const pdfSummary = useMemo(
    () =>
      (["Terjadwal", "Dalam Proses", "Selesai"] as const).map((st) => {
        const rows = pemFiltered.filter((p) => p.status === st);
        const jumlah = rows.length;
        const totalBiaya = rows.reduce((acc, r) => acc + num(r.biaya), 0);
        return { status: st, jumlah, totalBiaya };
      }),
    [pemFiltered]
  );

  // Ringkasan aset: kondisi & per-kategori + total nilai
  const pdfAsetPerKategori = useMemo(() => {
    const map = new Map<string, { jumlah: number; totalNilai: number }>();
    for (const a of asetFiltered) {
      const k = a.kategori;
      if (!map.has(k)) map.set(k, { jumlah: 0, totalNilai: 0 });
      const rec = map.get(k)!;
      rec.jumlah += 1;
      rec.totalNilai += num(a.nilai);
    }
    return Array.from(map.entries()).map(([kategori, v]) => ({
      kategori: labelKategori(kategori),
      jumlah: v.jumlah,
      totalNilai: v.totalNilai,
    }));
  }, [asetFiltered]);

  const pdfAsetKondisi = useMemo(
    () =>
      kondisiLabels.map((k, idx) => ({
        kondisi: k,
        jumlah: kondisiCounts[idx],
      })),
    [kondisiLabels, kondisiCounts]
  );

  // Agregat strategi & downtime
  const pdfStrategiAgg = useMemo(() => {
    const map = new Map<string, { jumlah: number; totalBiaya: number }>();
    for (const p of pemFiltered) {
      const key = p.strategi ? String(p.strategi) : "";
      if (!key) continue;
      if (!map.has(key)) map.set(key, { jumlah: 0, totalBiaya: 0 });
      const rec = map.get(key)!;
      rec.jumlah += 1;
      rec.totalBiaya += num(p.biaya);
    }
    return Array.from(map.entries()).map(([strategi, v]) => ({
      strategi,
      jumlah: v.jumlah,
      totalBiaya: v.totalBiaya,
    }));
  }, [pemFiltered]);

  const pdfDowntimeAgg = useMemo(() => {
    const arr = pemFiltered.filter((p) => p.downtimeJam != null);
    if (arr.length === 0) return undefined;
    const totalJam = arr.reduce((s, p) => s + num(p.downtimeJam), 0);
    const rataJam = +(totalJam / arr.length).toFixed(1);
    return { totalJam, rataJam };
  }, [pemFiltered]);

    // --- Per kategori biaya pemeliharaan (untuk tabel Inventarisasi gabung biaya) ---
    const pdfPemPerKategori = useMemo(() => {
      const map = new Map<string, { jumlah: number; totalBiaya: number }>();
      for (const p of pemFiltered) {
        const k = p.aset?.kategori || "LAINNYA";
        if (!map.has(k)) map.set(k, { jumlah: 0, totalBiaya: 0 });
        const rec = map.get(k)!;
        rec.jumlah += 1;
        rec.totalBiaya += num(p.biaya);
      }
      return Array.from(map.entries()).map(([kategori, v]) => ({
        kategori: labelKategori(kategori),
        jumlah: v.jumlah,
        totalBiaya: v.totalBiaya,
      }));
    }, [pemFiltered]);
  
    // --- Breakdown Material/Jasa (opsional jika field ada di data) ---
    const pdfBiayaBreakdown = useMemo(() => {
      // membaca biayaMaterial & biayaJasa jika memang ada di objek p (skema opsional)
      const totalMaterial = pemFiltered.reduce((s, p: any) => s + num(p.biayaMaterial), 0);
      const totalJasa     = pemFiltered.reduce((s, p: any) => s + num(p.biayaJasa), 0);
      const total = totalMaterial + totalJasa;
      return total > 0 ? { material: totalMaterial, jasa: totalJasa } : undefined;
    }, [pemFiltered]);
  
    // --- Pilih 1 aset untuk kartu "Detail Aset" (kalau hanya satu aset yang tersisa setelah filter) ---
    const pdfAssetDetail = useMemo(() => {
      if (asetFiltered.length !== 1) return undefined;
      const a = asetFiltered[0];
      return {
        nia: a.nia,
        nama: a.nama,
        kategori: labelKategori(a.kategori),
        kondisi: a.kondisi,
        lokasi: a.lokasi,
        tahunPerolehan: a.tahun,
        nilaiPerolehan: num(a.nilai),
        // createdAt/updatedAt: bisa diisi jika kamu punya datanya
      };
    }, [asetFiltered]);
  
    // --- Kartu "Detail Pemeliharaan" ambil yang terbaru berdasarkan tanggal (opsional) ---
    const pdfPemDetailCard = useMemo(() => {
      if (pemFiltered.length === 0) return undefined;
      const sorted = [...pemFiltered].sort((a, b) => (a.tanggal || "") < (b.tanggal || "") ? 1 : -1);
      const p: any = sorted[0];
      const bm = num(p.biayaMaterial);
      const bj = num(p.biayaJasa);
      const suku: any[] = Array.isArray(p.sukuCadang) ? p.sukuCadang : [];
      return {
        tanggal: p.tanggal || "",
        jenisKegiatan: p.jenis || "-",
        pelaksana: p.pelaksana || "-",
        catatan: p.catatan || "",
        strategi: p.strategi || undefined,
        jenisPekerjaan: p.jenis || undefined,
        downtimeJam: p.downtimeJam != null ? num(p.downtimeJam) : undefined,
        biayaMaterial: bm || undefined,
        biayaJasa: bj || undefined,
        subtotalMaterialJasa: bm + bj || undefined,
        sukuCadang: suku.length
          ? suku.map((it: any) => ({
              nama: String(it.nama || "-"),
              qty: num(it.qty),
              satuan: String(it.satuan || "-"),
              harga: num(it.harga),
              subtotal: it.subtotal != null ? num(it.subtotal) : num(it.qty) * num(it.harga),
            }))
          : undefined,
      };
    }, [pemFiltered]);
  

  // Tabel detail untuk PDF (pakai ISO agar diformat di komponen PDF)
  const pdfDetails = useMemo(
    () =>
      pemFiltered.map((p) => ({
        tanggal: p.tanggal || "",
        nia: p.aset?.nia ?? "-",
        nama: p.aset?.nama ?? "-",
        jenis: p.jenis ?? "-",
        status: p.status ?? "-",
        pelaksana: p.pelaksana ?? "-",
        biaya: num(p.biaya),
        catatan: p.catatan ?? null,
      })),
    [pemFiltered]
  );

  /* -------- Misc -------- */
  const resetFilter = () => {
    setFromDate("");
    setToDate("");
    setFilterStatus("Semua");
    setFilterStrategi("Semua");
    setFilterKategori("Semua");
  };

  /* -------- Loading & Error -------- */
  if (!user || loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <div className="animate-pulse text-gray-500 text-lg">📊 Memuat laporan…</div>
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

  /* ===================================== RENDER ===================================== */
  return (
    <main className="min-h-screen bg-gray-50 text-gray-800">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-yellow-700 flex items-center gap-2">
            <FileBarChart2 className="w-7 h-7" />
            Laporan Aset & Pemeliharaan
          </h1>

          <PDFDownloadLink
  document={
    <LaporanPDF
      /* ==== ringkasan status & total biaya (sesuai filter) ==== */
      summary={pdfSummary}
      totalBiaya={totalBiayaAll}

      /* ==== meta ==== */
      meta={{
        generatedAt: new Date().toISOString(),
        generatedBy: user?.nama ?? "-",
        totalAset,
        totalPemeliharaan: jumlahPem,
        periodeLabel: fromDate || toDate ? `${fromDate || "…"} s/d ${toDate || "…"}` : "Semua data",
        organisasi: "PDAM Aset",
        filterStatus: filterStatus || "Semua",
        filterStrategi: filterStrategi || "Semua",
        filterKategori: filterKategori || "Semua",
      }}

      /* ==== detail aset (muncul jika 1 aset tersisa) ==== */
      assetDetail={pdfAssetDetail}

      /* ==== kartu penyusutan (opsional—isi jika kamu punya angka dari modul penyusutan) ==== */
      // penyusutanDetail={{ metode:"SALDO_MENURUN", nilaiBuku: 30000000, akumulasi: 270000000, mulai: 2021, umurTahun: 12, nilaiResidu: 30000000 }}

      /* ==== ringkasan inventarisasi ==== */
      asetRingkasan={{
        totalNilai: Number(totalNilai) || 0,
        perKategori: pdfAsetPerKategori,
      }}

      /* ==== agregat pemeliharaan ==== */
      maintAgg={{
        strategi: pdfStrategiAgg,
        downtime: pdfDowntimeAgg,
        biayaBreakdown: pdfBiayaBreakdown,
        perKategori: pdfPemPerKategori, // dipakai untuk kolom "Total Biaya" per kategori
      }}

      /* ==== suku cadang agregat (opsional; isi jika kamu sudah agregasi di sisi klien / API) ==== */
      // sukuCadangAgg={[{ nama:"Bearing 6203", qty:2, satuan:"pcs", total:150000 }, ...]}

      /* ==== kartu detail pemeliharaan terbaru (opsional) ==== */
      pemeliharaanDetail={pdfPemDetailCard}

      /* ==== tabel ringkas detail (opsional; tetap pakai) ==== */
      details={pdfDetails}
    />
  }
  fileName={`laporan-pemeliharaan-${new Date().toISOString().slice(0, 10)}.pdf`}
  className="inline-flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-600"
>
  <Download className="w-4 h-4" />
  Export PDF
</PDFDownloadLink>

        </div>

        {/* Filter Card */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="font-semibold">Filter</span>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-yellow-400"
              >
                {["Semua", "Terjadwal", "Dalam Proses", "Selesai"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Strategi</label>
              <select
                value={filterStrategi}
                onChange={(e) => setFilterStrategi(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-yellow-400"
              >
                {["Semua", "PREVENTIF", "KOREKTIF", "PREDIKTIF"].map((s) => (
                  <option key={s} value={s}>
                    {s === "Semua" ? "Semua" : s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Kategori Aset
              </label>
              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-yellow-400"
              >
                {kategoriOptions.map((k) => (
                  <option key={k} value={k}>
                    {k === "Semua" ? "Semua" : labelKategori(k)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-5">
              <button
                type="button"
                onClick={resetFilter}
                className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
              >
                <RotateCcw className="w-4 h-4" /> Reset Filter
              </button>
            </div>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPI
            icon={<Layers className="w-5 h-5" />}
            label="Total Aset"
            value={totalAset.toLocaleString("id-ID")}
          />
          <KPI
            icon={<TrendingUp className="w-5 h-5" />}
            label="Nilai Aset"
            value={toRupiah(totalNilai)}
          />
          <KPI
            icon={<BarChart3 className="w-5 h-5" />}
            label="Jumlah Pemeliharaan"
            value={jumlahPem.toLocaleString("id-ID")}
          />
          <KPI
            icon={<ActivitySquare className="w-5 h-5" />}
            label="Total Biaya"
            value={toRupiah(totalBiayaAll)}
          />
          <KPI
            icon={<CalendarIcon className="w-5 h-5" />}
            label="Rata-rata Downtime (jam)"
            value={rataDowntime.toString()}
          />
        </section>

        {/* Rasio strategi */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Target className="w-4 h-4" />
            <span>
              Preventif vs Korektif:{" "}
              <b className="text-emerald-700">{ratioPreventifKorektif.prevPct}%</b> :{" "}
              <b className="text-amber-700">{ratioPreventifKorektif.korPct}%</b>
            </span>
          </div>
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="Kondisi Aset (sesuai filter kategori aset)" icon={<Boxes />}>
            <Bar data={dataAset} />
          </ChartCard>
          <ChartCard title="Status Pemeliharaan" icon={<BarChart3 />}>
            <Bar data={dataPem} />
          </ChartCard>
        </section>

        {/* Tabel DETAIL Pemeliharaan */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold">Daftar Pemeliharaan</h2>
            <div className="relative">
              <PackageSearch className="absolute left-2 top-2.5 text-gray-400" size={16} />
              <input
                value={qPem}
                onChange={(e) => setQPem(e.target.value)}
                placeholder="Cari: Tanggal/NIA/Nama/Jenis/Status/Pelaksana/Catatan…"
                className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg w-[32rem] max-w-full focus:ring-2 focus:ring-yellow-400 focus:outline-none bg-white placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto bg-white border border-gray-200 rounded-2xl shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-900 text-white">
                <tr>
                  <th className="py-2 px-3 text-left whitespace-nowrap">Tanggal</th>
                  <th className="py-2 px-3 text-left whitespace-nowrap">NIA</th>
                  <th className="py-2 px-3 text-left">Nama Aset</th>
                  <th className="py-2 px-3 text-left">Jenis</th>
                  <th className="py-2 px-3 text-left">Status</th>
                  <th className="py-2 px-3 text-left">Pelaksana</th>
                  <th className="py-2 px-3 text-left whitespace-nowrap">Biaya</th>
                  <th className="py-2 px-3 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {pemRows.length > 0 ? (
                  pemRows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{r.tanggal}</td>
                      <td className="px-3 py-2 font-mono">{r.nia}</td>
                      <td className="px-3 py-2">{r.nama}</td>
                      <td className="px-3 py-2">{r.jenis}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2">{r.pelaksana}</td>
                      <td className="px-3 py-2">{toRupiah(r.biaya)}</td>
                      <td className="px-3 py-2">{r.catatan}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                      {pemeliharaan.length === 0
                        ? "Belum ada data pemeliharaan."
                        : "Tidak ada hasil sesuai pencarian / filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-gray-600">
            Menampilkan <b>{pemRows.length}</b> dari <b>{pemeliharaan.length}</b> pemeliharaan.
          </div>
        </section>

        {/* Tabel Aset */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold">Daftar Aset</h2>
            <div className="relative">
              <PackageSearch className="absolute left-2 top-2.5 text-gray-400" size={16} />
              <input
                value={qAset}
                onChange={(e) => setQAset(e.target.value)}
                placeholder="Cari aset: NIA/Nama/Kategori/Lokasi/Tahun…"
                className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg w-80 focus:ring-2 focus:ring-yellow-400 focus:outline-none bg-white placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto bg-white border border-gray-200 rounded-2xl shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="py-2 px-4 text-left">NIA</th>
                  <th className="py-2 px-4 text-left">Nama</th>
                  <th className="py-2 px-4 text-left">Kategori</th>
                  <th className="py-2 px-4 text-left">Lokasi</th>
                  <th className="py-2 px-4 text-left">Tahun</th>
                  <th className="py-2 px-4 text-left">Nilai</th>
                  <th className="py-2 px-4 text-left">Kondisi</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {asetFiltered.length > 0 ? (
                  asetFiltered.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono">{a.nia}</td>
                      <td className="px-4 py-2">{a.nama}</td>
                      <td className="px-4 py-2">{labelKategori(a.kategori)}</td>
                      <td className="px-4 py-2">{a.lokasi}</td>
                      <td className="px-4 py-2">{a.tahun}</td>
                      <td className="px-4 py-2">{toRupiah(num(a.nilai))}</td>
                      <td className="px-4 py-2">{a.kondisi}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      {asets.length === 0
                        ? "Belum ada data aset."
                        : "Tidak ada hasil sesuai pencarian / filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-gray-600">
            Menampilkan <b>{asetFiltered.length}</b> dari <b>{asets.length}</b> aset.
          </div>
        </section>
      </div>
    </main>
  );
}

/* ============== Small UI helpers ============== */
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

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2 text-gray-700">
        <span className="text-gray-500">{icon}</span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
