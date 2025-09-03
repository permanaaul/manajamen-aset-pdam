// app/aset/[id]/edit/page.tsx
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, RefreshCcw, Copy } from "lucide-react";
import useToast from "@/components/Toast";

/* ================= Types ================= */
type Aset = {
  id: number;
  nia: string;
  nama: string;
  kategori: string;
  lokasi: string | null;
  tahun: number | null;
  nilai: number | null;
  kondisi: string | null;
  catatan: string | null;

  tanggalOperasi?: string | null;
  umurManfaatTahun?: number | null;
  nilaiResidu?: number | null;
  metodePenyusutan?: string | null;
  golonganDepresiasi?: string | null;
  mulaiPenyusutan?: string | null;
};

const KATEGORI = [
  "KONSTRUKSI_SIPIL",
  "PIPA",
  "SUMUR_BOR",
  "POMPA",
  "KATUP",
  "MOTOR_LISTRIK",
  "KELISTRIKAN",
  "KONTROL",
  "BANGUNAN",
  "TANAH",
] as const;

const METODE = ["GARIS_LURUS", "SALDO_MENURUN"] as const;
const GOL = ["GOL_I", "GOL_II", "GOL_III", "GOL_IV", "BANGUNAN_PERMANEN", "BANGUNAN_NON_PERMANEN"] as const;

/* =============== Helpers =============== */
const fmtRp = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const parseNumOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

/* =============== UI atoms =============== */
function Section({
  title,
  desc,
  children,
  className = "",
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className} rounded-2xl border border-gray-200 bg-white p-5 shadow-sm`}>
      <div className="mb-3">
        <div className="text-sm font-extrabold uppercase tracking-wide text-gray-900">{title}</div>
        {desc ? <div className="text-xs text-gray-600">{desc}</div> : null}
      </div>
      {children}
    </div>
  );
}

function L({
  label,
  required,
  children,
  hint,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-semibold text-gray-900">
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </div>
      {children}
      {hint ? <div className="mt-1 text-[12px] text-gray-600">{hint}</div> : null}
      {error ? <div className="mt-1 text-[12px] text-rose-600">{error}</div> : null}
    </label>
  );
}

function Ipt(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-xl border px-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        props.className ?? ""
      } ${props.disabled ? "bg-gray-50 border-gray-200" : "border-gray-300"}`}
    />
  );
}
function Sel(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        props.className ?? ""
      }`}
    />
  );
}
function Txt(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] w-full rounded-xl border border-gray-300 px-3 py-2 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        props.className ?? ""
      }`}
    />
  );
}

/* =============== Page =============== */
export default function EditAsetPage() {
  const { id } = useParams<{ id: string }>();
  const asetId = Number(id);
  const router = useRouter();
  const { View, push } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [f, setF] = React.useState<Aset | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const set = <K extends keyof Aset>(k: K, v: Aset[K]) => setF((s) => (s ? { ...s, [k]: v } : s));

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/aset/${asetId}`, { cache: "no-store" });
        const d = await res.json();
        if (!res.ok) throw new Error(d?.error || "Gagal memuat aset");

        setF({
          ...d,
          tanggalOperasi: d.tanggalOperasi ? String(d.tanggalOperasi).substring(0, 10) : "",
          mulaiPenyusutan: d.mulaiPenyusutan ? String(d.mulaiPenyusutan).substring(0, 10) : "",
        });
      } catch (e: any) {
        push(`❌ ${e.message}`, "err");
      } finally {
        setLoading(false);
      }
    })();
  }, [asetId, push]);

  const validate = React.useCallback((state: Aset | null) => {
    const err: Record<string, string> = {};
    if (!state?.nama?.trim()) err.nama = "Nama aset wajib diisi.";
    if (!state?.kategori) err.kategori = "Kategori wajib dipilih.";
    return err;
  }, []);

  const canSave = React.useMemo(() => {
    if (!f || loading || saving) return false;
    const err = validate(f);
    return Object.keys(err).length === 0;
  }, [f, loading, saving, validate]);

  const submit = async () => {
    if (!f) return;
    const err = validate(f);
    setErrors(err);
    if (Object.keys(err).length) {
      push("Periksa kembali field yang wajib diisi.", "err");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        nama: f.nama,
        kategori: f.kategori,
        lokasi: f.lokasi ?? null,
        tahun: f.tahun ?? null,
        nilai: f.nilai ?? null,
        kondisi: f.kondisi ?? null,
        catatan: f.catatan ?? null,

        tanggalOperasi: f.tanggalOperasi || null,
        umurManfaatTahun: f.umurManfaatTahun ?? null,
        nilaiResidu: f.nilaiResidu ?? null,
        metodePenyusutan: f.metodePenyusutan || null,
        golonganDepresiasi: f.golonganDepresiasi || null,
        mulaiPenyusutan: f.mulaiPenyusutan || null,
      };

      const res = await fetch(`/api/aset/${asetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Gagal menyimpan aset");

      push("✅ Aset tersimpan", "ok");
      router.push(`/aset/${asetId}`);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setSaving(false);
    }
  };

  const resetPenyusutan = () => {
    if (!f) return;
    setF({
      ...f,
      tanggalOperasi: "",
      umurManfaatTahun: null,
      nilaiResidu: null,
      metodePenyusutan: "",
      golonganDepresiasi: "",
      mulaiPenyusutan: "",
    });
  };

  const copyNIA = async () => {
    if (!f?.nia) return;
    try {
      await navigator.clipboard.writeText(f.nia);
      push("📋 NIA disalin", "ok");
    } catch {
      push("Gagal menyalin NIA", "err");
    }
  };

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-[26px] font-extrabold tracking-tight">Edit Aset</h1>
          <p className="text-[13px] text-gray-700">
            Perbarui informasi aset dan (opsional) pengaturan penyusutannya. Field bertanda{" "}
            <span className="font-semibold text-rose-600">*</span> wajib diisi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/aset/${asetId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium text-gray-800 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Batal / Kembali
          </Link>
          <button
            onClick={submit}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading || !f ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-700">Memuat…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-12">
          {/* Informasi utama */}
          <Section
            className="md:col-span-6"
            title="Informasi Utama"
            desc="Identitas dasar aset untuk keperluan pencatatan dan pencarian."
          >
            <div className="grid grid-cols-1 gap-3">
              <L label="NIA">
                <div className="flex items-center gap-2">
                  <Ipt value={f.nia} disabled aria-readonly />
                  <button
                    type="button"
                    onClick={copyNIA}
                    className="h-11 shrink-0 rounded-xl border border-gray-300 px-3 text-sm font-semibold hover:bg-gray-50"
                    title="Salin NIA"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1 text-[12px]">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-[2px] text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                    {f.nia}
                  </span>
                </div>
              </L>

              <L label="Nama" required hint="Nama/uraian aset yang mudah dikenali." error={errors.nama}>
                <Ipt value={f.nama} onChange={(e) => set("nama", e.target.value)} placeholder="Misal: Meter Air DN15 No. 001" />
              </L>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <L label="Kategori" required hint="Klasifikasi aset sesuai pedoman internal." error={errors.kategori}>
                  <Sel value={f.kategori} onChange={(e) => set("kategori", e.target.value)} aria-label="Kategori aset">
                    {KATEGORI.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Sel>
                </L>

                <L label="Lokasi" hint="Patokan lokasi fisik/penempatan aset (opsional).">
                  <Ipt value={f.lokasi ?? ""} onChange={(e) => set("lokasi", e.target.value)} placeholder="Contoh: Gudang Utama / Area 1" />
                </L>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <L label="Tahun Perolehan" hint="Tahun aset diperoleh / dibuat (opsional).">
                  <Ipt
                    type="number"
                    inputMode="numeric"
                    placeholder="yyyy"
                    min={1900}
                    max={9999}
                    value={f.tahun ?? ""}
                    onChange={(e) => set("tahun", parseNumOrNull(e.target.value))}
                  />
                </L>

                <L label="Nilai Perolehan (Rp)" hint={`Pratinjau: ${fmtRp(f.nilai)}`}>
                  <Ipt
                    type="number"
                    inputMode="numeric"
                    placeholder="contoh: 1500000"
                    value={f.nilai ?? ""}
                    onChange={(e) => set("nilai", parseNumOrNull(e.target.value))}
                  />
                </L>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <L label="Kondisi" hint="Ringkas: BAIK / RUSAK RINGAN / RUSAK BERAT (opsional).">
                  <Ipt value={f.kondisi ?? ""} onChange={(e) => set("kondisi", e.target.value)} placeholder="Contoh: BAIK" />
                </L>

                <L label="Catatan" hint="Keterangan tambahan (opsional).">
                  <Txt value={f.catatan ?? ""} onChange={(e) => set("catatan", e.target.value)} placeholder="Tulis info penting lain di sini…" />
                </L>
              </div>
            </div>
          </Section>

          {/* Penyusutan */}
          <Section
            className="md:col-span-6"
            title="Penyusutan (opsional)"
            desc="Isi bila aset disusutkan secara akuntansi. Kosongkan jika tidak berlaku."
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] text-gray-600">Jika diaktifkan, pastikan tanggal & parameter terisi wajar.</div>
              <button
                onClick={resetPenyusutan}
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                title="Kosongkan semua field penyusutan"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <L label="Tanggal Operasi" hint="Tanggal aset mulai digunakan.">
                <Ipt type="date" value={f.tanggalOperasi || ""} onChange={(e) => set("tanggalOperasi", e.target.value)} />
              </L>

              <L label="Mulai Penyusutan" hint="Tanggal perhitungan penyusutan dimulai.">
                <Ipt type="date" value={f.mulaiPenyusutan || ""} onChange={(e) => set("mulaiPenyusutan", e.target.value)} />
              </L>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <L label="Umur Manfaat (tahun)" hint="Contoh: 5, 10, 20.">
                <Ipt
                  type="number"
                  inputMode="numeric"
                  placeholder="misal: 5"
                  value={f.umurManfaatTahun ?? ""}
                  onChange={(e) => set("umurManfaatTahun", parseNumOrNull(e.target.value))}
                />
              </L>

              <L label="Nilai Residu (Rp)" hint={`Pratinjau: ${fmtRp(f.nilaiResidu)}`}>
                <Ipt
                  type="number"
                  inputMode="numeric"
                  placeholder="misal: 100000"
                  value={f.nilaiResidu ?? ""}
                  onChange={(e) => set("nilaiResidu", parseNumOrNull(e.target.value))}
                />
              </L>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <L label="Metode Penyusutan" hint="Pilih metode perhitungan beban.">
                <Sel value={f.metodePenyusutan || ""} onChange={(e) => set("metodePenyusutan", e.target.value || null)}>
                  <option value="">(pilih)</option>
                  {METODE.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Sel>
              </L>

              <L label="Golongan Depresiasi" hint="Opsional, jika mengikuti aturan golongan tertentu.">
                <Sel value={f.golonganDepresiasi || ""} onChange={(e) => set("golonganDepresiasi", e.target.value || null)}>
                  <option value="">(pilih)</option>
                  {GOL.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Sel>
              </L>
            </div>
          </Section>
        </div>
      )}

      {/* minor styles */}
      <style jsx global>{`
        ::placeholder {
          color: rgb(107 114 128 / 0.9);
        }
      `}</style>
    </div>
  );
}
