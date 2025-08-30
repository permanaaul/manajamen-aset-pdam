// app/hublang/param/tarif/tambah/page.tsx
"use client";

import Link from "next/link";
import React, { useMemo, useRef, useState } from "react";

/* =========================
 * Helpers & Types
 * ========================= */
type Blok = {
  urutan: number;
  dariM3?: number | "";
  sampaiM3?: number | "";
  tarifPerM3: string; // string agar enak diketik (tanpa masking library)
};

const toNum = (v: string | number | null | undefined): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = v.replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const fmtIDR = (v: number) => idr.format(v);

/* =========================
 * KOMPONEN KECIL (stabil)
 * ========================= */
const L = React.memo(function L({ children }: { children: React.ReactNode }) {
  return <label className="text-sm text-gray-700">{children}</label>;
});

const I = React.memo(
  React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    function I(props, ref) {
      return (
        <input
          ref={ref}
          {...props}
          className={`border rounded w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 ${props.className || ""}`}
        />
      );
    }
  )
);

/* ==== Icons (inline, tanpa deps) ==== */
const IconInfo = (p: any) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".1" />
    <path d="M12 8.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM11 10.5h2V17h-2z" fill="currentColor" />
  </svg>
);
const IconSuccess = (p: any) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".1" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);
const IconError = (p: any) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".1" />
    <path d="M15 9 9 15M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ==== Toast ringan (tanpa lib) ==== */
type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; title: string; message?: string };

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, ...t }]);
    // auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  };
  const dismiss = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));
  return { toasts, push, dismiss };
}

/* =========================
 * PAGE
 * ========================= */
export default function PageParamTarif() {
  const { toasts, push, dismiss } = useToasts();

  const [form, setForm] = useState({
    kode: "",
    nama: "",
    diameterMm: "",
    minChargeM3: "",
    minChargeRp: "",
    biayaAdminRp: "0",
    pembulatanDenom: 1 as 1 | 100 | 1000,
    pajakAktif: false,
    pajakPersen: "",
    subsidiCatatan: "",
    subsidiRp: "",
    gracePeriodHari: 10,
    skemaDenda: "",
    dendaFlatPerHariRp: "",
    dendaPersenPerBulan: "",
    dendaBertahapJson: "",
    sp1Hari: 15,
    sp2Hari: 30,
    sp3Hari: 45,
    biayaBukaTutupRp: "",
    biayaPasangKembaliRp: "",
  });

  const [blok, setBlok] = useState<Blok[]>([
    { urutan: 1, dariM3: 0, sampaiM3: "", tarifPerM3: "0" },
  ]);

  const [loading, setLoading] = useState(false);

  // ====== Validasi ringkas ======
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.kode.trim()) e.kode = "Wajib diisi";
    if (!form.nama.trim()) e.nama = "Wajib diisi";

    const m3 = form.minChargeM3 !== "";
    const rp = form.minChargeRp !== "";
    if ((m3 && rp) || (!m3 && !rp))
      e.minCharge = "Pilih salah satu: Min Charge m³ ATAU Min Charge Rp";

    if (!blok.length) e.blokKosong = "Minimal 1 blok tarif";

    blok.forEach((b, i) => {
      if (!b.tarifPerM3 || toNum(b.tarifPerM3) <= 0)
        e[`blok.${i}.tarifPerM3`] = "Tarif per m³ harus > 0";
      if (b.dariM3 !== "" && b.sampaiM3 !== "" && Number(b.dariM3) > Number(b.sampaiM3))
        e[`blok.${i}.range`] = "Rentang tidak valid";
    });

    if (form.dendaBertahapJson) {
      try {
        JSON.parse(form.dendaBertahapJson);
      } catch {
        e.dendaBertahapJson = "JSON tidak valid";
      }
    }
    return e;
  }, [form, blok]);

  const hasError = Object.keys(errors).length > 0;

  // ====== Simulasi ======
  const [simPakai, setSimPakai] = useState<number>(10);
  const sim = useMemo(() => {
    const blocks = [...blok].sort((a, b) => a.urutan - b.urutan);
    let sisa = Math.max(0, simPakai);
    let air = 0;

    for (const b of blocks) {
      const start = b.dariM3 === "" ? 0 : Number(b.dariM3);
      const end = b.sampaiM3 === "" ? Infinity : Number(b.sampaiM3);
      if (sisa <= 0) break;

      const kapasitas = end === Infinity ? sisa : Math.max(0, end - start + 1);
      const span = Math.max(0, Math.min(sisa, kapasitas));
      if (span > 0) {
        air += span * toNum(b.tarifPerM3);
        sisa -= span;
      }
    }

    const minM3 = form.minChargeM3 !== "" ? Number(form.minChargeM3) : null;
    const minRp = form.minChargeRp !== "" ? toNum(form.minChargeRp) : null;
    if (minM3 != null && simPakai < minM3) {
      const diff = minM3 - simPakai;
      const pertama = blocks[0];
      if (pertama) air += diff * toNum(pertama.tarifPerM3);
    } else if (minRp != null) {
      air = Math.max(air, minRp);
    }

    const admin = toNum(form.biayaAdminRp);
    const pajak =
      form.pajakAktif && toNum(form.pajakPersen) > 0
        ? (air + admin) * (toNum(form.pajakPersen) / 100)
        : 0;

    const denom = Number(form.pembulatanDenom || 1);
    const totalRaw = air + admin + pajak;
    const totalRounded = Math.round(totalRaw / denom) * denom;

    return { air, admin, pajak, totalRaw, totalRounded };
  }, [blok, simPakai, form]);

  // ====== Aksi Blok ======
  const addBlok = () =>
    setBlok((prev) => [
      ...prev,
      {
        urutan: prev.length + 1,
        dariM3: prev[prev.length - 1]?.sampaiM3 === "" ? "" : Number(prev[prev.length - 1]?.sampaiM3 || 0) + 1,
        sampaiM3: "",
        tarifPerM3: "0",
      },
    ]);

  const delBlok = (idx: number) =>
    setBlok((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((b, i) => ({ ...b, urutan: i + 1 }))
    );

  const move = (idx: number, dir: -1 | 1) =>
    setBlok((prev) => {
      const to = idx + dir;
      if (to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[to]] = [copy[to], copy[idx]];
      return copy.map((b, i) => ({ ...b, urutan: i + 1 }));
    });

  // ====== Submit ======
  const refKode = useRef<HTMLInputElement | null>(null);

  const submit = async () => {
    if (hasError) {
      push({
        kind: "error",
        title: "Validasi gagal",
        message: "Periksa kembali input yang ditandai merah.",
      });
      // fokuskan ke kode jika wajib
      if (errors.kode) refKode.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const m3 = form.minChargeM3 !== "";
      const rp = form.minChargeRp !== "";
      if ((m3 && rp) || (!m3 && !rp)) {
        throw new Error("Pilih salah satu: minCharge m³ ATAU minCharge Rp");
      }

      const payload: any = {
        ...form,
        diameterMm: form.diameterMm ? Number(form.diameterMm) : undefined,
        minChargeM3: form.minChargeM3 === "" ? null : Number(form.minChargeM3),
        minChargeRp: form.minChargeRp === "" ? null : form.minChargeRp,
        pajakPersen: form.pajakAktif ? form.pajakPersen || "0" : null,
        subsidiRp: form.subsidiRp || null,
        skemaDenda: form.skemaDenda ? form.skemaDenda.toUpperCase() : null,
        dendaFlatPerHariRp: form.dendaFlatPerHariRp || null,
        dendaPersenPerBulan: form.dendaPersenPerBulan || null,
        dendaBertahapJson: form.dendaBertahapJson ? JSON.parse(form.dendaBertahapJson) : null,
        biayaBukaTutupRp: form.biayaBukaTutupRp || null,
        biayaPasangKembaliRp: form.biayaPasangKembaliRp || null,
        blok: blok.map((b) => ({
          urutan: b.urutan,
          dariM3: b.dariM3 === "" ? null : Number(b.dariM3),
          sampaiM3: b.sampaiM3 === "" ? null : Number(b.sampaiM3),
          tarifPerM3: b.tarifPerM3,
        })),
      };

      const res = await fetch("/api/hublang/tarif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal simpan tarif");

      push({
        kind: "success",
        title: "Tersimpan",
        message: `Tarif #${data.id} berhasil dibuat.`,
      });

      // opsional: reset singkat untuk input baru
      setForm((f) => ({ ...f, kode: "", nama: "" }));
      refKode.current?.focus();
    } catch (e: any) {
      push({ kind: "error", title: "Gagal simpan", message: e?.message || "Terjadi kesalahan." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5 relative text-gray-900">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border shadow-sm p-3 bg-white max-w-sm ${
              t.kind === "success" ? "border-emerald-200" : t.kind === "error" ? "border-red-200" : "border-gray-200"
            }`}
          >
            <div
              className={`mt-0.5 ${
                t.kind === "success" ? "text-emerald-600" : t.kind === "error" ? "text-red-600" : "text-gray-600"
              }`}
            >
              {t.kind === "success" ? <IconSuccess /> : t.kind === "error" ? <IconError /> : <IconInfo />}
            </div>
            <div className="flex-1">
              <div className="font-medium">{t.title}</div>
              {t.message && <div className="text-sm text-gray-600">{t.message}</div>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-gray-500 hover:text-gray-700 px-1"
              aria-label="Tutup notifikasi"
              title="Tutup"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 grid place-items-center z-10">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Parameter Tarif</h1>
          <p className="text-sm text-gray-600">
            Atur golongan tarif (blok m³, minimum charge, admin, pajak) sekaligus kebijakan denda & teguran.
          </p>
        </div>
        <Link
          href="/hublang/param/tarif"
          className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          title="Kembali ke daftar"
        >
          ← Kembali
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl shadow border border-gray-200 space-y-4">
        {/* Info dasar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <L>
              Kode <span className="text-red-600">*</span>
            </L>
            <I
              value={form.kode}
              ref={refKode}
              onChange={(e) => setForm((f) => ({ ...f, kode: e.target.value }))}
              aria-invalid={!!errors.kode}
              aria-describedby={errors.kode ? "err-kode" : undefined}
            />
            {errors.kode && (
              <p id="err-kode" className="text-xs text-red-600 mt-1">
                {errors.kode}
              </p>
            )}
          </div>
          <div>
            <L>
              Nama <span className="text-red-600">*</span>
            </L>
            <I
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
              aria-invalid={!!errors.nama}
              aria-describedby={errors.nama ? "err-nama" : undefined}
            />
            {errors.nama && (
              <p id="err-nama" className="text-xs text-red-600 mt-1">
                {errors.nama}
              </p>
            )}
          </div>
          <div>
            <L>Diameter (mm)</L>
            <I
              type="number"
              value={form.diameterMm}
              onChange={(e) => setForm((f) => ({ ...f, diameterMm: e.target.value }))}
              inputMode="numeric"
            />
          </div>

          <div>
            <L>Min Charge (m³)</L>
            <I
              type="number"
              value={form.minChargeM3}
              onChange={(e) => setForm((f) => ({ ...f, minChargeM3: e.target.value, minChargeRp: "" }))}
              placeholder="isi ini ATAU Min Charge (Rp)"
              inputMode="numeric"
            />
          </div>
          <div>
            <L>Min Charge (Rp)</L>
            <I
              value={form.minChargeRp}
              onChange={(e) => setForm((f) => ({ ...f, minChargeRp: e.target.value, minChargeM3: "" }))}
              placeholder="isi ini ATAU Min Charge (m³)"
              aria-invalid={!!errors.minCharge}
              aria-describedby={errors.minCharge ? "err-min" : undefined}
            />
            {errors.minCharge && (
              <p id="err-min" className="text-xs text-red-600 mt-1">
                {errors.minCharge}
              </p>
            )}
          </div>
          <div>
            <L>Biaya Admin (Rp)</L>
            <I value={form.biayaAdminRp} onChange={(e) => setForm((f) => ({ ...f, biayaAdminRp: e.target.value }))} />
          </div>

          <div>
            <L>Pembulatan</L>
            <select
              className="border rounded w-full px-3 py-2 text-sm text-gray-900"
              value={form.pembulatanDenom}
              onChange={(e) => setForm((f) => ({ ...f, pembulatanDenom: Number(e.target.value) as 1 | 100 | 1000 }))}
            >
              {[1, 100, 1000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="pajakAktif"
              type="checkbox"
              checked={form.pajakAktif}
              onChange={(e) => setForm((f) => ({ ...f, pajakAktif: e.target.checked }))}
            />
            <L>Pajak Aktif</L>
          </div>
          <div>
            <L>Pajak %</L>
            <I
              disabled={!form.pajakAktif}
              value={form.pajakPersen}
              onChange={(e) => setForm((f) => ({ ...f, pajakPersen: e.target.value }))}
              placeholder="contoh: 11"
            />
          </div>
          <div>
            <L>Subsidi (Rp)</L>
            <I value={form.subsidiRp} onChange={(e) => setForm((f) => ({ ...f, subsidiRp: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <L>Subsidi Catatan</L>
            <I
              value={form.subsidiCatatan}
              onChange={(e) => setForm((f) => ({ ...f, subsidiCatatan: e.target.value }))}
            />
          </div>
        </div>

        {/* Blok tarif */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold mb-2">Blok Tarif</h3>
            {errors.blokKosong && <span className="text-xs text-red-600">{errors.blokKosong}</span>}
          </div>
          <div className="space-y-3">
            {blok.map((b, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-2 items-end border rounded-lg p-3">
                <div>
                  <L>Urutan</L>
                  <I
                    type="number"
                    value={b.urutan}
                    onChange={(e) =>
                      setBlok((prev) => prev.map((x, i) => (i === idx ? { ...x, urutan: Number(e.target.value) } : x)))
                    }
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <L>Dari m³</L>
                  <I
                    type="number"
                    value={b.dariM3 as any}
                    onChange={(e) =>
                      setBlok((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, dariM3: e.target.value === "" ? "" : Number(e.target.value) } : x
                        )
                      )
                    }
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <L>Sampai m³</L>
                  <I
                    type="number"
                    value={b.sampaiM3 as any}
                    onChange={(e) =>
                      setBlok((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, sampaiM3: e.target.value === "" ? "" : Number(e.target.value) } : x
                        )
                      )
                    }
                    inputMode="numeric"
                  />
                </div>
                <div className="col-span-2">
                  <L>
                    Tarif per m³ (Rp) <span className="text-red-600">*</span>
                  </L>
                  <I
                    value={b.tarifPerM3}
                    onChange={(e) => setBlok((prev) => prev.map((x, i) => (i === idx ? { ...x, tarifPerM3: e.target.value } : x)))}
                    aria-invalid={!!errors[`blok.${idx}.tarifPerM3`] || !!errors[`blok.${idx}.range`]}
                  />
                  {errors[`blok.${idx}.tarifPerM3`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`blok.${idx}.tarifPerM3`]}</p>
                  )}
                  {errors[`blok.${idx}.range`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`blok.${idx}.range`]}</p>
                  )}
                </div>

                <div className="col-span-5 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      className="px-2 py-1 border rounded"
                      disabled={idx === 0}
                      title="Naikkan"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, +1)}
                      className="px-2 py-1 border rounded"
                      disabled={idx === blok.length - 1}
                      title="Turunkan"
                    >
                      ↓
                    </button>
                  </div>
                  <button onClick={() => delBlok(idx)} className="text-red-600 hover:underline" type="button">
                    Hapus
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addBlok} className="mt-2 px-3 py-1 border rounded" type="button">
              + Tambah Blok
            </button>
          </div>
        </div>

        {/* Kebijakan denda & teguran (opsional) */}
        <div>
          <h3 className="font-semibold mb-2">Kebijakan Denda & Teguran (opsional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <L>Grace Period (hari)</L>
              <I
                type="number"
                value={form.gracePeriodHari}
                onChange={(e) => setForm((f) => ({ ...f, gracePeriodHari: Number(e.target.value || 0) }))}
                inputMode="numeric"
              />
            </div>

            <div>
              <L>Skema Denda</L>
              <select
                className="border rounded w-full px-3 py-2 text-sm text-gray-900"
                value={form.skemaDenda}
                onChange={(e) => setForm((f) => ({ ...f, skemaDenda: e.target.value }))}
              >
                <option value="">(kosongkan)</option>
                <option value="FLAT">FLAT</option>
                <option value="PERSEN">PERSEN</option>
                <option value="BERTAHAP">BERTAHAP</option>
              </select>
            </div>

            <div>
              <L>Denda Flat per Hari (Rp)</L>
              <I value={form.dendaFlatPerHariRp} onChange={(e) => setForm((f) => ({ ...f, dendaFlatPerHariRp: e.target.value }))} />
            </div>
            <div>
              <L>Denda % per Bulan</L>
              <I value={form.dendaPersenPerBulan} onChange={(e) => setForm((f) => ({ ...f, dendaPersenPerBulan: e.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <L>Denda Bertahap (JSON)</L>
              <I
                value={form.dendaBertahapJson}
                onChange={(e) => setForm((f) => ({ ...f, dendaBertahapJson: e.target.value }))}
                placeholder='contoh: [{"hari":30,"rp":5000}]'
                aria-invalid={!!errors.dendaBertahapJson}
              />
              {errors.dendaBertahapJson && <p className="text-xs text-red-600 mt-1">{errors.dendaBertahapJson}</p>}
            </div>

            <div>
              <L>SP1 (hari)</L>
              <I type="number" value={form.sp1Hari} onChange={(e) => setForm((f) => ({ ...f, sp1Hari: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <L>SP2 (hari)</L>
              <I type="number" value={form.sp2Hari} onChange={(e) => setForm((f) => ({ ...f, sp2Hari: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <L>SP3 (hari)</L>
              <I type="number" value={form.sp3Hari} onChange={(e) => setForm((f) => ({ ...f, sp3Hari: Number(e.target.value || 0) }))} />
            </div>

            <div>
              <L>Biaya Buka/Tutup (Rp)</L>
              <I value={form.biayaBukaTutupRp} onChange={(e) => setForm((f) => ({ ...f, biayaBukaTutupRp: e.target.value }))} />
            </div>
            <div>
              <L>Biaya Pasang Kembali (Rp)</L>
              <I value={form.biayaPasangKembaliRp} onChange={(e) => setForm((f) => ({ ...f, biayaPasangKembaliRp: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Simulasi */}
        <div className="bg-gray-50 rounded-lg p-4 border">
          <h3 className="font-semibold mb-2">Simulasi Tagihan (preview cepat)</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <L>Pemakaian (m³)</L>
              <I type="number" value={simPakai} onChange={(e) => setSimPakai(Number(e.target.value || 0))} inputMode="numeric" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-white rounded border">
                <div className="text-gray-500">Air</div>
                <div className="font-medium">{fmtIDR(sim.air)}</div>
              </div>
              <div className="p-2 bg-white rounded border">
                <div className="text-gray-500">Admin</div>
                <div className="font-medium">{fmtIDR(sim.admin)}</div>
              </div>
              <div className="p-2 bg-white rounded border">
                <div className="text-gray-500">Pajak</div>
                <div className="font-medium">{fmtIDR(sim.pajak)}</div>
              </div>
              <div className="p-2 bg-white rounded border">
                <div className="text-gray-500">Total (dibulatkan)</div>
                <div className="font-semibold">{fmtIDR(sim.totalRounded)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={submit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {loading ? "Menyimpan..." : "Simpan Tarif"}
          </button>

          <button
            type="button"
            onClick={() => {
              setForm({
                kode: "",
                nama: "",
                diameterMm: "",
                minChargeM3: "",
                minChargeRp: "",
                biayaAdminRp: "0",
                pembulatanDenom: 1,
                pajakAktif: false,
                pajakPersen: "",
                subsidiCatatan: "",
                subsidiRp: "",
                gracePeriodHari: 10,
                skemaDenda: "",
                dendaFlatPerHariRp: "",
                dendaPersenPerBulan: "",
                dendaBertahapJson: "",
                sp1Hari: 15,
                sp2Hari: 30,
                sp3Hari: 45,
                biayaBukaTutupRp: "",
                biayaPasangKembaliRp: "",
              });
              setBlok([{ urutan: 1, dariM3: 0, sampaiM3: "", tarifPerM3: "0" }]);
              push({ kind: "info", title: "Form direset", message: "Semua isian kembali ke awal." });
              refKode.current?.focus();
            }}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Reset
          </button>

          <Link href="/hublang/param/tarif" className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Batalkan
          </Link>
        </div>
      </div>
    </div>
  );
}
