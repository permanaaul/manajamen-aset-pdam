// src/app/akuntansi/unit-biaya/tambah/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Building2,
  ChevronLeft,
  Save,
  CheckCircle2,
  TriangleAlert,
  Info,
  Hash,
  BadgeCheck,
} from "lucide-react";

/* ================= types & const ================= */
type Jenis =
  | "PRODUKSI"
  | "DISTRIBUSI"
  | "PELAYANAN"
  | "ADMINISTRASI"
  | "UMUM_SDM"
  | "LABORATORIUM"
  | "LAINNYA";

const JENIS_OPTIONS: Jenis[] = [
  "PRODUKSI",
  "DISTRIBUSI",
  "PELAYANAN",
  "ADMINISTRASI",
  "UMUM_SDM",
  "LABORATORIUM",
  "LAINNYA",
];

const JENIS_BADGE: Record<Jenis, string> = {
  PRODUKSI: "bg-blue-100 text-blue-700",
  DISTRIBUSI: "bg-violet-100 text-violet-700",
  PELAYANAN: "bg-emerald-100 text-emerald-700",
  ADMINISTRASI: "bg-amber-100 text-amber-700",
  UMUM_SDM: "bg-fuchsia-100 text-fuchsia-700",
  LABORATORIUM: "bg-cyan-100 text-cyan-700",
  LAINNYA: "bg-gray-100 text-gray-700",
};

const KODE_SUGGEST: Record<Jenis, string> = {
  PRODUKSI: "PROD",
  DISTRIBUSI: "DIST",
  PELAYANAN: "PEL",
  ADMINISTRASI: "ADM",
  UMUM_SDM: "UMUM",
  LABORATORIUM: "LAB",
  LAINNYA: "LAIN",
};

function sanitizeCode(v: string) {
  // Uppercase, spasi jadi underscore, buang char selain A-Z 0-9 _ -
  return v
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 12);
}

/* ================= page ================= */
export default function UnitBiayaTambahPage() {
  // role guard
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      window.location.href = "/login";
      return;
    }
    const u = JSON.parse(raw) as { nama: string; role: string };
    setUser(u);
    if (!["ADMIN", "PIMPINAN"].includes(u.role)) window.location.href = "/forbidden";
  }, []);

  // form state
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<Jenis>("LAINNYA");
  const [aktif, setAktif] = useState(true);

  // ux
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // derived
  const canSubmit = useMemo(
    () => sanitizeCode(kode).length > 0 && nama.trim().length > 0 && !!jenis,
    [kode, nama, jenis]
  );

  // autofill kode bila kosong saat ganti jenis
  const onJenisChange = useCallback(
    (j: Jenis) => {
      setJenis(j);
      if (!kode.trim()) setKode(KODE_SUGGEST[j]);
    },
    [kode]
  );

  // keyboard: Ctrl/Cmd + Enter -> submit
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
        const btn = document.getElementById("btn-submit");
        btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const onSubmit = async (e: React.FormEvent | MouseEvent) => {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!canSubmit) {
      setErr("Kode, Nama, dan Jenis wajib diisi.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        kode: sanitizeCode(kode),
        nama: nama.trim(),
        jenis,
        isActive: aktif, // API baru
        aktif, // fallback kompat untuk API lama
        parentId: null, // flat (hierarki kita hide dulu)
      };

      const r = await fetch("/api/akuntansi/unit-biaya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || `Gagal menyimpan (HTTP ${r.status})`);
      }
      setOk("Unit biaya berhasil ditambahkan.");
      setKode("");
      setNama("");
      setJenis("LAINNYA");
      setAktif(true);
      setTimeout(() => (window.location.href = "/akuntansi/unit-biaya"), 650);
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan unit biaya.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  /* ================= render ================= */
  return (
    <main className="min-h-screen bg-gray-50 subpixel-antialiased">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Tambah Unit Biaya
            </h1>
          </div>
          <Link
            href="/akuntansi/unit-biaya"
            className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
          >
            <ChevronLeft size={16} /> Kembali
          </Link>
        </div>

        {/* Tips */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex gap-3">
          <Info size={18} className="text-blue-600 mt-0.5" />
          <div className="text-sm text-gray-700">
            Gunakan <b>kode unik</b> (3–6 huruf) untuk memudahkan mapping biaya.
            Contoh: <span className="font-mono">PROD</span>,{" "}
            <span className="font-mono">DIST</span>,{" "}
            <span className="font-mono">PEL</span>. Kode akan otomatis diubah ke <b>UPPERCASE</b>.
          </div>
        </div>

        {/* Alerts */}
        {err && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <TriangleAlert className="shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-semibold">Gagal</div>
              <div className="text-sm">{err}</div>
            </div>
          </div>
        )}
        {ok && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-semibold">Berhasil</div>
              <div className="text-sm">{ok}</div>
            </div>
          </div>
        )}

        {/* Grid: Form + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form Card */}
          <form
            onSubmit={onSubmit as any}
            className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-5"
          >
            {/* Kode + Nama */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Kode
                </label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    value={kode}
                    onChange={(e) => setKode(sanitizeCode(e.target.value))}
                    placeholder="Contoh: PROD"
                    className="pl-8 pr-3 py-2 w-full border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Hanya huruf/angka/underscore/dash. Maks 12 karakter.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nama Unit
                </label>
                <input
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Produksi IPA 1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
            </div>

            {/* Jenis (segmented) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Jenis Unit Biaya
              </label>
              <div className="flex flex-wrap gap-2">
                {JENIS_OPTIONS.map((j) => (
                  <button
                    type="button"
                    key={j}
                    onClick={() => onJenisChange(j)}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${
                      jenis === j
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50"
                    }`}
                    title={j}
                  >
                    {j}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${JENIS_BADGE[jenis]}`}
                >
                  <BadgeCheck size={14} /> {jenis}
                </span>
              </div>
            </div>

            {/* Status */}
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              Aktif
            </label>

            {/* Action */}
            <div className="pt-1">
              <button
                id="btn-submit"
                type="submit"
                onClick={onSubmit as any}
                disabled={submitting || !canSubmit}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <Save size={16} />
                {submitting ? "Menyimpan…" : "Simpan"}
              </button>
              <span className="ml-3 text-xs text-gray-500">
                Pintasan: <kbd className="px-1 py-0.5 bg-gray-100 rounded border">Ctrl</kbd> +{" "}
                <kbd className="px-1 py-0.5 bg-gray-100 rounded border">Enter</kbd>
              </span>
            </div>
          </form>

          {/* Preview Card */}
          <aside className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info size={16} className="text-gray-500" />
              <h3 className="font-semibold text-gray-800">Pratinjau Unit</h3>
            </div>

            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Building2 className="text-blue-600" size={20} />
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">KODE</div>
                  <div className="font-bold text-gray-900">{sanitizeCode(kode) || "—"}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase text-gray-500">Nama Unit</div>
                <div className="font-medium text-gray-900">{nama || "—"}</div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-gray-500">Jenis</div>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs ${JENIS_BADGE[jenis]}`}>
                    {jenis}
                  </span>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">Status</div>
                  <span
                    className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs ${
                      aktif ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Preview ini membantu memastikan konsistensi penamaan dan kategori sebelum disimpan.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
