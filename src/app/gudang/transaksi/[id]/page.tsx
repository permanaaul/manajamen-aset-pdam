// app/gudang/transaksi/[id]/page.tsx
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Trash2,
  CalendarDays,
  Tag,
  Copy,
  Printer,
  RefreshCw,
  PackagePlus,
  X,
} from "lucide-react";
import useToast from "@/components/Toast";

/* =========================
 * Types
 * ========================= */
type Line = {
  id: number;
  itemId: number;
  qty: number;
  hargaRp: number | null;
  asetId: number | null;
  pemeliharaanId: number | null;
  catatan: string | null;
  item: { id: number; kode: string; nama: string; satuan: { simbol: string } | null } | null;
};

type Detail = {
  id: number;
  noTransaksi: string;
  tanggal: string;
  jenis: "IN" | "OUT" | "ADJ";
  referensi: string | null;
  keterangan: string | null;
  lines: Line[];
};

type GudangOpt = { id: number; kode: string; nama: string };

/* =========================
 * Utils
 * ========================= */
const fmtDate = (s: string) =>
  new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

const fmtRp = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    : "—";

const badgeClass = (jenis: Detail["jenis"]) =>
  jenis === "IN"
    ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
    : jenis === "OUT"
    ? "bg-rose-100 text-rose-800 ring-rose-200"
    : "bg-amber-100 text-amber-800 ring-amber-200";

/* =========================
 * Component
 * ========================= */
export default function TransaksiDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { push, View } = useToast();

  const [data, setData] = React.useState<Detail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Selection for "Jadikan Aset"
  const [selected, setSelected] = React.useState<number[]>([]);
  const allSelected = React.useMemo(
    () => !!data?.lines.length && selected.length === data?.lines.length,
    [data?.lines, selected.length]
  );

  // Modal state (tanpa gudangId; pakai state terpisah di bawah)
  const [assetModal, setAssetModal] = React.useState<{
    open: boolean;
    buatIssue: boolean;
    saving: boolean;
  }>({ open: false, buatIssue: false, saving: false });

  // Gudang dropdown
  const [gudangOptions, setGudangOptions] = React.useState<GudangOpt[]>([]);
  const [gudangId, setGudangId] = React.useState<number | "">("");

  // muat gudang saat modal buka & opsi ISSUE aktif
  React.useEffect(() => {
    if (!assetModal.open || !assetModal.buatIssue) return;
    (async () => {
      try {
        const res = await fetch("/api/gudang/lookup?type=gudang");
        const d = await res.json();
        const rows: GudangOpt[] = Array.isArray(d?.rows) ? d.rows : [];
        setGudangOptions(rows);
        if (rows.length && gudangId === "") setGudangId(rows[0].id);
      } catch {
        setGudangOptions([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetModal.open, assetModal.buatIssue]);

  const total = React.useMemo(() => {
    const qty = data?.lines?.reduce((s, l) => s + (Number(l.qty) || 0), 0) ?? 0;
    const nilai =
      data?.lines?.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.hargaRp) || 0), 0) ?? 0;
    return { qty, nilai };
  }, [data]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gudang/transaksi/${id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal memuat data transaksi.");
      setData(d);
      setSelected([]); // reset selection setiap reload
    } catch (e: any) {
      const msg = String(e?.message || "Gagal memuat data transaksi.");
      setError(msg);
      push(`❌ ${msg}`, "err");
    } finally {
      setLoading(false);
    }
  }, [id, push]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      push("📋 Disalin ke clipboard", "ok");
    } catch {
      push("❌ Gagal menyalin", "err");
    }
  };

  const del = async () => {
    if (!data) return;
    const ok = confirm(`Hapus transaksi ${data.noTransaksi}?`);
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/gudang/transaksi/${id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Gagal menghapus transaksi.");
      push("✅ Transaksi terhapus", "ok");
      router.push("/gudang/transaksi");
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setDeleting(false);
    }
  };

  const toggleOne = (lineId: number) => {
    setSelected((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]
    );
  };
  const toggleAll = () => {
    if (!data?.lines?.length) return;
    setSelected((prev) => (prev.length === data.lines.length ? [] : data.lines.map((l) => l.id)));
  };

  const openAssetModal = () => {
    if (selected.length === 0) {
      push("Pilih minimal satu baris untuk dijadikan aset.", "err");
      return;
    }
    setAssetModal((s) => ({ ...s, open: true }));
  };

  const submitAsset = async () => {
    if (selected.length === 0) return;
    if (assetModal.buatIssue && !(typeof gudangId === "number" && gudangId > 0)) {
      push("Pilih gudang terlebih dahulu.", "err");
      return;
    }
    setAssetModal((s) => ({ ...s, saving: true }));
    try {
      const payload: any = {
        lineIds: selected,
        buatIssue: assetModal.buatIssue,
      };
      if (assetModal.buatIssue) payload.gudangId = gudangId;

      const res = await fetch("/api/aset/from-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dataRes = await res.json();
      if (!res.ok) throw new Error(dataRes?.error || "Gagal membuat aset dari baris transaksi.");

      const createdCount = Array.isArray(dataRes?.created) ? dataRes.created.length : 0;
      push(`✅ ${createdCount} aset berhasil dibuat`, "ok");
      setAssetModal({ open: false, buatIssue: false, saving: false });
      setGudangId("");
      setSelected([]);
      await load(); // refresh relasi asetId
    } catch (e: any) {
      push(`❌ ${String(e?.message || "Gagal membuat aset")}`, "err");
      setAssetModal((s) => ({ ...s, saving: false }));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <View />

      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Detail Transaksi
          </h1>
          {data && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${badgeClass(
                  data.jenis
                )}`}
                title="Jenis Transaksi"
              >
                {data.jenis}
              </span>
              <span className="inline-flex items-center gap-1 text-gray-700">
                <Tag className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{data.noTransaksi}</span>
                <button
                  onClick={() => onCopy(data.noTransaksi)}
                  className="ml-1 rounded hover:bg-gray-100 p-1 text-gray-500"
                  title="Salin No Transaksi"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Jadikan Aset */}
          <button
            onClick={openAssetModal}
            disabled={!selected.length}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
            title={selected.length ? `Jadikan Aset (${selected.length})` : "Pilih baris dulu"}
          >
            <PackagePlus className="w-4 h-4" />
            Jadikan Aset
            {selected.length > 0 ? (
              <span className="ml-1 rounded bg-white/20 px-1.5 text-xs">{selected.length}</span>
            ) : null}
          </button>

          <button
            onClick={() => router.push("/gudang/transaksi")}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Cetak
          </button>

          <button
            onClick={del}
            disabled={deleting}
            className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Hapus
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <SkeletonCard />
          <SkeletonCard className="xl:col-span-2" />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-full bg-rose-100 p-2">
              <RefreshCw className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Gagal memuat data</div>
              <div className="text-gray-600 text-sm">{error}</div>
              <button
                onClick={load}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Coba lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {data && !loading && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Summary pills */}
          <div className="xl:col-span-3 bg-white rounded-xl border shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${badgeClass(data.jenis)}`}>
                {data.jenis}
              </span>

              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ring-1 ring-gray-200">
                No: <span className="font-semibold">{data.noTransaksi}</span>
              </span>

              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ring-1 ring-gray-200 inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                {fmtDate(data.tanggal)}
              </span>

              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ring-1 ring-gray-200">
                Ref: <span className="font-semibold">{data.referensi || "-"}</span>
              </span>

              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ring-1 ring-gray-200">
                Total Qty: <span className="font-semibold">{total.qty}</span>
              </span>

              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ring-1 ring-gray-200">
                Estimasi Nilai:{" "}
                <span className="font-semibold">
                  {total.nilai.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}
                </span>
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="xl:col-span-1 bg-white rounded-xl border shadow-sm">
            <div className="px-4 py-3 border-b font-semibold text-gray-900">Informasi</div>
            <div className="p-4 text-sm space-y-3">
              <InfoRow label="No" value={data.noTransaksi} onCopy={() => onCopy(data.noTransaksi)} />
              <InfoRow label="Tanggal" value={fmtDate(data.tanggal)} />
              <InfoRow label="Jenis" value={data.jenis} />
              <InfoRow label="Referensi" value={data.referensi || "-"} onCopy={data.referensi ? () => onCopy(data.referensi!) : undefined} />
              <InfoRow label="Keterangan" value={data.keterangan || "-"} />
            </div>
          </div>

          {/* Lines */}
          <div className="xl:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold text-gray-900 flex items-center justify-between">
              <span>Detail Item</span>
              <div className="text-xs text-gray-700">
                {selected.length > 0 ? (
                  <>Dipilih: <b>{selected.length}</b></>
                ) : (
                  <>Tidak ada baris dipilih</>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700 border-b">
                  <tr>
                    <Th className="w-10 text-center">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </Th>
                    <Th className="text-left">Item</Th>
                    <Th className="text-right w-20">Qty</Th>
                    <Th className="text-right w-36">Harga (Rp)</Th>
                    <Th className="text-left">Catatan</Th>
                    <Th className="text-left w-44">Relasi</Th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
                  {data.lines.map((l: Line) => {
                    const checked = selected.includes(l.id);
                    return (
                      <tr key={l.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 text-center align-top">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(l.id)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            aria-label={`Pilih baris ${l.id}`}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium">
                            {l.item?.kode} — {l.item?.nama}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {l.itemId}
                            {l.item?.satuan?.simbol ? <> • {l.item.satuan.simbol}</> : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right align-top">{l.qty}</td>
                        <td className="px-3 py-2 text-right align-top">{fmtRp(l.hargaRp)}</td>
                        <td className="px-3 py-2 align-top">{l.catatan || "—"}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            {l.asetId ? (
                              <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 px-2 py-0.5 text-xs font-medium">
                                Aset: {l.asetId}
                              </span>
                            ) : null}
                            {l.pemeliharaanId ? (
                              <span className="inline-flex items-center rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-200 px-2 py-0.5 text-xs font-medium">
                                Pem: {l.pemeliharaanId}
                              </span>
                            ) : null}
                            {!l.asetId && !l.pemeliharaanId ? "—" : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {data.lines.length === 0 && (
                    <tr>
                      <td className="px-3 py-10 text-center text-gray-500" colSpan={6}>
                        Tidak ada item pada transaksi ini.
                      </td>
                    </tr>
                  )}
                </tbody>

                {data.lines.length > 0 && (
                  <tfoot className="bg-gray-50 text-gray-900 border-t">
                    <tr>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 font-semibold text-right">Total</td>
                      <td className="px-3 py-2 font-semibold text-right">{total.qty}</td>
                      <td className="px-3 py-2 font-semibold text-right">
                        {total.nilai.toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-3 py-2" colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Jadikan Aset */}
      {assetModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-[560px] max-w-[95vw] border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-lg font-bold">Jadikan Aset</div>
              <button
                onClick={() => setAssetModal((s) => ({ ...s, open: false }))}
                className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center justify-center"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 text-sm space-y-4">
              <div className="text-gray-800">
                {selected.length} baris dipilih. Aksi ini akan membuat <b>1 aset per baris</b>.
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="buatIssue"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={assetModal.buatIssue}
                  onChange={(e) => setAssetModal((s) => ({ ...s, buatIssue: e.target.checked }))}
                />
                <label htmlFor="buatIssue" className="text-gray-900">
                  Kurangi stok saat membuat aset (buat dokumen <b>ISSUE</b>)
                </label>
              </div>

              {assetModal.buatIssue && (
                <div>
                  <label className="block text-gray-800 mb-1 font-medium">Gudang</label>
                  <select
                    value={gudangId}
                    onChange={(e) => setGudangId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full h-11 border border-gray-300 rounded-lg px-3 bg-white text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {gudangOptions.length === 0 && <option value="">(Tidak ada gudang)</option>}
                    {gudangOptions.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.kode} — {g.nama} (id: {g.id})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-gray-600">
                    Stok akan dikurangi dari gudang di atas (qty 1 per aset).
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setAssetModal((s) => ({ ...s, open: false }))}
                className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={submitAsset}
                disabled={assetModal.saving}
                className="inline-flex items-center gap-2 h-10 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {assetModal.saving ? "Memproses…" : "Jadikan Aset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          nav, aside, header, footer, .no-print { display: none !important; }
          body { background: #fff !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}

/* =========================
 * Small UI helpers
 * ========================= */
function InfoRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: React.ReactNode;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-gray-600 w-28 shrink-0">{label}</div>
      <div className="flex items-center gap-2 font-medium text-gray-900">
        <span>{value}</span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="rounded hover:bg-gray-100 p-1 text-gray-500"
            title={`Salin ${label}`}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 font-semibold text-xs uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${className}`}>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-3 bg-gray-200 rounded w-48" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
      </div>
    </div>
  );
}
