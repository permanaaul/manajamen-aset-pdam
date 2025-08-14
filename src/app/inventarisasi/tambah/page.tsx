"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KATEGORI_ASET, type KategoriAset } from "@/app/constants/kategoriAset";

// Tipe lokal (hindari import enum prisma di client)
type MetodePenyusutan = "GARIS_LURUS" | "SALDO_MENURUN";
type GolonganDepresiasi =
  | "GOL_I"
  | "GOL_II"
  | "GOL_III"
  | "GOL_IV"
  | "BANGUNAN_PERMANEN"
  | "BANGUNAN_NON_PERMANEN";

type FormState = {
  nama: string;
  nia: string;
  kategori: KategoriAset | "";
  lokasi: string;
  tahun: string;
  nilai: string;
  kondisi: string;

  // Penyusutan (opsional)
  tanggalOperasi: string;        // yyyy-mm-dd
  mulaiPenyusutan: string;       // yyyy-mm-dd
  umurManfaatTahun: string;      // number (string)
  nilaiResidu: string;           // decimal
  metodePenyusutan: MetodePenyusutan | "";
  golonganDepresiasi: GolonganDepresiasi | "";
};

const labelKategori = (k: string) => k.replace(/_/g, " ");

const GOL_OPTIONS: GolonganDepresiasi[] = [
  "GOL_I",
  "GOL_II",
  "GOL_III",
  "GOL_IV",
  "BANGUNAN_PERMANEN",
  "BANGUNAN_NON_PERMANEN",
];

export default function TambahAset() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [form, setForm] = useState<FormState>({
    nama: "",
    nia: "",
    kategori: "",
    lokasi: "",
    tahun: "",
    nilai: "",
    kondisi: "",
    tanggalOperasi: "",
    mulaiPenyusutan: "",
    umurManfaatTahun: "",
    nilaiResidu: "",
    metodePenyusutan: "",
    golonganDepresiasi: "",
  });
  const [loadingPage, setLoadingPage] = useState(true);
  const [submitting, setSubmitting] = useState<"stay" | "back" | null>(null);
  const [message, setMessage] = useState<{ type: "info" | "ok" | "err"; text: string } | null>(null);
  const router = useRouter();

  // proteksi login & role
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      if (!["ADMIN", "PETUGAS"].includes(parsed.role)) {
        router.replace("/forbidden");
      } else {
        setLoadingPage(false);
      }
    } else {
      router.replace("/login");
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (message) setMessage(null);
  };

  const resetForm = () => {
    setForm({
      nama: "",
      nia: "",
      kategori: "",
      lokasi: "",
      tahun: "",
      nilai: "",
      kondisi: "",
      tanggalOperasi: "",
      mulaiPenyusutan: "",
      umurManfaatTahun: "",
      nilaiResidu: "",
      metodePenyusutan: "",
      golonganDepresiasi: "",
    });
  };

  // Validasi ringan di client
  const validate = (f: FormState): string | null => {
    if (!f.nama || !f.nia || !f.kategori || !f.lokasi || !f.tahun || !f.nilai || !f.kondisi) {
      return "Semua field wajib diisi.";
    }
    if (!/^\d+$/.test(f.tahun)) return "Tahun harus bilangan bulat.";
    const th = Number(f.tahun);
    const now = new Date().getFullYear();
    if (th < 1900 || th > now) return `Tahun harus antara 1900–${now}.`;
    if (!/^\d+(\.\d{1,2})?$/.test(f.nilai)) return "Nilai harus desimal (maks 2 digit di belakang koma).";

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

  const submitData = async (mode: "stay" | "back") => {
    const err = validate(form);
    if (err) {
      setMessage({ type: "err", text: `❌ ${err}` });
      return;
    }

    setSubmitting(mode);
    setMessage({ type: "info", text: "⏳ Menyimpan aset..." });

    const isTanah = form.kategori === "TANAH";
    const payload: any = {
      nama: form.nama,
      nia: form.nia,
      kategori: form.kategori,
      lokasi: form.lokasi,
      tahun: Number(form.tahun),
      nilai: form.nilai, // API akan ubah ke Decimal
      kondisi: form.kondisi,
    };

    if (!isTanah) {
      if (form.tanggalOperasi) payload.tanggalOperasi = form.tanggalOperasi;
      if (form.mulaiPenyusutan) payload.mulaiPenyusutan = form.mulaiPenyusutan;
      if (form.umurManfaatTahun) payload.umurManfaatTahun = Number(form.umurManfaatTahun);
      if (form.nilaiResidu) payload.nilaiResidu = form.nilaiResidu;
      if (form.metodePenyusutan) payload.metodePenyusutan = form.metodePenyusutan;
      if (form.golonganDepresiasi) payload.golonganDepresiasi = form.golonganDepresiasi;
    }

    try {
      const res = await fetch("/api/inventarisasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        const detail =
          data?.error === "NIA sudah digunakan"
            ? "NIA sudah terdaftar. Gunakan NIA lain."
            : data?.error || "Gagal menambahkan aset";
        setMessage({ type: "err", text: `❌ ${detail}` });
        setSubmitting(null);
        return;
      }

      if (mode === "stay") {
        setMessage({ type: "ok", text: "✅ Aset berhasil ditambahkan. Form telah direset." });
        resetForm();
        setSubmitting(null);
      } else {
        setMessage({ type: "ok", text: "✅ Aset berhasil ditambahkan!" });
        setTimeout(() => router.push("/inventarisasi"), 700);
      }
    } catch {
      setMessage({ type: "err", text: "❌ Terjadi kesalahan server" });
      setSubmitting(null);
    }
  };

  if (loadingPage) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">⏳ Memuat halaman...</p>
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Tambah Aset Baru</h1>
          {user && (
            <span className="text-xs md:text-sm text-slate-500">
              Login: {user.nama} ({user.role})
            </span>
          )}
        </div>

        {/* Form: 2 cards */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitData("stay");
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* CARD KIRI: Data Aset */}
          <section className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Data Aset</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Lengkapi informasi umum aset.
              </p>
            </div>

            <div className="p-6 grid grid-cols-1 gap-5 text-slate-900">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nama Aset</label>
                <input
                  type="text"
                  name="nama"
                  value={form.nama}
                  onChange={handleChange}
                  required
                  placeholder="Contoh: Pompa Booster"
                  className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Nomor Induk Aset (NIA)
                  </label>
                  <input
                    type="text"
                    name="nia"
                    value={form.nia}
                    onChange={handleChange}
                    required
                    placeholder="Contoh: 0232200001"
                    className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className="text-xs text-slate-500 mt-1">NIA harus unik. Jika duplikat, sistem menolak.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Kategori</label>
                  <select
                    name="kategori"
                    value={form.kategori}
                    onChange={handleChange}
                    required
                    className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {KATEGORI_ASET.map((k) => (
                      <option key={k} value={k}>{labelKategori(k)}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Ikuti 10 kelas PDAM: Konstruksi Sipil, Pipa, Sumur Bor, Pompa, Katup, Motor Listrik,
                    Kelistrikan, Kontrol, Bangunan, Tanah.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Lokasi</label>
                <input
                  type="text"
                  name="lokasi"
                  value={form.lokasi}
                  onChange={handleChange}
                  required
                  placeholder="Contoh: Reservoir Utama"
                  className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Tahun Perolehan</label>
                  <input
                    type="number"
                    name="tahun"
                    min={1900}
                    max={yearMax}
                    value={form.tahun}
                    onChange={handleChange}
                    required
                    placeholder={`${yearMax}`}
                    className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nilai Perolehan (Rp)</label>
                  <input
                    type="number"
                    name="nilai"
                    min="0"
                    step="0.01"
                    value={form.nilai}
                    onChange={handleChange}
                    required
                    placeholder="50000000"
                    className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className="text-xs text-slate-500 mt-1">Gunakan titik desimal (contoh: 1250000.50).</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Kondisi</label>
                <select
                  name="kondisi"
                  value={form.kondisi}
                  onChange={handleChange}
                  required
                  className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  <option value="">-- Pilih Kondisi --</option>
                  <option value="Baik">Baik</option>
                  <option value="Perlu Cek">Perlu Cek</option>
                  <option value="Rusak">Rusak</option>
                </select>
              </div>
            </div>
          </section>

          {/* CARD KANAN: Penyusutan (opsional) */}
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
                <label className="block text-sm font-medium text-slate-700">
                  Tanggal Operasi (mulai aset dipakai)
                </label>
                <input
                  type="date"
                  name="tanggalOperasi"
                  value={form.tanggalOperasi}
                  onChange={handleChange}
                  disabled={isTanah}
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Tanggal Mulai Penyusutan</label>
                <input
                  type="date"
                  name="mulaiPenyusutan"
                  value={form.mulaiPenyusutan}
                  onChange={handleChange}
                  disabled={isTanah}
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
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
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
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
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Metode Penyusutan</label>
                <select
                  name="metodePenyusutan"
                  value={form.metodePenyusutan}
                  onChange={handleChange}
                  disabled={isTanah}
                  className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                >
                  <option value="">(Default per kategori)</option>
                  <option value="GARIS_LURUS">Garis Lurus</option>
                  <option value="SALDO_MENURUN">Saldo Menurun</option>
                </select>
              </div>

              {showGolongan && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Golongan Depresiasi</label>
                  <select
                    name="golonganDepresiasi"
                    value={form.golonganDepresiasi}
                    onChange={handleChange}
                    disabled={isTanah}
                    className="w-full border rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
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

          {/* ACTION BAR */}
          <div className="md:col-span-3 flex flex-col sm:flex-row sm:justify-end gap-3">
            <button
              type="submit"
              disabled={submitting !== null}
              className={`bg-blue-600 text-white py-2 px-4 rounded-md transition ${
                submitting ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-700"
              }`}
            >
              {submitting === "stay" ? "Menyimpan..." : "Simpan (reset form)"}
            </button>

            <button
              type="button"
              onClick={() => submitData("back")}
              disabled={submitting !== null}
              className={`bg-slate-700 text-white py-2 px-4 rounded-md transition ${
                submitting ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-800"
              }`}
            >
              {submitting === "back" ? "Menyimpan..." : "Simpan & kembali"}
            </button>
          </div>
        </form>

        {message && (
          <p
            className={`mt-4 text-center font-semibold ${
              message.type === "ok"
                ? "text-green-600"
                : message.type === "err"
                ? "text-red-600"
                : "text-slate-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </main>
  );
}
