"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AkShell, { glass, pill } from "@/components/AkShell";
import { ArrowLeft, Trash2, FileText, BadgeCheck, Undo2, CheckCircle2 } from "lucide-react";
import useToast from "@/components/Toast";

/* ===== Types (sesuai API) ===== */
type Status = "DRAFT" | "POSTED";
type Sumber = "MANUAL" | string;

type Line = {
  id: number;
  akunId: number;
  uraian: string | null;
  debit: number;
  kredit: number;
};

type Detail = {
  id: number;
  nomor: string;
  tanggal: string; // ISO
  status: Status;
  sumber: Sumber;
  memo: string | null;
  refTable: string | null;
  refId: number | null;
  refNo: string | null;
  periodeId: number | null;
  lines: Line[];
};

type CoaRowLite = { id: number; kode: string; nama: string };

/* ===== Helpers ===== */
const fmtIDR = (n: number) => n.toLocaleString("id-ID");

/* ===== Page ===== */
export default function JurnalDetailPage() {
  const { id } = useParams() as { id: string };
  const { View, push } = useToast();
  const router = useRouter();

  const [data, setData] = React.useState<Detail | null>(null);
  const [akunMap, setAkunMap] = React.useState<Record<number, { kode: string; nama: string }>>({});
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      // detail jurnal
      const d: Detail = await fetch(`/api/akuntansi/jurnal/${id}`).then((r) => r.json());
      if ((d as any).error) throw new Error((d as any).error);
      setData(d);

      // ambil COA (flat) untuk map akunId -> kode/nama
      const coa = await fetch(`/api/akuntansi/coa?page=1&size=1000`).then((r) => r.json());
      const rows: CoaRowLite[] = (coa?.rows || coa || []).map((r: any) => ({
        id: r.id,
        kode: r.kode,
        nama: r.nama,
      }));
      const m: Record<number, { kode: string; nama: string }> = {};
      rows.forEach((r) => (m[r.id] = { kode: r.kode, nama: r.nama }));
      setAkunMap(m);
    } catch (e: any) {
      push(`❌ ${e.message || "Gagal memuat detail"}`, "err");
    } finally {
      setLoading(false);
    }
  }, [id, push]);

  React.useEffect(() => {
    load();
  }, [load]);

  const totalDebit = (data?.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalKredit = (data?.lines || []).reduce((s, l) => s + (Number(l.kredit) || 0), 0);
  const balanced = Math.round((totalDebit - totalKredit) * 100) === 0;

  const doPost = async () => {
    if (!data) return;
    setWorking(true);
    try {
      const r = await fetch(`/api/akuntansi/jurnal/${data.id}/post`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal posting jurnal");
      push(`✅ Diposting: ${data.nomor}`, "ok");
      await load();
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setWorking(false);
    }
  };

  const doUnpost = async () => {
    if (!data) return;
    setWorking(true);
    try {
      const r = await fetch(`/api/akuntansi/jurnal/${data.id}/unpost`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal unpost jurnal");
      push(`↩️ Unposted: ${data.nomor}`, "ok");
      await load();
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setWorking(false);
    }
  };

  const doDelete = async () => {
    if (!data) return;
    if (!confirm(`Hapus jurnal ${data.nomor}? (hanya DRAFT)`)) return;
    setWorking(true);
    try {
      const r = await fetch(`/api/akuntansi/jurnal/${data.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal hapus jurnal");
      push(`🗑️ Dihapus: ${data.nomor}`, "ok");
      router.push("/akuntansi/jurnal");
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setWorking(false);
    }
  };

  return (
    <AkShell title="Detail Jurnal" subtitle="Lihat dan kelola status jurnal" full>
      <View />

      <section className={`${glass} p-4`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link
            href="/akuntansi/jurnal"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {data?.status === "DRAFT" ? (
              <>
                <button
                  onClick={doPost}
                  disabled={working || !balanced}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
                  title={balanced ? "Post ke buku besar" : "Tidak seimbang"}
                >
                  <CheckCircle2 className="h-4 w-4" /> Post
                </button>
                <button
                  onClick={doDelete}
                  disabled={working}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-500/20 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
                  title="Hapus (DRAFT)"
                >
                  <Trash2 className="h-4 w-4" /> Hapus
                </button>
              </>
            ) : (
              <button
                onClick={doUnpost}
                disabled={working}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-500/20 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
                title="Kembalikan ke DRAFT"
              >
                <Undo2 className="h-4 w-4" /> Unpost
              </button>
            )}
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
              title="Export / Cetak (placeholder)"
              onClick={() => push("📄 Export belum dihubungkan.", "info")}
            >
              <FileText className="h-4 w-4" /> Export
            </button>
          </div>
        </div>

        {/* Header Info */}
        <div className="mb-3 grid gap-3 md:grid-cols-12">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-5">
            <div className="text-xs text-slate-300/70">Nomor</div>
            <div className="mt-1 text-lg font-semibold">{data?.nomor || "—"}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`${pill} bg-white/10 ring-white/15`}>{data?.sumber}</span>
              <span
                className={`${pill} ${
                  data?.status === "POSTED"
                    ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/20"
                    : "bg-amber-400/15 text-amber-200 ring-amber-400/20"
                }`}
              >
                {data?.status}
              </span>
              {balanced ? (
                <span className={`${pill} bg-emerald-400/15 text-emerald-200 ring-emerald-400/20`}>
                  Seimbang
                </span>
              ) : (
                <span className={`${pill} bg-rose-400/15 text-rose-200 ring-rose-400/20`}>
                  Tidak seimbang
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-3">
            <div className="text-xs text-slate-300/70">Tanggal</div>
            <div className="mt-1 text-lg font-semibold">
              {data ? new Date(data.tanggal).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-4">
            <div className="text-xs text-slate-300/70">Memo</div>
            <div className="mt-1 text-sm text-slate-100">{data?.memo || "—"}</div>
          </div>
        </div>

        {/* Tabel Lines */}
        <div className="overflow-hidden rounded-xl border border-white/10">
          {loading ? (
            <div className="h-32 animate-pulse bg-white/5" />
          ) : !data ? (
            <div className="p-6 text-sm text-slate-300/80">Tidak ada data.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left">Kode</th>
                  <th className="px-3 py-2 text-left">Nama Akun</th>
                  <th className="px-3 py-2 text-left">Uraian</th>
                  <th className="px-3 py-2 text-right w-40">Debit</th>
                  <th className="px-3 py-2 text-right w-40">Kredit</th>
                </tr>
              </thead>
              <tbody className="text-slate-100">
                {data.lines.map((l) => {
                  const a = akunMap[l.akunId];
                  return (
                    <tr key={l.id} className="border-t border-white/10">
                      <td className="px-3 py-2 font-mono">{a?.kode ?? l.akunId}</td>
                      <td className="px-3 py-2">{a?.nama ?? "—"}</td>
                      <td className="px-3 py-2">{l.uraian || "—"}</td>
                      <td className="px-3 py-2 text-right">{fmtIDR(l.debit)}</td>
                      <td className="px-3 py-2 text-right">{fmtIDR(l.kredit)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-white/[0.03]">
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-300" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtIDR(totalDebit)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtIDR(totalKredit)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>
    </AkShell>
  );
}
