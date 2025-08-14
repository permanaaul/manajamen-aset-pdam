"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  ClipboardList,
  Coins,
  Edit,
  FileWarning,
  Loader,
  ShieldCheck,
  UserCog,
  ArrowLeft,
  Package,
  Barcode,
  Boxes,
  Timer,
  Calculator,
  PlusCircle,
  RotateCw,
} from "lucide-react";

/* ===== Types ===== */
type Strategi = "PREVENTIF" | "KOREKTIF" | "INSIDENTAL" | "DARURAT" | "";

// ✅ Enum kode Jenis Pekerjaan (sesuai skema)
type JenisPekerjaan =
  | "INSPEKSI"
  | "PELUMASAN"
  | "KALIBRASI"
  | "GANTI_SPAREPART"
  | "PERBAIKAN_RINGAN"
  | "PERBAIKAN_BESAR"
  | "OVERHAUL"
  | "TESTING";

type SpareItem = {
  id: string;
  nama: string;
  qty: string;     // as string for inputs
  satuan: string;
  harga: string;   // as string for inputs
};

type Aset = { id: number; nia: string; nama: string };

interface PemeliharaanAPI {
  id: number;
  asetId: number;
  aset?: { nia: string; nama: string } | null;
  tanggal: string;                 // ISO string
  jenis: string;
  pelaksana: string;
  catatan?: string | null;
  status: "Terjadwal" | "Dalam Proses" | "Selesai" | string;
  biaya?: number | null;

  // optional fields (kalau sudah migrate schema)
  strategi?: Strategi | null;
  jenisPekerjaan?: string | null; // server bisa balikin label/case lain → kita normalisasi
  downtimeJam?: number | null;
  biayaMaterial?: number | null;
  biayaJasa?: number | null;
  sukuCadang?: Array<{ nama: string; qty: number; satuan: string; harga: number }> | null;
}

type FormState = {
  asetId: string;
  tanggal: string; // yyyy-mm-dd
  jenis: string;
  pelaksana: string;
  catatan: string;
  status: "Terjadwal" | "Dalam Proses" | "Selesai" | "";

  // biaya (legacy total)
  biaya: string;

  // detail teknis (opsional)
  strategi: Strategi;
  jenisPekerjaan: "" | JenisPekerjaan; // ⬅️ dropdown
  downtimeJam: string;
  biayaMaterial: string;
  biayaJasa: string;
  sukuCadang: SpareItem[];
};

const strategiOptions = [
  { v: "", t: "(Pilih atau kosongkan)" },
  { v: "PREVENTIF", t: "Preventif" },
  { v: "KOREKTIF", t: "Korektif" },
  { v: "INSIDENTAL", t: "Insidental" },
  { v: "DARURAT", t: "Darurat" },
] as const;

// ✅ Pilihan dropdown Jenis Pekerjaan
const jenisOptions: Array<{ v: "" | JenisPekerjaan; t: string }> = [
  { v: "", t: "(Pilih atau kosongkan)" },
  { v: "INSPEKSI", t: "Inspeksi" },
  { v: "PELUMASAN", t: "Pelumasan" },
  { v: "KALIBRASI", t: "Kalibrasi" },
  { v: "GANTI_SPAREPART", t: "Ganti Sparepart" },
  { v: "PERBAIKAN_RINGAN", t: "Perbaikan Ringan" },
  { v: "PERBAIKAN_BESAR", t: "Perbaikan Besar" },
  { v: "OVERHAUL", t: "Overhaul" },
  { v: "TESTING", t: "Testing" },
];

// Normalisasi string bebas → kode enum (uppercase + underscore)
const normalizeJenis = (v?: string | null): "" | JenisPekerjaan => {
  if (!v) return "";
  const raw = v.toString().trim().toUpperCase().replace(/\s+/g, "_");
  const allowed = jenisOptions.map((o) => o.v).filter(Boolean) as JenisPekerjaan[];
  return allowed.includes(raw as JenisPekerjaan) ? (raw as JenisPekerjaan) : "";
};

/* ===== Page ===== */
export default function EditPemeliharaan() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>(); // ✅ ambil dari hook, bukan props

  const [asets, setAsets] = useState<Aset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<FormState | null>(null);
  const [pem, setPem] = useState<PemeliharaanAPI | null>(null);

  // guard + role
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u = JSON.parse(raw);
    if (!["ADMIN", "TEKNISI"].includes(u.role)) {
      router.replace("/forbidden");
    }
  }, [router]);

  // fetch detail + daftar aset
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const [pemRes, asetRes] = await Promise.all([
          fetch(`/api/pemeliharaan/${id}`, { cache: "no-store" }),
          fetch("/api/inventarisasi", { cache: "no-store" }),
        ]);

        if (!pemRes.ok) {
          const err = await pemRes.json().catch(() => ({}));
          throw new Error(err?.error || "Data pemeliharaan tidak ditemukan");
        }

        const pemData = (await pemRes.json()) as PemeliharaanAPI;
        const asetList = asetRes.ok ? ((await asetRes.json()) as Aset[]) : [];

        setPem(pemData);
        setAsets(asetList);

        // map API → Form
        const toISODate = (iso?: string) => (iso ? iso.split("T")[0] : "");
        const sukuCadangItems: SpareItem[] = (pemData.sukuCadang || []).map((s) => ({
          id: crypto.randomUUID(),
          nama: s.nama || "",
          qty: s.qty != null ? String(s.qty) : "",
          satuan: s.satuan || "",
          harga: s.harga != null ? String(s.harga) : "",
        }));

        setForm({
          asetId: String(pemData.asetId || ""),
          tanggal: toISODate(pemData.tanggal),
          jenis: pemData.jenis || "",
          pelaksana: pemData.pelaksana || "",
          catatan: pemData.catatan || "",
          status: (pemData.status as any) || "",

          biaya: pemData.biaya != null ? String(pemData.biaya) : "",

          strategi: (pemData.strategi as Strategi) || "",
          jenisPekerjaan: normalizeJenis(pemData.jenisPekerjaan),
          downtimeJam: pemData.downtimeJam != null ? String(pemData.downtimeJam) : "",
          biayaMaterial: pemData.biayaMaterial != null ? String(pemData.biayaMaterial) : "",
          biayaJasa: pemData.biayaJasa != null ? String(pemData.biayaJasa) : "",
          sukuCadang: sukuCadangItems,
        });
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e?.message || "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // helpers
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    if (!form) return;
    const { name, value } = e.target;
    setForm({ ...form, [name]: value } as FormState);
  };

  // suku cadang handlers
  const addSpare = () =>
    setForm((f) =>
      f
        ? {
            ...f,
            sukuCadang: [
              ...f.sukuCadang,
              { id: crypto.randomUUID(), nama: "", qty: "", satuan: "", harga: "" },
            ],
          }
        : f
    );

  const updSpare = (sid: string, key: keyof SpareItem, val: string) =>
    setForm((f) =>
      f ? { ...f, sukuCadang: f.sukuCadang.map((s) => (s.id === sid ? { ...s, [key]: val } : s)) } : f
    );

  const delSpare = (sid: string) =>
    setForm((f) => (f ? { ...f, sukuCadang: f.sukuCadang.filter((s) => s.id !== sid) } : f));

  // kalkulasi estimasi material + subtotal
  const estMaterial = useMemo(() => {
    if (!form) return 0;
    return form.sukuCadang.reduce((sum, it) => {
      const qty = parseFloat(it.qty || "0");
      const harga = parseFloat(it.harga || "0");
      return sum + (isFinite(qty) && isFinite(harga) ? qty * harga : 0);
    }, 0);
  }, [form?.sukuCadang]);

  const estSubtotal = useMemo(() => {
    const m = parseFloat(form?.biayaMaterial || "0") || 0;
    const j = parseFloat(form?.biayaJasa || "0") || 0;
    return m + j;
  }, [form?.biayaMaterial, form?.biayaJasa]);

  // validate & submit
  const validate = (f: FormState | null): string | null => {
    if (!f) return "Form belum siap.";
    if (!f.asetId) return "Aset wajib dipilih.";
    if (!f.tanggal) return "Tanggal wajib diisi.";
    if (!f.jenis.trim()) return "Jenis kegiatan wajib diisi.";
    if (!f.pelaksana.trim()) return "Pelaksana wajib diisi.";
    if (!f.status) return "Status wajib dipilih.";

    const dec2 = /^\d+(\.\d{1,2})?$/;
    if (f.biaya && !dec2.test(f.biaya)) return "Total biaya harus angka desimal (maks 2 digit).";
    if (f.biayaMaterial && !dec2.test(f.biayaMaterial)) return "Biaya material tidak valid.";
    if (f.biayaJasa && !dec2.test(f.biayaJasa)) return "Biaya jasa tidak valid.";
    if (f.downtimeJam && !/^\d+(\.\d+)?$/.test(f.downtimeJam)) return "Downtime harus angka (boleh desimal).";

    // jenisPekerjaan boleh kosong (opsional), jika terisi harus salah satu dari enum
    if (
      f.jenisPekerjaan &&
      !jenisOptions.map((o) => o.v).includes(f.jenisPekerjaan)
    ) {
      return "Jenis pekerjaan tidak valid.";
    }

    for (const s of f.sukuCadang) {
      if (s.qty && !/^\d+(\.\d+)?$/.test(s.qty)) return "Qty suku cadang harus angka.";
      if (s.harga && !dec2.test(s.harga)) return "Harga suku cadang tidak valid.";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(form);
    if (err) {
      setMessage(`❌ ${err}`);
      return;
    }

    try {
      setSubmitting(true);
      setMessage("⏳ Menyimpan perubahan…");

      const totalLegacy =
        form!.biaya && form!.biaya !== ""
          ? form!.biaya
          : (parseFloat(form!.biayaMaterial || "0") + parseFloat(form!.biayaJasa || "0") || 0).toString();

      const payload: any = {
        asetId: Number(form!.asetId),
        tanggal: form!.tanggal, // yyyy-mm-dd
        jenis: form!.jenis.trim(),
        pelaksana: form!.pelaksana.trim(),
        catatan: form!.catatan.trim() || null,
        status: form!.status,
        biaya: totalLegacy ? Number(totalLegacy) : 0,
      };

      if (form!.strategi) payload.strategi = form!.strategi;
      if (form!.jenisPekerjaan) payload.jenisPekerjaan = form!.jenisPekerjaan; // ⬅️ kirim kode enum
      if (form!.downtimeJam) payload.downtimeJam = Number(form!.downtimeJam);
      if (form!.biayaMaterial) payload.biayaMaterial = Number(form!.biayaMaterial);
      if (form!.biayaJasa) payload.biayaJasa = Number(form!.biayaJasa);
      if (form!.sukuCadang.length) {
        payload.sukuCadang = form!.sukuCadang
          .filter((s) => s.nama || s.qty || s.satuan || s.harga)
          .map((s) => ({
            nama: s.nama.trim(),
            qty: s.qty ? Number(s.qty) : 0,
            satuan: s.satuan.trim(),
            harga: s.harga ? Number(s.harga) : 0,
          }));
      }

      const res = await fetch(`/api/pemeliharaan/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal memperbarui pemeliharaan");

      setMessage("✅ Berhasil disimpan!");
      setTimeout(() => router.push(`/pemeliharaan/${id}`), 900);
    } catch (e: any) {
      console.error(e);
      setMessage(`❌ ${e?.message || "Terjadi kesalahan server"}`);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex justify-center items-center min-h-screen text-slate-600">
        <Loader className="animate-spin mr-2" />
        Memuat data pemeliharaan…
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

  const asetTerkait = asets.find((a) => a.id === Number(form.asetId)) || null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-amber-700 flex items-center gap-2">
            <Edit className="w-6 h-6" /> Edit Pemeliharaan
          </h1>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-blue-700 hover:underline text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
        </div>

        {/* Aset terkait */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
          <div className="text-xs font-medium text-slate-500 mb-2">Aset Terkait</div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="inline-flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-500" />
              <span className="font-medium">
                {pem?.aset?.nama || asetTerkait?.nama || "-"}
              </span>
            </div>
            <div className="inline-flex items-center gap-2">
              <Barcode className="w-4 h-4 text-slate-500" />
              <span className="font-mono">
                {pem?.aset?.nia || asetTerkait?.nia || "-"}
              </span>
            </div>
          </div>
          {pem?.aset?.nia && (
            <div className="mt-3">
              <Link
                href={`/inventarisasi/${pem.aset.nia}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded border hover:bg-slate-50 text-sm"
              >
                <Package className="w-4 h-4" /> Buka Detail Aset
              </Link>
            </div>
          )}
        </div>

        {/* ====== GRID 2 CARD ====== */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1 — Form Pemeliharaan */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Form Pemeliharaan</h2>
              <p className="text-xs text-slate-500 mt-1">
                Lengkapi data utama. Field bertanda <span className="font-semibold">*</span> wajib diisi.
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Aset */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  <ClipboardList className="inline mr-1 -mt-1" size={14} />
                  Pilih Aset <span className="text-rose-600">*</span>
                </label>
                <select
                  name="asetId"
                  value={form.asetId}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-amber-300"
                >
                  <option value="">-- Pilih Aset --</option>
                  {asets.map((aset) => (
                    <option key={aset.id} value={aset.id}>
                      {aset.nama} ({aset.nia})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal + Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    <Calendar className="inline mr-1 -mt-1" size={14} />
                    Tanggal <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    name="tanggal"
                    value={form.tanggal}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    <ShieldCheck className="inline mr-1 -mt-1" size={14} />
                    Status <span className="text-rose-600">*</span>
                  </label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 bg-white focus:ring-2 focus:ring-amber-300"
                  >
                    <option value="Terjadwal">Terjadwal</option>
                    <option value="Dalam Proses">Dalam Proses</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
              </div>

              {/* Jenis + Pelaksana */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Jenis Kegiatan <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="jenis"
                    value={form.jenis}
                    onChange={handleChange}
                    required
                    placeholder="Contoh: Servis berkala pompa booster"
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    <UserCog className="inline mr-1 -mt-1" size={14} />
                    Pelaksana <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="pelaksana"
                    value={form.pelaksana}
                    onChange={handleChange}
                    required
                    placeholder="Nama teknisi / tim"
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              {/* Total biaya (legacy) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  <Coins className="inline mr-1 -mt-1" size={14} />
                  Total Biaya (opsional)
                </label>
                <input
                  type="number"
                  name="biaya"
                  value={form.biaya}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="Biaya keseluruhan"
                  className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-amber-300"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Jika dikosongkan, sistem memakai <b>Biaya Material + Biaya Jasa</b> (dari card kanan).
                </p>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-sm font-semibold text-slate-700">Catatan</label>
                <textarea
                  name="catatan"
                  value={form.catatan}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Contoh: Ganti seal, cek kabel"
                  className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-amber-300"
                />
              </div>
            </div>
          </section>

          {/* Card 2 — Detail Teknis (opsional) */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Detail Teknis (opsional)</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Isi jika ingin breakdown lebih rinci sesuai pedoman PDAM.
                </p>
              </div>
              <div className="hidden md:flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <Boxes size={16} /> Est. Material:
                  <b className="text-slate-900">Rp {estMaterial.toLocaleString("id-ID")}</b>
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <Calculator size={16} /> Subtotal:
                  <b className="text-slate-900">Rp {estSubtotal.toLocaleString("id-ID")}</b>
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Strategi & jenis pekerjaan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Strategi</label>
                  <select
                    name="strategi"
                    value={form.strategi}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 bg-white focus:ring-2 focus:ring-amber-300"
                  >
                    {strategiOptions.map((o) => (
                      <option key={o.v} value={o.v}>{o.t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Jenis Pekerjaan</label>
                  <select
                    name="jenisPekerjaan"
                    value={form.jenisPekerjaan}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 bg-white focus:ring-2 focus:ring-amber-300"
                  >
                    {jenisOptions.map((o) => (
                      <option key={o.v} value={o.v}>{o.t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Downtime + biaya breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    <Timer className="inline mr-1 -mt-1" size={14} />
                    Downtime (jam)
                  </label>
                  <input
                    type="number"
                    name="downtimeJam"
                    value={form.downtimeJam}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    placeholder="0"
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Biaya Material (Rp)</label>
                  <input
                    type="number"
                    name="biayaMaterial"
                    value={form.biayaMaterial}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder={estMaterial ? estMaterial.toFixed(2) : "0"}
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-amber-300"
                  />
                  {estMaterial > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Estimasi dari suku cadang: <b>Rp {estMaterial.toLocaleString("id-ID")}</b>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Biaya Jasa (Rp)</label>
                  <input
                    type="number"
                    name="biayaJasa"
                    value={form.biayaJasa}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="0"
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              {/* Suku cadang */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Boxes size={16} /> Suku Cadang
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addSpare}
                      className="inline-flex items-center gap-2 px-3 py-1.5 border rounded hover:bg-slate-50 text-sm"
                    >
                      <PlusCircle size={16} /> Tambah Item
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) =>
                          f ? { ...f, sukuCadang: [], biayaMaterial: "" } : f
                        )
                      }
                      className="inline-flex items-center gap-2 px-3 py-1.5 border rounded hover:bg-slate-50 text-sm"
                      title="Kosongkan semua item"
                    >
                      <RotateCw size={16} /> Bersihkan
                    </button>
                  </div>
                </div>

                {form.sukuCadang.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Belum ada item. Tambahkan jika perlu mencatat komponen yang diganti.
                  </p>
                ) : (
                  <div className="overflow-auto rounded border border-slate-200">
                  <table className="min-w-full table-fixed text-sm">
                    {/* Atur proporsi lebar kolom */}
                    <colgroup>
                      <col className="w-[40%]" /> {/* Nama: lebar */}
                      <col className="w-[10%]" /> {/* Qty: kecil */}
                      <col className="w-[14%]" /> {/* Satuan: kecil */}
                      <col className="w-[25%]" /> {/* Harga */}
                      <col className="w-[14%]" /> {/* Subtotal */}
                      <col className="w-[0%]" />  {/* Aksi (ikon hapus) */}
                    </colgroup>

                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Nama</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-left">Satuan</th>
                        <th className="px-3 py-2 text-right">Harga (Rp)</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>

                    <tbody>
                      {form.sukuCadang.map((s) => {
                        const qty = parseFloat(s.qty || "0");
                        const harga = parseFloat(s.harga || "0");
                        const sub = (isFinite(qty) && isFinite(harga) ? qty * harga : 0);
                        return (
                          <tr key={s.id} className="border-t">
                            {/* Nama — full width di kolomnya */}
                            <td className="px-3 py-2">
                              <input
                                className="w-full border border-slate-300 rounded px-2 py-1"
                                value={s.nama}
                                onChange={(e) => updSpare(s.id, "nama", e.target.value)}
                                placeholder="Nama item / part"
                              />
                            </td>

                            {/* Qty — kecil & rata kanan */}
                            <td className="px-3 py-2">
                              <input
                                className="w-full text-right border border-slate-300 rounded px-2 py-1"
                                value={s.qty}
                                onChange={(e) => updSpare(s.id, "qty", e.target.value)}
                                inputMode="decimal"
                                placeholder="0"
                              />
                            </td>

                            {/* Satuan — kecil */}
                            <td className="px-3 py-2">
                              <input
                                className="w-full border border-slate-300 rounded px-2 py-1"
                                value={s.satuan}
                                onChange={(e) => updSpare(s.id, "satuan", e.target.value)}
                                placeholder="pcs"
                              />
                            </td>

                            {/* Harga — rata kanan */}
                            <td className="px-3 py-2">
                              <input
                                className="w-full text-right border border-slate-300 rounded px-2 py-1"
                                value={s.harga}
                                onChange={(e) => updSpare(s.id, "harga", e.target.value)}
                                inputMode="decimal"
                                placeholder="0"
                              />
                            </td>

                            {/* Subtotal — tampilan saja */}
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              Rp {sub.toLocaleString("id-ID")}
                            </td>

                            {/* Aksi hapus */}
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => delSpare(s.id)}
                                className="text-slate-500 hover:text-red-600"
                                title="Hapus"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                )}
              </div>

              {/* Ringkasan total */}
              <div className="rounded-lg bg-slate-50 p-3 text-sm flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="inline-flex items-center gap-2">
                  <Boxes size={16} className="text-slate-500" />
                  Est. Material: <b>Rp {estMaterial.toLocaleString("id-ID")}</b>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Calculator size={16} className="text-slate-500" />
                  Subtotal (Material + Jasa):{" "}
                  <b>Rp {estSubtotal.toLocaleString("id-ID")}</b>
                </span>
                <span className="text-slate-500">
                  * Jika <b>Total Biaya</b> di card kiri kosong, sistem pakai subtotal ini.
                </span>
              </div>
            </div>
          </section>

          {/* Action bar */}
          <div className="lg:col-span-2 flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.push(`/pemeliharaan/${id}`)}
              className="px-4 py-2 rounded border text-slate-700 hover:bg-slate-50"
              disabled={submitting}
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={submitting}
              className={`${
                submitting ? "opacity-60 cursor-not-allowed" : "hover:bg-amber-700"
              } bg-amber-600 text-white py-2 px-4 rounded-md inline-flex items-center gap-2`}
            >
              {submitting && <Loader className="w-4 h-4 animate-spin" />}
              <Edit className="w-4 h-4" />
              Simpan Perubahan
            </button>
          </div>

          {message && (
            <div
              className={`lg:col-span-2 text-center font-medium text-sm mt-1 ${
                message.startsWith("✅")
                  ? "text-green-600"
                  : message.startsWith("❌")
                  ? "text-red-600"
                  : "text-slate-700"
              }`}
            >
              {message}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
