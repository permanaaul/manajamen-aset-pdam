"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PlusCircle,
  CalendarCheck,
  Wrench,
  ClipboardList,
  BadgeCheck,
  UserCog,
  StickyNote,
  Package,
  Barcode,
  MapPin,
  ActivitySquare,
  Save,
  RotateCw,
  ArrowLeft,
  Boxes,
  Timer,
  Calculator,
} from "lucide-react";

type UserLocal = { nama: string; role: string } | null;

type Aset = {
  id: number;
  nia: string;
  nama: string;
  kategori?: string;
  lokasi?: string;
  kondisi?: string;
};

type SpareItem = {
  id: string;
  nama: string;
  qty: string;     // number as string (untuk input)
  satuan: string;
  harga: string;   // number as string
};

type FormState = {
  asetId: string;
  tanggal: string;     // yyyy-mm-dd
  jenis: string;
  biaya: string;       // total (legacy) – optional
  pelaksana: string;
  catatan: string;
  status: "Terjadwal" | "Dalam Proses" | "Selesai" | "";

  // Lanjutan (opsional)
  strategi: "PREVENTIF" | "KOREKTIF" | "INSIDENTAL" | "DARURAT" | "";
  jenisPekerjaan: string;
  downtimeJam: string;      // desimal
  biayaMaterial: string;    // desimal
  biayaJasa: string;        // desimal
  sukuCadang: SpareItem[];
};

const strategiOptions = [
  { v: "", t: "(Pilih atau kosongkan)" },
  { v: "PREVENTIF", t: "Preventif" },
  { v: "KOREKTIF", t: "Korektif" },
  { v: "INSIDENTAL", t: "Insidental" },
  { v: "DARURAT", t: "Darurat" },
] as const;

export default function TambahPemeliharaan() {
  const router = useRouter();
  const search = useSearchParams();

  const [user, setUser]       = useState<UserLocal>(null);
  const [asets, setAsets]     = useState<Aset[]>([]);
  const [q, setQ]             = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]     = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    asetId: "",
    tanggal: "",
    jenis: "",
    biaya: "",
    pelaksana: "",
    catatan: "",
    status: "",

    strategi: "",
    jenisPekerjaan: "",
    downtimeJam: "",
    biayaMaterial: "",
    biayaJasa: "",
    sukuCadang: [],
  });

  // guard login + role (ADMIN/TEKNISI)
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u = JSON.parse(raw);
    setUser(u);
    if (!["ADMIN", "TEKNISI"].includes(u.role)) {
      router.replace("/forbidden");
      return;
    }
  }, [router]);

  // fetch aset (dengan optional search ?q=)
  const fetchAsets = async (keyword = "") => {
    try {
      const params = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
      const res = await fetch(`/api/inventarisasi${params}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setAsets(data);
      else console.error(data.error || "Gagal fetch aset");
    } catch (e) {
      console.error("Gagal mengambil aset:", e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchAsets();
  }, []);

  // preselect dari URL (?nia=... atau ?asetId=...)
  useEffect(() => {
    const nia = search?.get("nia");
    const asetIdParam = search?.get("asetId");
    if (asetIdParam) {
      setForm((f) => ({ ...f, asetId: asetIdParam }));
    } else if (nia && asets.length) {
      const found = asets.find((a) => a.nia === nia);
      if (found) setForm((f) => ({ ...f, asetId: String(found.id) }));
    }
  }, [search, asets]);

  // aset yang terpilih → untuk card ringkas
  const selectedAset = useMemo(
    () => asets.find((a) => String(a.id) === form.asetId),
    [asets, form.asetId]
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ====== suku cadang handlers ======
  const addSpare = () =>
    setForm((f) => ({
      ...f,
      sukuCadang: [
        ...f.sukuCadang,
        { id: crypto.randomUUID(), nama: "", qty: "", satuan: "", harga: "" },
      ],
    }));

  const updSpare = (id: string, key: keyof SpareItem, val: string) =>
    setForm((f) => ({
      ...f,
      sukuCadang: f.sukuCadang.map((s) => (s.id === id ? { ...s, [key]: val } : s)),
    }));

  const delSpare = (id: string) =>
    setForm((f) => ({ ...f, sukuCadang: f.sukuCadang.filter((s) => s.id !== id) }));

  const spareEstMaterial = useMemo(() => {
    return form.sukuCadang.reduce((sum, it) => {
      const qty = parseFloat(it.qty || "0");
      const harga = parseFloat(it.harga || "0");
      return sum + (isFinite(qty) && isFinite(harga) ? qty * harga : 0);
    }, 0);
  }, [form.sukuCadang]);

  // validasi ringan di client
  const validate = (f: FormState): string | null => {
    if (!f.asetId || !f.tanggal || !f.jenis || !f.pelaksana || !f.status) {
      return "Field bertanda * wajib diisi.";
    }
    const dec2 = /^\d+(\.\d{1,2})?$/;
    if (f.biaya && !dec2.test(f.biaya)) return "Biaya harus angka desimal (maks 2 digit).";
    if (f.biayaMaterial && !dec2.test(f.biayaMaterial)) return "Biaya material tidak valid.";
    if (f.biayaJasa && !dec2.test(f.biayaJasa)) return "Biaya jasa tidak valid.";
    if (f.downtimeJam && !/^\d+(\.\d+)?$/.test(f.downtimeJam)) return "Downtime harus angka (boleh desimal).";
    for (const s of f.sukuCadang) {
      if (s.qty && !/^\d+(\.\d+)?$/.test(s.qty)) return "Qty suku cadang harus angka.";
      if (s.harga && !dec2.test(s.harga)) return "Harga suku cadang tidak valid.";
    }
    return null;
  };

  const resetForm = () =>
    setForm({
      asetId: "",
      tanggal: "",
      jenis: "",
      biaya: "",
      pelaksana: "",
      catatan: "",
      status: "",
      strategi: "",
      jenisPekerjaan: "",
      downtimeJam: "",
      biayaMaterial: "",
      biayaJasa: "",
      sukuCadang: [],
    });

  const submit = async (goListAfter = true) => {
    const err = validate(form);
    if (err) {
      setToast(`❌ ${err}`);
      setTimeout(() => setToast(null), 1600);
      return;
    }

    setSubmitting(true);
    setToast("⏳ Menyimpan pemeliharaan...");

    try {
      // total legacy: jika biaya kosong tapi breakdown ada ⇒ hitung otomatis
      const totalLegacy =
        form.biaya && form.biaya !== ""
          ? form.biaya
          : (parseFloat(form.biayaMaterial || "0") + parseFloat(form.biayaJasa || "0") || 0).toString();

      const payload: any = {
        asetId: Number(form.asetId),
        tanggal: form.tanggal,
        jenis: form.jenis.trim(),
        biaya: totalLegacy ? Number(totalLegacy) : null,
        pelaksana: form.pelaksana.trim(),
        catatan: form.catatan.trim() || null,
        status: form.status,
      };

      // kirim field lanjutan jika ada
      if (form.strategi) payload.strategi = form.strategi;
      if (form.jenisPekerjaan) payload.jenisPekerjaan = form.jenisPekerjaan.trim();
      if (form.downtimeJam) payload.downtimeJam = Number(form.downtimeJam);
      if (form.biayaMaterial) payload.biayaMaterial = Number(form.biayaMaterial);
      if (form.biayaJasa) payload.biayaJasa = Number(form.biayaJasa);
      if (form.sukuCadang.length) {
        payload.sukuCadang = form.sukuCadang
          .filter((s) => s.nama || s.qty || s.satuan || s.harga)
          .map((s) => ({
            nama: s.nama.trim(),
            qty: s.qty ? Number(s.qty) : 0,
            satuan: s.satuan.trim(),
            harga: s.harga ? Number(s.harga) : 0,
          }));
      }

      const res = await fetch("/api/pemeliharaan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan pemeliharaan");

      setToast("✅ Pemeliharaan berhasil ditambahkan");
      if (goListAfter) {
        setTimeout(() => router.push("/pemeliharaan"), 800);
      } else {
        // simpan & tambah lagi
        resetForm();
        setTimeout(() => setToast(null), 1000);
      }
    } catch (e: any) {
      setToast(`❌ ${e?.message || "Terjadi kesalahan server"}`);
      setTimeout(() => setToast(null), 1600);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || loading) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-slate-600">⏳ Memuat halaman...</p>
      </main>
    );
  }

  const estTotal =
    (parseFloat(form.biayaMaterial || "0") || 0) +
    (parseFloat(form.biayaJasa || "0") || 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
            <PlusCircle className="w-6 h-6" />
            Tambah Pemeliharaan
          </h1>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-blue-700 hover:underline text-sm"
            title="Kembali"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
        </div>

        {/* ====== GRID 2 CARD ====== */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(true);
          }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Card 1 — Tambah Pemeliharaan */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                Form Pemeliharaan
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Lengkapi data utama. Field bertanda <span className="font-semibold">*</span> wajib diisi.
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Search aset + select */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari aset (NIA / Nama / Lokasi)…"
                    className="border border-slate-300 rounded px-3 py-2 w-full md:w-[26rem] focus:ring-2 focus:ring-emerald-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => fetchAsets(q)}
                    className="inline-flex items-center gap-2 px-3 py-2 border rounded hover:bg-slate-50"
                  >
                    Cari
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      fetchAsets("");
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 border rounded hover:bg-slate-50"
                    title="Reset"
                  >
                    <RotateCw size={16} /> Reset
                  </button>
                </div>

                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  <ClipboardList className="inline mr-1 -mt-1" size={14} />
                  Pilih Aset <span className="text-rose-600">*</span>
                </label>
                <select
                  name="asetId"
                  value={form.asetId}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-300"
                >
                  <option value="">-- Pilih Aset --</option>
                  {asets.map((aset) => (
                    <option key={aset.id} value={aset.id}>
                      {aset.nama} ({aset.nia})
                    </option>
                  ))}
                </select>

                {/* Ringkasan aset */}
                {selectedAset && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="inline-flex items-center gap-2 text-slate-700">
                      <Package size={14} className="text-slate-500" />
                      <span className="font-medium">{selectedAset.nama}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 text-slate-700">
                      <Barcode size={14} className="text-slate-500" />
                      <span className="font-mono">{selectedAset.nia}</span>
                    </div>
                    {selectedAset.lokasi && (
                      <div className="inline-flex items-center gap-2 text-slate-700">
                        <MapPin size={14} className="text-slate-500" />
                        <span>{selectedAset.lokasi}</span>
                      </div>
                    )}
                    {selectedAset.kondisi && (
                      <div className="inline-flex items-center gap-2 text-slate-700">
                        <ActivitySquare size={14} className="text-slate-500" />
                        <span>{selectedAset.kondisi}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tanggal + Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    <CalendarCheck className="inline mr-1 -mt-1" size={14} />
                    Tanggal Pemeliharaan <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    name="tanggal"
                    value={form.tanggal}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    <BadgeCheck className="inline mr-1 -mt-1" size={14} />
                    Status <span className="text-rose-600">*</span>
                  </label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    required
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 bg-white focus:ring-2 focus:ring-emerald-300"
                  >
                    <option value="">-- Pilih Status --</option>
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
                    <Wrench className="inline mr-1 -mt-1" size={14} />
                    Jenis Kegiatan <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="jenis"
                    value={form.jenis}
                    onChange={handleChange}
                    required
                    placeholder="Contoh: Servis pompa, ganti bearing"
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-300"
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
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>

              {/* Total biaya (legacy) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  <ClipboardList className="inline mr-1 -mt-1" size={14} />
                  Total Biaya (opsional)
                </label>
                <input
                  type="number"
                  name="biaya"
                  value={form.biaya}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="Contoh: 150000.50"
                  className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-300"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Jika dikosongkan, sistem akan memakai <b>Biaya Material + Biaya Jasa</b> (dari card sebelah).
                </p>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  <StickyNote className="inline mr-1 -mt-1" size={14} />
                  Catatan (opsional)
                </label>
                <textarea
                  name="catatan"
                  value={form.catatan}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Contoh: Ganti seal, cek kabel, test run 30 menit."
                  className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-300"
                />
              </div>
            </div>
          </section>

          {/* Card 2 — Detail Teknis (opsional) */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Detail Teknis (opsional)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Isi jika ingin breakdown lebih rinci sesuai pedoman PDAM.
                </p>
              </div>

              {/* Ringkasan estimasi */}
              <div className="hidden md:flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <Boxes size={16} /> Est. Material:
                  <b className="text-slate-900">
                    Rp { (spareEstMaterial || 0).toLocaleString("id-ID") }
                  </b>
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <Calculator size={16} /> Subtotal:
                  <b className="text-slate-900">
                    Rp { (estTotal || 0).toLocaleString("id-ID") }
                  </b>
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
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 bg-white focus:ring-2 focus:ring-emerald-300"
                  >
                    {strategiOptions.map((o) => (
                      <option key={o.v} value={o.v}>{o.t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Jenis Pekerjaan</label>
                  <input
                    type="text"
                    name="jenisPekerjaan"
                    value={form.jenisPekerjaan}
                    onChange={handleChange}
                    placeholder="Misal: Inspeksi, Ganti sparepart, Kalibrasi"
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-300"
                  />
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
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-300"
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
                    placeholder={spareEstMaterial ? spareEstMaterial.toFixed(2) : "0"}
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-300"
                  />
                  {spareEstMaterial > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Estimasi dari suku cadang: <b>Rp {spareEstMaterial.toLocaleString("id-ID")}</b>
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
                    className="w-full border border-slate-300 rounded px-3 py-2 mt-1 focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>

              {/* Suku cadang */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Boxes size={16} /> Suku Cadang
                  </h3>
                  <button
                    type="button"
                    onClick={addSpare}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border rounded hover:bg-slate-50 text-sm"
                  >
                    <PlusCircle size={16} /> Tambah Item
                  </button>
                </div>

                {form.sukuCadang.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Belum ada item. Tambahkan jika perlu mencatat komponen yang diganti.
                  </p>
                ) : (
                  <div className="overflow-auto rounded border border-slate-200">
                    <table className="min-w-full text-sm">
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
                              <td className="px-3 py-2">
                                <input
                                  className="w-full border border-slate-300 rounded px-2 py-1"
                                  value={s.nama}
                                  onChange={(e) => updSpare(s.id, "nama", e.target.value)}
                                  placeholder="Nama item"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  className="w-24 text-right border border-slate-300 rounded px-2 py-1"
                                  value={s.qty}
                                  onChange={(e) => updSpare(s.id, "qty", e.target.value)}
                                  inputMode="decimal"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  className="w-24 border border-slate-300 rounded px-2 py-1"
                                  value={s.satuan}
                                  onChange={(e) => updSpare(s.id, "satuan", e.target.value)}
                                  placeholder="pcs"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  className="w-32 text-right border border-slate-300 rounded px-2 py-1"
                                  value={s.harga}
                                  onChange={(e) => updSpare(s.id, "harga", e.target.value)}
                                  inputMode="decimal"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                Rp {sub.toLocaleString("id-ID")}
                              </td>
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
                  Est. Material: <b>Rp {spareEstMaterial.toLocaleString("id-ID")}</b>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Calculator size={16} className="text-slate-500" />
                  Subtotal (Material + Jasa): <b>Rp {estTotal.toLocaleString("id-ID")}</b>
                </span>
                <span className="text-slate-500">
                  * Jika kolom <b>Total Biaya</b> di card kiri kosong, sistem pakai subtotal ini.
                </span>
              </div>
            </div>
          </section>

          {/* Action bar bawah (full width) */}
          <div className="lg:col-span-2 flex flex-wrap gap-3 justify-end">
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-2 bg-emerald-600 text-white py-2 px-4 rounded-md transition ${
                submitting ? "opacity-60 cursor-not-allowed" : "hover:bg-emerald-700"
              }`}
            >
              <Save size={18} /> {submitting ? "Menyimpan..." : "Simpan"}
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => submit(false)}
              className="inline-flex items-center gap-2 border px-4 py-2 rounded-md hover:bg-slate-50"
              title="Simpan dan tambah lagi"
            >
              <PlusCircle size={18} /> Simpan & Tambah Lagi
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={submitting}
              className="inline-flex items-center gap-2 border px-4 py-2 rounded-md hover:bg-slate-50"
              title="Reset form"
            >
              <RotateCw size={18} /> Reset
            </button>
          </div>
        </form>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-black/90 text-white text-sm px-3 py-2 rounded-md shadow">
          {toast}
        </div>
      )}
    </main>
  );
}
