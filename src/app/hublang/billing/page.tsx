"use client";
import React, { useEffect, useMemo, useState } from "react";

/* ================= Icons (inline, tanpa deps) ================ */
const IconCheck = (p: any) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconWarn = (p: any) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
    <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconArrowLeft = (p: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconArrowRight = (p: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconBolt = (p: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ================= Utils ================== */
type ApiOk = { generated: number };
type ApiErr = { error: string };

const ymOk = (v: string) => /^\d{4}-\d{2}$/.test(v);
function fmtMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function labelPeriode(periode: string): string {
  if (!ymOk(periode)) return periode || "-";
  const [y, m] = periode.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

/* ================= Tiny UI primitives ================== */
const L = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-sm text-gray-700">{children}</label>
);
const I: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`border rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${props.className || ""}`}
  />
);

/* ================= Toast ================== */
function Toast({
  type,
  text,
  onClose,
}: {
  type: "success" | "error";
  text: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      role="status"
      className={`shadow-lg rounded-lg px-3 py-2 text-sm flex items-center gap-2 border ${
        type === "success"
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-rose-50 border-rose-200 text-rose-800"
      }`}
    >
      {type === "success" ? <IconCheck /> : <IconWarn />}
      <span>{text}</span>
      <button
        onClick={onClose}
        className="ml-2 text-xs underline decoration-dotted opacity-75 hover:opacity-100"
      >
        Tutup
      </button>
    </div>
  );
}

/* ================= Confirm Modal ================== */
function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Ya, lanjut",
  cancelText = "Batal",
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] grid place-items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <IconBolt className="text-indigo-600" /> {title}
          </h3>
        </div>
        <div className="p-4 text-sm text-gray-700">{message}</div>
        <div className="p-3 flex items-center justify-end gap-2 border-t">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Page ================== */
export default function PageBilling() {
  const [periode, setPeriode] = useState<string>(fmtMonth());
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [ok, setOk] = useState<ApiOk | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const periodeLabel = useMemo(() => labelPeriode(periode), [periode]);

  const shiftMonth = (delta: number) => {
    const [y, m] = ymOk(periode) ? periode.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + delta);
    setPeriode(fmtMonth(d));
  };

  const canSubmit = ymOk(periode) && !loading;

  const handleGenerate = async () => {
    setOk(null);
    setToast(null);
    setConfirmOpen(false);
    setLoading(true);
    try {
      const res = await fetch("/api/hublang/billing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode }),
      });
      const data: ApiOk | ApiErr = await res.json();
      if (!res.ok) throw new Error((data as ApiErr)?.error || "Gagal generate");
      setOk(data as ApiOk);
      setToast({ type: "success", text: `Generated ${(data as ApiOk).generated} tagihan untuk ${periodeLabel}.` });
    } catch (e: any) {
      setToast({ type: "error", text: e.message || "Gagal generate." });
    } finally {
      setLoading(false);
    }
  };

  const tagihanUrl = `/hublang/tagihan?periode=${encodeURIComponent(periode)}`;

  return (
    <div className="p-6 space-y-5 relative text-gray-900">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 grid place-items-center z-30">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}

      {/* Toast stack (top-right) */}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toast && <Toast type={toast.type} text={toast.text} onClose={() => setToast(null)} />}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Generate Tagihan</h1>
        <p className="text-sm text-gray-600">
          Proses ini membuat / memperbarui tagihan dari <b>Bacaan TERVERIFIKASI</b> untuk periode yang dipilih.
        </p>
      </div>

      {/* Card kontrol */}
      <div className="bg-white p-4 rounded-xl shadow border border-gray-200 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <L>Periode</L>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="px-2 py-2 rounded border text-sm hover:bg-gray-50"
                title="Bulan sebelumnya"
              >
                <IconArrowLeft />
              </button>
              <I
                type="month"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className="w-44"
              />
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="px-2 py-2 rounded border text-sm hover:bg-gray-50"
                title="Bulan berikutnya"
              >
                <IconArrowRight />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Saat ini: {periodeLabel}</p>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setPeriode(fmtMonth(new Date()))}
              className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
              title="Set ke bulan ini"
            >
              Bulan ini
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                setPeriode(fmtMonth(d));
              }}
              className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
              title="Set ke bulan lalu"
            >
              Bulan lalu
            </button>
          </div>

        <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit}
            className={`px-4 py-2 rounded-lg text-white ${canSubmit ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-400 cursor-not-allowed"} `}
            title={canSubmit ? "Buat/Update tagihan untuk periode ini" : "Periode tidak valid"}
          >
            Generate Tagihan
          </button>
        </div>

        {/* Hint */}
        <ul className="list-disc pl-6 text-sm text-gray-600">
          <li>Pastikan bacaan meter yang dipakai berstatus <b>TERVERIFIKASI</b>.</li>
          <li>Pembulatan total mengikuti pengaturan di <i>Golongan Tarif</i>/<i>Kebijakan</i>.</li>
          <li>Generate bersifat idempotent untuk kombinasi sambungan + periode (akan update jika sudah ada).</li>
        </ul>
      </div>

      {/* Ringkasan hasil */}
      {ok && (
        <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
          <h2 className="font-semibold mb-2">Ringkasan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg border">
              <div className="text-gray-500">Periode</div>
              <div className="font-medium">{periodeLabel}</div>
            </div>
            <div className="p-3 rounded-lg border">
              <div className="text-gray-500">Tagihan Dibuat/Diperbarui</div>
              <div className="font-medium">{ok.generated}</div>
            </div>
            <a
              href={tagihanUrl}
              className="p-3 rounded-lg border hover:bg-gray-50"
              title="Buka daftar tagihan periode ini"
            >
              <div className="text-gray-500">Lihat Daftar</div>
              <div className="font-medium text-indigo-700 underline">/hublang/tagihan</div>
            </a>
          </div>
        </div>
      )}

      {/* Modal konfirmasi */}
      <ConfirmModal
        open={confirmOpen}
        title="Konfirmasi Generate"
        message={
          <div className="space-y-2">
            <p>
              Generate tagihan untuk periode <b>{periodeLabel}</b>?
            </p>
            <ul className="list-disc pl-5 text-gray-600">
              <li>Tagihan akan dibuat/diperbarui hanya untuk bacaan <b>TERVERIFIKASI</b>.</li>
              <li>Proses ini aman diulangi (idempotent).</li>
            </ul>
          </div>
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleGenerate}
        confirmText="Ya, generate"
        cancelText="Batal"
      />
    </div>
  );
}
