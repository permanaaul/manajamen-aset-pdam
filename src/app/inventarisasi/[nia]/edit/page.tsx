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
  StickyNote,
} from "lucide-react";
import { KATEGORI_ASET, type KategoriAset } from "@/app/constants/kategoriAset";

// union lokal (hindari import enum prisma di client)
type MetodePenyusutan = "GARIS_LURUS" | "SALDO_MENURUN";
type GolonganDepresiasi =
  | "GOL_I"
  | "GOL_II"
  | "GOL_III"
  | "GOL_IV"
  | "BANGUNAN_PERMANEN"
  | "BANGUNAN_NON_PERMANEN";

type AsetAPI = {
  nama: string;
  kategori: KategoriAset | string;
  nia: string;
  lokasi: string;
  tahun: number;
  nilai: string;
  kondisi: "Baik" | "Perlu Cek" | "Rusak" | string;
  catatan?: string | null;

  tanggalOperasi?: string | null;
  mulaiPenyusutan?: string | null;
  umurManfaatTahun?: number | null;
  nilaiResidu?: string | null;
  metodePenyusutan?: MetodePenyusutan | null;
  golonganDepresiasi?: GolonganDepresiasi | null;
};

type FormState = {
  nama: string;
  kategori: KategoriAset | "";
  nia: string;
  lokasi: string;
  tahun: string;
  nilai: string;
  kondisi: "Baik" | "Perlu Cek" | "Rusak" | "";
  catatan: string;

  tanggalOperasi: string;     // yyyy-mm-dd
  mulaiPenyusutan: string;    // yyyy-mm-dd
  umurManfaatTahun: string;
  nilaiResidu: string;
  metodePenyusutan: MetodePenyusutan | "";
  golonganDepresiasi: GolonganDepresiasi | "";
};

const GOL_OPTIONS: GolonganDepresiasi[] = [
  "GOL_I",
  "GOL_II",
  "GOL_III",
  "GOL_IV",
  "BANGUNAN_PERMANEN",
  "BANGUNAN_NON_PERMANEN",
];

export default function EditAset() {
  const { nia } = useParams<{ nia: string }>();
  const router = useRouter();

  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // guard ADMIN
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { router.replace("/login"); return; }
    const parsed = JSON.parse(storedUser);
    if (parsed.role !== "ADMIN") { router.replace("/forbidden"); }
  }, [router]);

  // load data aset
  useEffect(() => {
    const fetchAset = async () => {
      try {
        const res = await fetch(`/api/inventarisasi/${nia}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Aset tidak ditemukan");
        const data: AsetAPI = await res.json();

        const toISODate = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

        setForm({
          nama: data.nama ?? "",
          kategori: (data.kategori as KategoriAset) ?? "",
          nia: data.nia ?? "",
          lokasi: data.lokasi ?? "",
          tahun: String(data.tahun ?? ""),
          nilai: String(data.nilai ?? ""),
          kondisi: (data.kondisi as any) ?? "",
          catatan: data.catatan ?? "",

          tanggalOperasi: toISODate(data.tanggalOperasi),
          mulaiPenyusutan: toISODate(data.mulaiPenyusutan),
          umurManfaatTahun: data.umurManfaatTahun != null ? String(data.umurManfaatTahun) : "",
          nilaiResidu: data.nilaiResidu != null ? String(data.nilaiResidu) : "",
          metodePenyusutan: (data.metodePenyusutan as MetodePenyusutan) ?? "",
          golonganDepresiasi: (data.golonganDepresiasi as GolonganDepresiasi) ?? "",
        });
      } catch {
        setForm(null);
      } finally {
        setLoading(false);
      }
    };
    if (nia) fetchAset();
  }, [nia]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    if (!form) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = (f: FormState): string | null => {
    if (!f.nama || !f.kategori || !f.lokasi || !f.tahun || !f.nilai || !f.kondisi) {
      return "Semua field wajib diisi (kecuali catatan).";
    }
    if (!/^\d+$/.test(f.tahun)) return "Tahun harus bilangan bulat.";
    const th = Number(f.tahun);
    const now = new Date().getFullYear();
    if (th < 1900 || th > now) return `Tahun harus antara 1900–${now}.`;
    if (!/^\d+(\.\d{1,2})?$/.test(f.nilai)) return "Nilai harus desimal valid (maks 2 digit di belakang koma).";

    const isTanah = f.kategori === "TANAH";
    if (!isTanah) {
      if (f.umurManfaatTahun) {
        if (!/^\d+$/.test(f.umurManfaatTahun) || Number(f.umurManfaatTahun) <= 0) {
          return "Umur manfaat harus bilangan bulat positif.";
        }
      }
      if (f.nilaiResidu && !/^\d+(\.\d{1,2})?$/.test(f.nilaiResidu)) {
        return "Nilai residu harus desimal (maks 2 digit di belakang koma).";
      }
      if (f.metodePenyusutan === "SALDO_MENURUN" && !f.golonganDepresiasi) {
        return "Pilih golongan depresiasi untuk metode Saldo Menurun.";
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const err = validate(form);
    if (err) {
      setToast(`❌ ${err}`);
      setTimeout(() => setToast(null), 1500);
      return;
    }

    const isTanah = form.kategori === "TANAH";
    const payload: any = {
      nama: form.nama,
      kategori: form.kategori,
      lokasi: form.lokasi,
      tahun: Number(form.tahun),
      nilai: form.nilai,
      kondisi: form.kondisi,
      catatan: form.catatan || null,
    };

    if (!isTanah) {
      if (form.tanggalOperasi) payload.tanggalOperasi = form.tanggalOperasi;
      if (form.mulaiPenyusutan) payload.mulaiPenyusutan = form.mulaiPenyusutan;
      if (form.umurManfaatTahun) payload.umurManfaatTahun = Number(form.umurManfaatTahun);
      if (form.nilaiResidu) payload.nilaiResidu = form.nilaiResidu;
      if (form.metodePenyusutan) payload.metodePenyusutan = form.metodePenyusutan;
      if (form.golonganDepresiasi) payload.golonganDepresiasi = form.golonganDepresiasi;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventarisasi/${nia}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Gagal memperbarui aset");
      }

      setToast("✅ Aset berhasil diperbarui");
      setTimeout(() => router.push(`/inventarisasi/${nia}`), 800);
    } catch (err: any) {
      setToast(`❌ ${err.message || "Terjadi kesalahan"}`);
      setTimeout(() => setToast(null), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 h-64 bg-white rounded-2xl border border-slate-200 shadow-sm animate-pulse" />
          <div className="h-64 bg-white rounded-2xl border border-slate-200 shadow-sm animate-pulse" />
        </div>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">❌ Data aset tidak ditemukan</p>
          <button onClick={() => router.back()} className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
            <ArrowLeft size={16}/> Kembali
          </button>
        </div>
      </main>
    );
  }

  const yearMax = new Date().getFullYear();
  const isTanah = form.kategori === "TANAH";
  const showGolongan = !isTanah && form.metodePenyusutan === "SALDO_MENURUN";

  return (
    <main className="min-h-screen bg-slate-50 antialiased">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Package className="text-yellow-600" size={24} /> Edit Aset
          </h1>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline"
          >
            <ArrowLeft size={16}/> Kembali
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card kiri: Data Aset */}
          <section className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Data Aset</h2>
              <p className="text-xs text-slate-500 mt-0.5">Lengkapi informasi umum aset.</p>
            </div>

            <div className="p-6 grid grid-cols-1 gap-5 text-slate-900">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Tag size={16}/> Nama Aset
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Barcode size={16}/> Nomor Induk Aset (NIA)
                  </label>
                  <input
                    type="text"
                    name="nia"
                    value={form.nia}
                    disabled
                    className="w-full border rounded px-3 py-2 mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Tag size={16}/> Kategori
                  </label>
                  <select
                    name="kategori"
                    value={form.kategori}
                    onChange={handleChange}
                    required
                    className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300 bg-white"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {KATEGORI_ASET.map((k) => (
                      <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <MapPin size={16}/> Lokasi
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Calendar size={16}/> Tahun Perolehan
                  </label>
                  <input
                    type="number"
                    name="tahun"
                    min={1900}
                    max={yearMax}
                    value={form.tahun}
                    onChange={handleChange}
                    required
                    className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Coins size={16}/> Nilai Perolehan (Rp)
                  </label>
                  <input
                    type="number"
                    name="nilai"
                    min="0"
                    step="0.01"
                    value={form.nilai}
                    onChange={handleChange}
                    required
                    className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  />
                  <p className="text-xs text-slate-500 mt-1">Contoh: 1250000.50 (maks 2 digit desimal).</p>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <AlertTriangle size={16}/> Kondisi
                </label>
                <select
                  name="kondisi"
                  value={form.kondisi}
                  onChange={handleChange}
                  required
                  className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300 bg-white"
                >
                  <option value="">-- Pilih Kondisi --</option>
                  <option value="Baik">Baik</option>
                  <option value="Perlu Cek">Perlu Cek</option>
                  <option value="Rusak">Rusak</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <StickyNote size={16}/> Catatan (opsional)
                </label>
                <textarea
                  name="catatan"
                  value={form.catatan}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Contoh: Sudah ganti impeller 2024/05, jadwalkan preventive 6 bulanan."
                  className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
            </div>
          </section>

          {/* Card kanan: Pengaturan Penyusutan */}
          <section className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${isTanah ? "opacity-60" : ""}`}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Pengaturan Penyusutan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isTanah
                  ? "Kategori TANAH tidak disusutkan (bagian ini dinonaktifkan)."
                  : "Opsional. Kosongkan untuk memakai default kategori aset."}
              </p>
            </div>

            <div className="p-6 grid grid-cols-1 gap-4 text-slate-900">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tanggal Operasi</label>
                <input
                  type="date"
                  name="tanggalOperasi"
                  value={form.tanggalOperasi}
                  onChange={handleChange}
                  disabled={isTanah}
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Mulai Penyusutan</label>
                <input
                  type="date"
                  name="mulaiPenyusutan"
                  value={form.mulaiPenyusutan}
                  onChange={handleChange}
                  disabled={isTanah}
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Umur Manfaat (tahun)</label>
                <input
                  type="number"
                  name="umurManfaatTahun"
                  min={1}
                  step={1}
                  value={form.umurManfaatTahun}
                  onChange={handleChange}
                  disabled={isTanah}
                  placeholder="Kosongkan untuk default"
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Nilai Residu (Rp)</label>
                <input
                  type="number"
                  name="nilaiResidu"
                  min="0"
                  step="0.01"
                  value={form.nilaiResidu}
                  onChange={handleChange}
                  disabled={isTanah}
                  placeholder="0"
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Metode Penyusutan</label>
                <select
                  name="metodePenyusutan"
                  value={form.metodePenyusutan}
                  onChange={handleChange}
                  disabled={isTanah}
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-yellow-300 focus:outline-none bg-white"
                >
                  <option value="">(Default per kategori)</option>
                  <option value="GARIS_LURUS">Garis Lurus</option>
                  <option value="SALDO_MENURUN">Saldo Menurun</option>
                </select>
              </div>

              {form.metodePenyusutan === "SALDO_MENURUN" && !isTanah && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Golongan Depresiasi</label>
                  <select
                    name="golonganDepresiasi"
                    value={form.golonganDepresiasi}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-yellow-300 focus:outline-none bg-white"
                  >
                    <option value="">-- Pilih Golongan --</option>
                    {GOL_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Wajib untuk metode Saldo Menurun / bangunan.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Action bar */}
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-2 bg-yellow-600 text-white py-2 px-4 rounded-md transition ${
                submitting ? "opacity-60 cursor-not-allowed" : "hover:bg-yellow-700"
              }`}
            >
              <Save size={18}/> {submitting ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 bg-black/90 text-white text-sm px-3 py-2 rounded-md shadow">
            {toast}
          </div>
        )}
      </div>
    </main>
  );
}
