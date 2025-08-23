"use client";

import { useState } from "react";
import { X, Save, FileText, Calendar, BadgeDollarSign } from "lucide-react";

/* ===================== Types ===================== */
type Props = {
  asetId?: number;
  penyusutanId: number;
  defaultTanggal: string;   // YYYY-MM-DD
  defaultNominal: number;
  asetNama?: string;
  // kategori wajib (diberikan dari parent)
  kategoriBebanId: number;
  kategoriAkumulasiId: number;

  onPosted?: () => void | Promise<void>;
  onClose?: () => void;
};

type PostBody = {
  tanggal: string; // YYYY-MM-DD
  nominal: number;
  ref?: string | null;
  asetId?: number | null;
  kategoriBebanId: number;
  kategoriAkumulasiId: number;
};

/* ===================== Dialog ===================== */
export default function PenyusutanPostingDialog({
  asetId,
  penyusutanId,
  defaultTanggal,
  defaultNominal,
  asetNama,
  kategoriBebanId,
  kategoriAkumulasiId,
  onPosted,
  onClose,
}: Props) {
  const [tanggal, setTanggal] = useState<string>(defaultTanggal);
  const [nominal, setNominal] = useState<string>(String(defaultNominal || 0));
  const [ref, setRef] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    const n = Number(nominal);
    if (!tanggal) return setErr("Tanggal wajib diisi.");
    if (!Number.isFinite(n) || n <= 0) return setErr("Nominal harus lebih dari 0.");
    if (!kategoriBebanId || !kategoriAkumulasiId) return setErr("Pilih kategori beban & akumulasi terlebih dulu.");

    try {
      setSubmitting(true);
      const payload: PostBody = {
        tanggal,
        nominal: n,
        ref: ref.trim() ? ref.trim() : null,
        asetId: typeof asetId === "number" ? asetId : undefined,
        kategoriBebanId,
        kategoriAkumulasiId,
      };

      const res = await fetch(`/api/akuntansi/penyusutan/${penyusutanId}/posting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal memposting jurnal.");

      if (onPosted) await onPosted();
    } catch (e: any) {
      setErr(e?.message || "Terjadi kesalahan saat memposting jurnal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="font-semibold">
            Posting Jurnal Penyusutan
            {asetNama ? <span className="text-gray-500"> — {asetNama}</span> : null}
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="space-y-4 px-5 py-4">
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Tanggal Jurnal</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-8 py-2 focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nominal Beban</label>
            <div className="relative">
              <BadgeDollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={nominal}
                onChange={(e) => setNominal(e.target.value.replace(/[^\d]/g, ""))}
                className="w-full rounded-lg border border-gray-300 px-8 py-2 focus:ring-2 focus:ring-blue-400"
                placeholder="0"
                required
              />
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Nilai default diambil dari kolom <b>beban</b> penyusutan periode tersebut.
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Ref / Bukti (opsional)</label>
            <div className="relative">
              <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="No. bukti / referensi"
                className="w-full rounded-lg border border-gray-300 px-8 py-2 focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={16} />
              {submitting ? "Menyimpan…" : "Posting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
