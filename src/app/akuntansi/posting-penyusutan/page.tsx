// app/akuntansi/posting-penyusutan/page.tsx
"use client";

import React from "react";
import AkShell, { glass } from "@/components/AkShell";
import { Play, RefreshCcw, Download, CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

/* ===== helpers ===== */
const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const fmtIDR = (v: number) => (Number.isFinite(v) ? v.toLocaleString("id-ID") : "0");

type AkunBrief = { id: number; kode: string; nama: string };
type Pair = {
  debitId: number;
  kreditId: number;
  amount?: number; // API baru
  beban?: number;  // kompat lama
  debitAkun?: AkunBrief;
  kreditAkun?: AkunBrief;
};

type PreviewResp = {
  periode: { tahun: number; bulan: number; mulai: string; akhir: string; key: string };
  alreadyPosted: { id: number; nomor: string } | null;
  total: number;
  pairs: Pair[];
};

/* ====== tiny toast (self-contained) ====== */
type ToastKind = "success" | "warn" | "error" | "info";
type Toast = { id: string; kind: ToastKind; msg: string };

function useToasts() {
  const [items, setItems] = React.useState<Toast[]>([]);
  const remove = (id: string) => setItems((s) => s.filter((t) => t.id !== id));
  const push = (kind: ToastKind, msg: string, ms = 3200) => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((s) => [...s, { id, kind, msg }]);
    window.setTimeout(() => remove(id), ms);
  };
  return { items, push, remove };
}

function ToastView({ t, onClose }: { t: Toast; onClose: (id: string) => void }) {
  const palette: Record<ToastKind, string> = {
    success: "border-emerald-300/30 bg-emerald-500/15 text-emerald-100",
    warn: "border-amber-300/30 bg-amber-500/15 text-amber-100",
    error: "border-rose-300/30 bg-rose-500/15 text-rose-100",
    info: "border-sky-300/30 bg-sky-500/15 text-sky-100",
  };
  const Icon =
    t.kind === "success" ? CheckCircle : t.kind === "warn" ? AlertTriangle : t.kind === "error" ? XCircle : Info;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 shadow-lg ${palette[t.kind]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-sm leading-snug">{t.msg}</div>
      <button onClick={() => onClose(t.id)} className="ml-2 rounded p-1 hover:bg-white/10">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
/* ====== /toast ====== */

export default function PagePostingPenyusutan() {
  const [periode, setPeriode] = React.useState<string>(monthKey());
  const [loading, setLoading] = React.useState<boolean>(true);
  const [posting, setPosting] = React.useState<boolean>(false);
  const [data, setData] = React.useState<PreviewResp | null>(null);
  const [error, setError] = React.useState<string>("");

  const { items: toasts, push, remove } = useToasts();
  const reqRef = React.useRef<AbortController | null>(null);

  // load dengan opsi silent agar tidak flicker ketika sudah ada data
  const load = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      // batalkan request sebelumnya (hindari balapan & glitch)
      if (reqRef.current) reqRef.current.abort();
      const ac = new AbortController();
      reqRef.current = ac;

      const silent = !!opts?.silent;
      if (!silent) setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/akuntansi/penyusutan?periode=${encodeURIComponent(periode)}`, {
          signal: ac.signal,
          // cache: "no-store" // boleh aktifkan kalau perlu
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Gagal memuat data");
        setData(j as PreviewResp);
      } catch (e) {
        if ((e as any)?.name === "AbortError") return; // diabaikan
        const msg = (e as Error).message;
        setError(msg);
        setData((prev) => prev); // jangan kosongkan data biar tidak berkedip
        push("error", `Gagal memuat: ${msg}`);
      } finally {
        if (reqRef.current === ac) {
          reqRef.current = null;
          setLoading(false);
        }
      }
    },
    [periode, push]
  );

  // initial + ketika ganti periode: silent jika sudah ada data
  React.useEffect(() => {
    load({ silent: !!data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode]);

  const doPost = async () => {
    if (!data) return;
    if (data.alreadyPosted) {
      push("info", `Periode sudah terposting: ${data.alreadyPosted.nomor}`);
      return;
    }
    const hasRows = (data.pairs ?? []).some((p) => ((p?.beban ?? p?.amount) ?? 0) > 0);
    if (!hasRows) {
      push("warn", "Tidak ada beban penyusutan pada periode ini.");
      return;
    }

    setPosting(true);
    try {
      const res = await fetch(`/api/akuntansi/penyusutan?periode=${encodeURIComponent(periode)}`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Gagal mem-posting");
      push("success", `Berhasil posting jurnal: ${j?.journal?.nomor || "(tanpa nomor)"}`);
      // refresh tanpa flicker
      load({ silent: true });
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const pairs = data?.pairs ?? [];
  const total = data?.total ?? 0;

  return (
    <AkShell title="Posting Penyusutan" subtitle="Generate & post jurnal penyusutan aset (akan dibukukan)" full>
      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastView t={t} onClose={remove} />
          </div>
        ))}
      </div>

      <section className={`${glass} p-4`}>
        {/* toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="h-10 rounded-md border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"
          />

          <button
            onClick={() => load({ silent: !!data })}
            disabled={loading && !data}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
            title="Muat ulang"
          >
            <RefreshCcw className={`h-4 w-4 ${loading && data ? "animate-spin" : ""}`} />
            Muat Ulang
          </button>

          {/* indikator non-blocking saat refresh (tanpa skeleton) */}
          {loading && data && (
            <span className="ml-1 flex items-center gap-1 text-xs text-slate-300/80">
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
              Memperbarui…
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={doPost}
              disabled={posting || (loading && !data)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
              title="Generate & Post"
            >
              <Play className="h-4 w-4" />
              {posting ? "Mem-posting…" : "Generate & Post"}
            </button>

            <button
              onClick={() => push("info", "Export CSV belum diimplementasi.")}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
              title="Export CSV"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* status & konten */}
        {/* skeleton hanya saat load pertama (data belum ada) */}
        {!data && loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-white/5" />
        ) : error && !data ? (
          <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100">
            Gagal memuat data. {error}
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-md border border-white/10 bg-white/10 px-2 py-1">
                Periode: <b>{data?.periode?.key}</b>
              </span>
              {data?.alreadyPosted ? (
                <span className="rounded-md border border-emerald-300/20 bg-emerald-500/20 px-2 py-1 text-emerald-100">
                  Sudah terposting: <b>{data.alreadyPosted.nomor}</b>
                </span>
              ) : (
                <span className="rounded-md border border-amber-300/20 bg-amber-500/20 px-2 py-1 text-amber-100">
                  Belum terposting
                </span>
              )}
              <span className="rounded-md border border-white/10 bg-white/10 px-2 py-1">
                Total Beban: <b>Rp {fmtIDR(total)}</b>
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04] text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">Debit (Beban)</th>
                    <th className="px-3 py-2 text-left">Kredit (Akumulasi)</th>
                    <th className="px-3 py-2 text-right w-48">Beban</th>
                  </tr>
                </thead>
                <tbody className="text-slate-100">
                  {(data?.pairs ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-slate-300/80">
                        Tidak ada beban penyusutan pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    (data?.pairs ?? []).map((p, i) => {
                      const beban = (p?.beban ?? p?.amount ?? 0) as number;
                      const d = p?.debitAkun;
                      const k = p?.kreditAkun;
                      return (
                        <tr key={`${p?.debitId}-${p?.kreditId}-${i}`} className="border-t border-white/10">
                          <td className="px-3 py-2">
                            <div className="font-mono text-xs">{d?.kode || "???"}</div>
                            <div className="text-slate-300">{d?.nama || "-"}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-mono text-xs">{k?.kode || "???"}</div>
                            <div className="text-slate-300">{k?.nama || "-"}</div>
                          </td>
                          <td className="px-3 py-2 text-right">Rp {fmtIDR(beban)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {(data?.pairs ?? []).length > 0 && (
                  <tfoot className="bg-white/[0.03]">
                    <tr>
                      <td className="px-3 py-2 font-medium">Total</td>
                      <td />
                      <td className="px-3 py-2 text-right font-semibold">Rp {fmtIDR(total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </section>
    </AkShell>
  );
}
