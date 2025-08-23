"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  LoaderCircle,
  AlertTriangle,
  Copy,
  Check,
  CheckCircle2,
} from "lucide-react";

/* ===== helpers ===== */
const toIDR = (n: number = 0) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const fmtID = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID") : "—";

const fmtIDDT = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/* ===== types (harus cocok dengan API /api/akuntansi/voucher/[id]) ===== */
type VLine = {
  id: number;
  akunId: number;
  akun?: { id?: number; kode: string; nama: string } | null;
  unitBiaya?: { id: number; nama: string } | null;
  aset?: { id: number; nia?: string | null; nama: string } | null;
  debit: number;
  kredit: number;
};
type VHeader = {
  id: number;
  tanggal: string;
  voucherNo?: string | null;
  voucherDate?: string | null;
  ref?: string | null;
  uraian?: string | null;
  sumber?: string | null;
  createdAt?: string | null;
  createdBy?: { id: number; nama: string } | null;
  postedAt?: string | null;
  postedBy?: { id: number; nama: string } | null;
  totals: { debit: number; kredit: number; balanced: boolean };
  lines: VLine[];
};

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VHeader | null>(null);
  const [err, setErr] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/akuntansi/voucher/${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as VHeader;
      setData(j);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat voucher.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totalDebit = useMemo(() => data?.totals.debit ?? 0, [data]);
  const totalKredit = useMemo(() => data?.totals.kredit ?? 0, [data]);
  const balanced = !!data?.totals.balanced;
  const isPosted = !!data?.postedAt;

  const copyNo = async () => {
    if (!data?.voucherNo) return;
    try {
      await navigator.clipboard.writeText(data.voucherNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  if (loading)
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center gap-2 text-gray-700">
            <LoaderCircle className="animate-spin" size={18} />
            Memuat voucher…
          </div>
        </div>
      </main>
    );

  if (err || !data)
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto p-6 space-y-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-4">
            {err || "Voucher tidak ditemukan."}
          </div>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6 print:max-w-[820px] print:p-0">

        {/* Actions bar (non-print) */}
        <div className="flex items-center justify-between print:hidden">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={copyNo}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
              title="Salin nomor voucher"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Disalin" : "Salin No."}
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              <Printer size={16} /> Cetak
            </button>
          </div>
        </div>

        {/* Dokumen */}
        <section className="relative bg-white border border-gray-200 rounded-2xl shadow-sm print:shadow-none print:border-0">
          {/* Watermark draft */}
          {!isPosted && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10 print:opacity-20">
              <div className="text-8xl font-extrabold tracking-widest -rotate-12">D R A F T</div>
            </div>
          )}

          <div className="relative p-8 print:p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-500 leading-5">BUKTI JURNAL (VOUCHER)</div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  {data.voucherNo || "—"}
                </h1>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={
                    "text-xs px-2 py-1 rounded-md border " +
                    (balanced
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200")
                  }
                >
                  {balanced ? "Seimbang" : "Tidak Seimbang"}
                </span>
                <span
                  className={
                    "text-xs px-2 py-1 rounded-md border " +
                    (isPosted
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-gray-50 text-gray-600 border-gray-200")
                  }
                >
                  {isPosted ? "Posted" : "Draft"}
                </span>
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6 text-sm">
              <div>
                <div className="text-gray-500">Tanggal Jurnal</div>
                <div className="font-semibold text-gray-900">{fmtID(data.tanggal)}</div>
              </div>
              <div>
                <div className="text-gray-500">Tanggal Voucher</div>
                <div className="font-semibold text-gray-900">{fmtID(data.voucherDate)}</div>
              </div>
              <div>
                <div className="text-gray-500">Ref</div>
                <div className="font-semibold text-gray-900">{data.ref || "—"}</div>
              </div>
              <div className="sm:col-span-4">
                <div className="text-gray-500">Uraian</div>
                <div className="font-semibold text-gray-900">{data.uraian || "—"}</div>
              </div>
            </div>

            {/* Tabel Lines */}
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm border-separate [border-spacing:0]">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-3 py-2 text-left w-[130px]">Kode</th>
                    <th className="px-3 py-2 text-left">Akun</th>
                    <th className="px-3 py-2 text-left w-[220px]">Unit / Aset</th>
                    <th className="px-3 py-2 text-right w-[160px]">Debit</th>
                    <th className="px-3 py-2 text-right w-[160px]">Kredit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-900">
                  {data.lines.length ? (
                    data.lines.map((l) => {
                      const hasUnit = !!l.unitBiaya?.nama;
                      const hasAset = !!l.aset?.nama;
                      return (
                        <tr key={l.id} className="odd:bg-slate-50">
                          <td className="px-3 py-2 font-mono">{l.akun?.kode ?? `#${l.akunId}`}</td>
                          <td className="px-3 py-2">{l.akun?.nama ?? "—"}</td>
                          <td className="px-3 py-2">
                            {hasUnit && <div className="font-medium">{l.unitBiaya!.nama}</div>}
                            {hasAset && (
                              <div className="text-xs text-gray-500">
                                {l.aset!.nama}
                                {l.aset?.nia ? ` — ${l.aset.nia}` : ""}
                              </div>
                            )}
                            {!hasUnit && !hasAset && <span className="text-gray-500">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{toIDR(l.debit)}</td>
                          <td className="px-3 py-2 text-right font-mono">{toIDR(l.kredit)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-600">
                        Tidak ada baris.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>
                      Total
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900">
                      {toIDR(totalDebit)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900">
                      {toIDR(totalKredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Status note */}
            {!balanced && (
              <div className="mt-3 inline-flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
                <AlertTriangle size={14} />
                Jurnal tidak seimbang. Periksa baris di atas.
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-8 mt-12 text-sm print:mt-16">
              <div className="text-center">
                <div className="h-20" />
                <div className="border-t border-gray-400 pt-1 font-semibold text-gray-900 min-h-[24px]">
                  {data.createdBy?.nama || "\u00A0"}
                </div>
                <div className="text-gray-500">Dibuat</div>
                <div className="text-xs text-gray-400">{fmtIDDT(data.createdAt)}</div>
              </div>

              <div className="text-center">
                <div className="h-20" />
                <div className="border-t border-gray-300 pt-1 font-semibold text-gray-900 min-h-[24px]">
                  {"\u00A0"}
                </div>
                <div className="text-gray-500">Diperiksa</div>
                <div className="text-xs text-gray-400">&nbsp;</div>
              </div>

              <div className="text-center">
                <div className="h-20" />
                <div className="border-t border-gray-400 pt-1 font-semibold text-gray-900 min-h-[24px]">
                  {data.postedBy?.nama || "\u00A0"}
                </div>
                <div className="text-gray-500">Disetujui</div>
                <div className="text-xs text-gray-400">{fmtIDDT(data.postedAt)}</div>
              </div>
            </div>
          </div>
        </section>

        {/* footer kecil (non-print) */}
        <div className="print:hidden text-xs text-gray-500">
          {balanced ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={14} className="text-emerald-600" />
              Voucher seimbang.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <AlertTriangle size={14} className="text-amber-600" />
              Voucher belum seimbang.
            </span>
          )}
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          nav, aside, header, footer, .print\\:hidden { display: none !important; }
          .print\\:max-w-[820px] { max-width: 820px !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>
    </main>
  );
}
