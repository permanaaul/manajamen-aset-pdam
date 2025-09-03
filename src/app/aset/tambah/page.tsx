"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Save,
  Loader2,
  Calendar,
  RotateCcw,
  Info,
} from "lucide-react";
import useToast from "@/components/Toast";

/* ==== types ==== */
type Lookup = {
  kategori: string[];
  metode: string[];
  golongan: string[];
};

type Payload = {
  nia: string;
  nama: string;
  kategori: string;
  lokasi: string;
  tahun: number;
  nilai: number;
  kondisi: string;
  catatan?: string | null;

  // penyusutan (opsional)
  tanggalOperasi?: string | null;
  umurManfaatTahun?: number | null;
  nilaiResidu?: number | null;
  metodePenyusutan?: string | null;
  golonganDepresiasi?: string | null;
  mulaiPenyusutan?: string | null;
};

/* ==== helpers ==== */
const toInt = (v: unknown) =>
  v === "" || v == null ? 0 : parseInt(String(v), 10) || 0;

const toNum = (v: unknown) =>
  v === "" || v == null
    ? 0
    : Number(String(v).replace(/[^\d.-]/g, "")) || 0;

const fmtID = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("id-ID") : "0";

const fmtRp = (n: number) =>
  `Rp ${(Number.isFinite(n) ? n : 0).toLocaleString("id-ID")}`;

function classInput(invalid?: boolean) {
  return `h-11 w-full rounded-xl border px-3 text-[15px] outline-none ${
    invalid
      ? "border-rose-400 ring-2 ring-rose-100"
      : "border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
  }`;
}

/** Default tarif tahunan dari golongan (mengacu pedoman umum) */
const TARIF_GOL: Record<string, number> = {
  GOL_I: 25, // contoh: aset cepat susut
  GOL_II: 12.5,
  GOL_III: 6.25,
  GOL_IV: 5,
  BANGUNAN_PERMANEN: 5,
  BANGUNAN_NON_PERMANEN: 10,
};

/** Hitung pratinjau tarif & beban (informasi di UI saja, tidak dikirim) */
function previewDep(f: Payload) {
  const nilai = Number(f.nilai || 0);
  const residu = Number(f.nilaiResidu || 0);
  const umur = Number(f.umurManfaatTahun || 0);
  const metode = (f.metodePenyusutan || "").toUpperCase();
  const gol = (f.golonganDepresiasi || "").toUpperCase();

  let tarifTahunan = 0; // %
  let bebanTahun1 = 0; // rupiah (tahun pertama)

  if (metode === "GARIS_LURUS" && umur > 0) {
    tarifTahunan = 100 / umur;
    const dasar = Math.max(0, nilai - residu);
    bebanTahun1 = dasar / umur;
  } else if (metode === "SALDO_MENURUN") {
    // prioritas: pakai tarif golongan jika dipilih; jika tidak ada, fallback ke approx 200%/umur
    tarifTahunan =
      TARIF_GOL[gol] != null
        ? TARIF_GOL[gol]
        : umur > 0
        ? Math.min(100, (2 / umur) * 100)
        : 0;
    // pendekatan: tahun pertama gunakan nilai buku awal (residu jadi batas bawah akhir masa)
    bebanTahun1 = (tarifTahunan / 100) * nilai;
  }

  const bebanBulananGL =
    metode === "GARIS_LURUS" && umur > 0 ? bebanTahun1 / 12 : 0;

  return {
    tarifTahunan, // %
    bebanTahun1,
    bebanBulananGL,
  };
}

export default function TambahAsetPage() {
  const { View, push } = useToast();
  const router = useRouter();

  const [lookup, setLookup] = React.useState<Lookup>({
    kategori: [],
    metode: [],
    golongan: [],
  });

  const [loadingLookup, setLoadingLookup] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // form state
  const [f, setF] = React.useState<Payload>(() => {
    const now = new Date();
    const year = now.getFullYear();
    return {
      nia: `NIA-${year}${String(now.getMonth() + 1).padStart(2, "0")}${String(
        now.getDate()
      ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
        now.getMinutes()
      ).padStart(2, "0")}`,
      nama: "",
      kategori: "",
      lokasi: "",
      tahun: year,
      nilai: 0,
      kondisi: "BAIK",
      catatan: "",
      tanggalOperasi: "",
      umurManfaatTahun: undefined,
      nilaiResidu: undefined,
      metodePenyusutan: "",
      golonganDepresiasi: "",
      mulaiPenyusutan: "",
    };
  });

  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const set = <K extends keyof Payload>(k: K, v: Payload[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  /* ==== fetch lookup ==== */
  React.useEffect(() => {
    (async () => {
      try {
        setLoadingLookup(true);
        // kamu sudah punya endpoint ini dari sebelumnya
        const res = await fetch("/api/aset/lookup");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal memuat lookup");
        setLookup({
          kategori: data.kategori || [],
          metode: data.metode || [],
          golongan: data.golongan || [],
        });
      } catch (e: any) {
        push(`❌ ${e.message}`, "err");
      } finally {
        setLoadingLookup(false);
      }
    })();
  }, [push]);

  /* ==== validation ==== */
  const errs: Record<string, string> = {};
  if (!f.nia?.trim()) errs.nia = "NIA wajib";
  if (!f.nama?.trim()) errs.nama = "Nama wajib";
  if (!f.kategori) errs.kategori = "Kategori wajib";
  if (!f.lokasi?.trim()) errs.lokasi = "Lokasi wajib";
  if (f.tahun < 1900 || f.tahun > new Date().getFullYear() + 1)
    errs.tahun = "Tahun tidak valid";
  if (f.nilai < 0) errs.nilai = "Nilai tidak boleh minus";

  // penyusutan opsional: bila salah satu diisi → minimal valid
  const anyDep =
    !!f.umurManfaatTahun ||
    !!f.nilaiResidu ||
    !!f.metodePenyusutan ||
    !!f.golonganDepresiasi ||
    !!f.tanggalOperasi ||
    !!f.mulaiPenyusutan;
  if (anyDep) {
    if (!f.metodePenyusutan) errs.metodePenyusutan = "Metode wajib dipilih";
    if (!f.mulaiPenyusutan) errs.mulaiPenyusutan = "Tanggal mulai wajib";
    if (!f.umurManfaatTahun || f.umurManfaatTahun <= 0)
      errs.umurManfaatTahun = "Umur manfaat wajib & > 0";
    if ((f.nilaiResidu ?? 0) < 0) errs.nilaiResidu = "Nilai residu tidak valid";
    if ((f.nilaiResidu ?? 0) > (f.nilai ?? 0))
      errs.nilaiResidu = "Residu tidak boleh melebihi nilai perolehan";
  }

  const invalid = Object.keys(errs).length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({
      nia: true,
      nama: true,
      kategori: true,
      lokasi: true,
      tahun: true,
      nilai: true,
      umurManfaatTahun: true,
      metodePenyusutan: true,
      mulaiPenyusutan: true,
      nilaiResidu: true,
    });
    if (invalid) {
      push("Periksa kembali input yang disorot.", "err");
      return;
    }

    const payload: Payload = {
      ...f,
      nilai: toNum(f.nilai),
      nilaiResidu:
        f.nilaiResidu == null || (f.nilaiResidu as unknown) === ""
          ? null
          : toNum(f.nilaiResidu),
      umurManfaatTahun:
        f.umurManfaatTahun == null || (f.umurManfaatTahun as unknown) === ""
          ? null
          : toInt(f.umurManfaatTahun),
      tanggalOperasi: f.tanggalOperasi || null,
      mulaiPenyusutan: f.mulaiPenyusutan || null,
      metodePenyusutan: f.metodePenyusutan || null,
      golonganDepresiasi: f.golonganDepresiasi || null,
      catatan: f.catatan || null,
    };

    try {
      setSaving(true);
      const res = await fetch("/api/aset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan aset");

      // Selesai
      push("✅ Aset berhasil dibuat.", "ok");
      router.push(`/aset/${data.id}`);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setTouched({});
    setF((s) => ({
      ...s,
      nama: "",
      lokasi: "",
      nilai: 0,
      kondisi: "BAIK",
      catatan: "",
      tanggalOperasi: "",
      umurManfaatTahun: undefined,
      nilaiResidu: undefined,
      metodePenyusutan: "",
      golonganDepresiasi: "",
      mulaiPenyusutan: "",
    }));
  }

  const prev = previewDep(f);

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Tambah Aset</h1>
          <p className="text-[13px] text-gray-700">
            Isi identitas aset. Bagian <b>penyusutan</b> bersifat opsional dan dapat diisi sekarang
            atau nanti. Nilai pratinjau di kanan membantu memastikan rumus sudah sesuai.
          </p>
        </div>
        <Link
          href="/aset"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Kembali
        </Link>
      </div>

      {/* Form */}
      <form
        onSubmit={onSubmit}
        className="grid gap-4 md:grid-cols-12"
      >
        {/* Identitas */}
        <div className="md:col-span-7 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="text-sm font-bold uppercase tracking-wide text-gray-800">
            Identitas Aset
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold">NIA *</label>
              <input
                className={classInput(touched.nia && !!errs.nia)}
                value={f.nia}
                onChange={(e) => set("nia", e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, nia: true }))}
                placeholder="Nomor Induk Aset"
              />
              {touched.nia && errs.nia && (
                <p className="mt-1 text-xs text-rose-600">{errs.nia}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold">Nama *</label>
              <input
                className={classInput(touched.nama && !!errs.nama)}
                value={f.nama}
                onChange={(e) => set("nama", e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, nama: true }))}
                placeholder="Nama aset (mis. Pompa 15 kW #1)"
              />
              {touched.nama && errs.nama && (
                <p className="mt-1 text-xs text-rose-600">{errs.nama}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">Kategori *</label>
              <select
                className={classInput(touched.kategori && !!errs.kategori)}
                disabled={loadingLookup}
                value={f.kategori}
                onChange={(e) => set("kategori", e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, kategori: true }))}
              >
                <option value="">— Pilih —</option>
                {lookup.kategori.map((k) => (
                  <option key={k} value={k}>
                    {k.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              {touched.kategori && errs.kategori && (
                <p className="mt-1 text-xs text-rose-600">{errs.kategori}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">Lokasi *</label>
              <input
                className={classInput(touched.lokasi && !!errs.lokasi)}
                value={f.lokasi}
                onChange={(e) => set("lokasi", e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, lokasi: true }))}
                placeholder="Mis. IPA Utama, Ruang Pompa #1"
              />
              {touched.lokasi && errs.lokasi && (
                <p className="mt-1 text-xs text-rose-600">{errs.lokasi}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">Tahun *</label>
              <input
                type="number"
                className={classInput(touched.tahun && !!errs.tahun)}
                value={f.tahun ?? ""}
                onChange={(e) => set("tahun", toInt(e.target.value))}
                onBlur={() => setTouched((t) => ({ ...t, tahun: true }))}
              />
              {touched.tahun && errs.tahun && (
                <p className="mt-1 text-xs text-rose-600">{errs.tahun}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">Nilai Perolehan (Rp)</label>
              <input
                className={classInput(touched.nilai && !!errs.nilai)}
                value={f.nilai === 0 ? "" : f.nilai}
                onChange={(e) => set("nilai", toNum(e.target.value))}
                onBlur={() => setTouched((t) => ({ ...t, nilai: true }))}
                placeholder="mis. 25000000"
              />
              <div className="mt-1 text-xs text-gray-600">{fmtRp(f.nilai || 0)}</div>
              {touched.nilai && errs.nilai && (
                <p className="mt-1 text-xs text-rose-600">{errs.nilai}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">Kondisi</label>
              <select
                className={classInput()}
                value={f.kondisi}
                onChange={(e) => set("kondisi", e.target.value)}
              >
                <option value="BAIK">BAIK</option>
                <option value="RUSAK_RINGAN">RUSAK RINGAN</option>
                <option value="RUSAK_BERAT">RUSAK BERAT</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold">Catatan</label>
              <textarea
                className={classInput()}
                rows={3}
                value={f.catatan ?? ""}
                onChange={(e) => set("catatan", e.target.value)}
                placeholder="Keterangan tambahan (opsional)"
              />
            </div>
          </div>
        </div>

        {/* Penyusutan */}
        <div className="md:col-span-5 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold uppercase tracking-wide text-gray-800">
                Penyusutan (Opsional)
              </div>
              <div className="text-[12px] text-gray-600 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Isi jika aset mulai disusutkan.
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Tgl. Operasi</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      className={`${classInput()} pl-9`}
                      value={f.tanggalOperasi || ""}
                      onChange={(e) => set("tanggalOperasi", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Mulai Penyusutan
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      className={`${classInput(
                        touched.mulaiPenyusutan && !!errs.mulaiPenyusutan
                      )} pl-9`}
                      value={f.mulaiPenyusutan || ""}
                      onChange={(e) => set("mulaiPenyusutan", e.target.value)}
                      onBlur={() =>
                        setTouched((t) => ({ ...t, mulaiPenyusutan: true }))
                      }
                    />
                  </div>
                  {touched.mulaiPenyusutan && errs.mulaiPenyusutan && (
                    <p className="mt-1 text-xs text-rose-600">
                      {errs.mulaiPenyusutan}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Umur Manfaat (tahun)
                  </label>
                  <input
                    type="number"
                    className={classInput(
                      touched.umurManfaatTahun && !!errs.umurManfaatTahun
                    )}
                    value={f.umurManfaatTahun ?? ""}
                    onChange={(e) =>
                      set("umurManfaatTahun", toInt(e.target.value) || undefined)
                    }
                    onBlur={() =>
                      setTouched((t) => ({ ...t, umurManfaatTahun: true }))
                    }
                    placeholder="mis. 5"
                  />
                  {touched.umurManfaatTahun && errs.umurManfaatTahun && (
                    <p className="mt-1 text-xs text-rose-600">
                      {errs.umurManfaatTahun}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold">Nilai Residu (Rp)</label>
                  <input
                    className={classInput(touched.nilaiResidu && !!errs.nilaiResidu)}
                    value={f.nilaiResidu ?? ""}
                    onChange={(e) =>
                      set("nilaiResidu", toNum(e.target.value) || undefined)
                    }
                    onBlur={() =>
                      setTouched((t) => ({ ...t, nilaiResidu: true }))
                    }
                    placeholder="mis. 1000000"
                  />
                  <div className="mt-1 text-xs text-gray-600">
                    {fmtRp(f.nilaiResidu || 0)}
                  </div>
                  {touched.nilaiResidu && errs.nilaiResidu && (
                    <p className="mt-1 text-xs text-rose-600">{errs.nilaiResidu}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Metode Penyusutan</label>
                  <select
                    className={classInput(
                      touched.metodePenyusutan && !!errs.metodePenyusutan
                    )}
                    value={f.metodePenyusutan || ""}
                    onChange={(e) => set("metodePenyusutan", e.target.value)}
                    onBlur={() =>
                      setTouched((t) => ({ ...t, metodePenyusutan: true }))
                    }
                  >
                    <option value="">— Pilih (opsional) —</option>
                    {lookup.metode.map((m) => (
                      <option key={m} value={m}>
                        {m.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  {touched.metodePenyusutan && errs.metodePenyusutan && (
                    <p className="mt-1 text-xs text-rose-600">
                      {errs.metodePenyusutan}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Golongan Depresiasi (opsional)
                  </label>
                  <select
                    className={classInput()}
                    value={f.golonganDepresiasi || ""}
                    onChange={(e) =>
                      set("golonganDepresiasi", e.target.value || "")
                    }
                  >
                    <option value="">— Pilih —</option>
                    {lookup.golongan.map((g) => (
                      <option key={g} value={g}>
                        {g.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[12px] text-gray-600">
                    {f.golonganDepresiasi
                      ? `Tarif tahunan default golongan: ${
                          TARIF_GOL[(f.golonganDepresiasi || "").toUpperCase()] ??
                          "—"
                        }%`
                      : "Pilih untuk menggunakan tarif default golongan saat perhitungan."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm text-sm">
            <div className="font-bold text-indigo-900">Pratinjau Penyusutan</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="text-indigo-900/80">Metode</div>
              <div className="font-semibold">
                {f.metodePenyusutan ? f.metodePenyusutan.replaceAll("_", " ") : "—"}
              </div>

              <div className="text-indigo-900/80">Tarif (tahunan)</div>
              <div className="font-semibold">
                {prev.tarifTahunan > 0 ? `${prev.tarifTahunan.toFixed(2)} %` : "—"}
              </div>

              <div className="text-indigo-900/80">Beban Tahun 1</div>
              <div className="font-semibold">{fmtRp(prev.bebanTahun1)}</div>

              <div className="text-indigo-900/80">Perkiraan /bulan (GL)</div>
              <div className="font-semibold">
                {prev.bebanBulananGL > 0 ? fmtRp(prev.bebanBulananGL) : "—"}
              </div>
            </div>
            <div className="mt-2 text-[12px] text-indigo-900/80">
              Catatan: untuk <b>SALDO MENURUN</b>, beban menurun tiap tahun sesuai nilai buku
              berjalan. Tarif golongan (bila dipilih) akan meng-override perhitungan otomatis.
              Pengaturan <i>custom tarif/basis</i> bisa dipilih saat <b>Generate Penyusutan</b>.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="md:col-span-12 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
