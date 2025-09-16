// app/kas-bank/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AkShell, { glass } from "@/components/AkShell";
import { ArrowLeft, Banknote, CreditCard, Wallet, Loader2, CheckCircle2, X } from "lucide-react";
import useToast from "@/components/Toast";

type KBType = "IN" | "OUT" | "TRF";
type StatusDok = "DRAFT" | "POSTED" | "CANCELED";
type Brief = { id: number; kode: string; nama: string };

type Row = {
  id: number;
  nomor: string;
  tanggal: string;
  tipe: KBType;
  status: StatusDok;
  akun: Brief | null;
  asal: Brief | null;
  tujuan: Brief | null;
  lawanAkun: Brief | null;
  amount: number;
  biaya: number | null;
  memo: string | null;
  referensi: string | null;
  jurnalId: number | null;
  jurnal?: { id: number; nomor: string } | null;
};

const idr = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("id-ID");

export default function KBDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = React.useState<Row | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [posting, setPosting] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // 🔔 toast helper (sesuaikan dengan API hook kamu)
  const toast = useToast() as any;
  const showSuccess = (title: string, description?: string) => {
    // kalau hook kamu pakai toast.success
    if (typeof toast?.success === "function") return toast.success(title, { description });
    // kalau hook kamu pakai toast({ title, description, variant })
    if (typeof toast === "function") return toast({ title, description, variant: "success" });
    // fallback noop
  };
  const showError = (title: string, description?: string) => {
    if (typeof toast?.error === "function") return toast.error(title, { description });
    if (typeof toast === "function") return toast({ title, description, variant: "error" });
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr("");
    const r = await fetch(`/api/kasbank/transaksi/${id}`);
    const j = await r.json();
    if (!r.ok) setErr(j?.error || "Gagal memuat data");
    else setRow(j.row as Row);
    setLoading(false);
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function doPostToGL() {
    if (!row) return;
    try {
      setPosting(true);
      const r = await fetch(`/api/kasbank/transaksi/${row.id}/post`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal posting");
      await load();
      showSuccess("Berhasil POST", j?.jurnal?.nomor ? `Jurnal #${j.jurnal.nomor}` : undefined);
    } catch (e: any) {
      showError("Gagal POST", e?.message || "Terjadi kesalahan.");
    } finally {
      setPosting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <AkShell title="Detail Transaksi" subtitle="Kas & Bank">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/kas-bank"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div className="flex items-center gap-2">
          {row?.status === "DRAFT" && (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={posting}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Post ke GL
            </button>
          )}
        </div>
      </div>

      <section className={`${glass} p-4`}>
        {loading ? (
          <div className="grid h-28 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : err ? (
          <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100">
            {err}
          </div>
        ) : !row ? (
          <div className="text-slate-300/80">Data tidak ditemukan.</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm text-slate-400">Nomor</div>
                <div className="text-lg font-semibold text-slate-100">{row.nomor}</div>
              </div>
              <div className="flex items-center gap-2">
                {row.tipe === "IN" && (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                    <Wallet className="h-4 w-4" /> IN
                  </span>
                )}
                {row.tipe === "OUT" && (
                  <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-rose-200">
                    <CreditCard className="h-4 w-4" /> OUT
                  </span>
                )}
                {row.tipe === "TRF" && (
                  <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2 py-0.5 text-sky-200">
                    <Banknote className="h-4 w-4" /> TRF
                  </span>
                )}

                {row.status === "DRAFT" && (
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-200">DRAFT</span>
                )}
                {row.status === "POSTED" && (
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200">POSTED</span>
                )}
                {row.status === "CANCELED" && (
                  <span className="rounded bg-rose-500/15 px-2 py-0.5 text-rose-200">CANCELED</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Info label="Tanggal" value={new Date(row.tanggal).toLocaleDateString("id-ID", { dateStyle: "medium" })} />
              <Info label="Amount" value={`Rp ${idr(row.amount)}`} />
              <Info label="Biaya" value={row.biaya != null ? `Rp ${idr(row.biaya)}` : "—"} />
              <Info label="Referensi" value={row.referensi || "—"} />
              <Info label="Memo" value={row.memo || "—"} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {row.tipe !== "TRF" ? (
                <>
                  <Info label="Akun Kas/Bank" value={row.akun ? `${row.akun.kode} — ${row.akun.nama}` : "—"} />
                  <Info label="Lawan Akun (CoA)" value={row.lawanAkun ? `${row.lawanAkun.kode} — ${row.lawanAkun.nama}` : "—"} />
                </>
              ) : (
                <>
                  <Info label="Asal" value={row.asal ? `${row.asal.kode} — ${row.asal.nama}` : "—"} />
                  <Info label="Tujuan" value={row.tujuan ? `${row.tujuan.kode} — ${row.tujuan.nama}` : "—"} />
                </>
              )}
            </div>

            {row.status === "POSTED" && (
              <div className="mt-6 rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                Terposting ke GL {row.jurnal?.nomor ? `— Jurnal #${row.jurnal.nomor}` : ""}.
              </div>
            )}
          </>
        )}
      </section>

      {/* Modal konfirmasi */}
      <ConfirmDialog
        open={confirmOpen}
        title="Post transaksi ke GL?"
        description="Tindakan ini akan membuat entri jurnal di buku besar. Pastikan data sudah benar."
        confirmText={posting ? "Memposting..." : "Ya, Post Sekarang"}
        onClose={() => !posting && setConfirmOpen(false)}
        onConfirm={doPostToGL}
        loading={posting}
      />
    </AkShell>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-slate-100">{value}</div>
    </div>
  );
}

// ===== ConfirmDialog (tanpa lib, hanya Tailwind) =====
function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  onConfirm,
  onClose,
  loading = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center px-4">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl">
          <div className="mb-2 flex items-start justify-between gap-4">
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-slate-300 hover:bg-white/10 disabled:opacity-50"
              disabled={loading}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {description && <p className="mb-4 text-sm text-slate-300">{description}</p>}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
