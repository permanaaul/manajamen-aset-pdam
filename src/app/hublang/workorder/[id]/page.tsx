// app/hublang/workorder/[id]/page.tsx
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import useToast from "../../../../components/Toast";
import {
  ArrowLeft,
  BadgeInfo,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  Hash,
  MapPin,
  Receipt,
  Workflow,
  X,
} from "lucide-react";

/* ---------- Helpers ---------- */
const fmtDate = (v?: string | null, withTime = false) =>
  v
    ? new Date(v).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: withTime ? "short" : undefined,
      })
    : "-";

const fmtRp = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      })
    : "Rp 0";

const labelize = (s?: string | null) =>
  (s || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const Chip = ({
  tone = "gray",
  children,
}: {
  tone?: "gray" | "blue" | "green" | "red" | "amber";
  children: React.ReactNode;
}) => {
  const m: Record<string, string> = {
    gray: "bg-gray-100 text-gray-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${m[tone]}`}
    >
      {children}
    </span>
  );
};

type Detail = {
  id: number;
  noWo: string;
  tanggalBuat: string | null;
  status: "DRAFT" | "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELED";
  prioritas: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  tipe: string | null; // Prisma enum (JenisPekerjaanPemeliharaan) as string
  jenis: string | null;
  deskripsi: string | null;
  targetTanggal: string | null;
  selesaiTanggal: string | null;
  biayaMaterialRp: number | null;
  biayaJasaRp: number | null;
  pelanggan?: { id: number; kode: string; nama: string } | null;
  sambungan?: { id: number; noSambungan: string } | null;
};

const toneByStatus = (s: Detail["status"]) =>
  s === "OPEN" ? "blue" : s === "IN_PROGRESS" ? "amber" : s === "DONE" ? "green" : s === "CANCELED" ? "red" : "gray";

/* Reusable row (for left column) */
const Row = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
    <div className="mt-0.5 shrink-0">{icon}</div>
    <div className="min-w-32 text-gray-600 font-medium">{label}</div>
    <div className="font-semibold text-gray-900">{value ?? "-"}</div>
  </div>
);

/* Safe fetch that won't explode on empty/500 bodies */
async function safeFetchJSON(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { res, data };
}

/* ---------- Modal confirm ---------- */
function ConfirmDialog({
  open,
  title = "Konfirmasi",
  message = "Lanjutkan tindakan ini?",
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm(): void;
  onClose(): void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 text-gray-500"
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-4 text-gray-800">{message}</div>
          <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border hover:bg-gray-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { push, View } = useToast();

  const [data, setData] = React.useState<Detail | null>(null);
  const [sambNo, setSambNo] = React.useState<string>("-"); // No Sambungan final yang ditampilkan
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [openConfirm, setOpenConfirm] = React.useState(false);

  /* Load detail WO */
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { res, data } = await safeFetchJSON(`/api/hublang/workorder/${id}`);
      if (!res.ok) throw new Error(data?.error || `Gagal memuat (HTTP ${res.status})`);
      setData(data);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setLoading(false);
    }
  }, [id, push]);

  React.useEffect(() => {
    load();
  }, [load]);

  /* Resolve No Sambungan:
     1) kalau sudah ada di payload WO -> pakai
     2) kalau tidak ada & ada pelanggan.id -> hit ke /api/hublang/pelanggan-sambungan?pelangganId=...
  */
  React.useEffect(() => {
    (async () => {
      if (!data) return;

      if (data.sambungan?.noSambungan) {
        setSambNo(data.sambungan.noSambungan);
        return;
      }

      const pid = data.pelanggan?.id;
      if (!pid) {
        setSambNo("-");
        return;
      }

      try {
        const { res, data: p } = await safeFetchJSON(
          `/api/hublang/pelanggan-sambungan?pelangganId=${pid}`
        );
        if (res.ok && p) {
          const ns =
            p?.primarySambungan?.noSambungan ??
            p?.sambungan?.[0]?.noSambungan ??
            "-";
          setSambNo(ns || "-");
        } else {
          setSambNo("-");
        }
      } catch {
        setSambNo("-");
      }
    })();
  }, [data]);

  /* Mark DONE */
  const doMarkDone = async () => {
    setSaving(true);
    try {
      // 1) API modern: doneNow
      let r = await safeFetchJSON(`/api/hublang/workorder/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doneNow: true }),
      });

      // 2) fallback manual
      if (!r.res.ok) {
        r = await safeFetchJSON(`/api/hublang/workorder/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "DONE",
            selesaiTanggal: new Date().toISOString(),
          }),
        });
      }

      if (!r.res.ok) throw new Error(r.data?.error || `Gagal update (HTTP ${r.res.status})`);

      push("✅ Pekerjaan ditandai selesai", "ok");
      router.push("/hublang/workorder");
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setSaving(false);
      setOpenConfirm(false);
    }
  };

  const totalBiaya =
    (data?.biayaMaterialRp ?? 0) + (data?.biayaJasaRp ?? 0);

  return (
    <div className="p-6 space-y-5">
      <View />

      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Detail Work Order
          </h1>
          {data && (
            <p className="text-sm text-gray-700 flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <span className="font-semibold">{data.noWo}</span>
              <span className="text-gray-400">•</span>
              Dibuat <span className="font-medium">{fmtDate(data.tanggalBuat, true)}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/hublang/workorder"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50 font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </a>
          {data?.status !== "DONE" && (
            <button
              onClick={() => setOpenConfirm(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg disabled:opacity-60 font-semibold"
            >
              <CheckCircle2 className="w-5 h-5" />
              {saving ? "Memproses..." : "Tandai Selesai"}
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border shadow-sm p-6 text-gray-700">
          Memuat…
        </div>
      )}

      {/* Content */}
      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Summary Card */}
          <div className="xl:col-span-3 bg-white rounded-xl border shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Chip tone={toneByStatus(data.status)}>
                {data.status}
              </Chip>
              <Chip
                tone={
                  data.prioritas === "URGENT"
                    ? "red"
                    : data.prioritas === "HIGH"
                    ? "amber"
                    : data.prioritas === "LOW"
                    ? "gray"
                    : "blue"
                }
              >
                <Workflow className="w-3.5 h-3.5" />
                {data.prioritas}
              </Chip>
              <Chip tone="gray">
                <FileText className="w-3.5 h-3.5" />
                {data.tipe ? labelize(data.tipe) : "Tipe: -"}
              </Chip>
              <Chip tone="gray">
                <CalendarDays className="w-3.5 h-3.5" />
                Target: {fmtDate(data.targetTanggal)}
              </Chip>
              <Chip tone="green">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Selesai: {fmtDate(data.selesaiTanggal, true)}
              </Chip>
            </div>
          </div>

          {/* Left Column: Informasi Umum */}
          <div className="xl:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border shadow-sm">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <BadgeInfo className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-gray-900">Informasi Umum</h2>
              </div>
              <div className="px-4">
                <Row
                  icon={<FileText className="w-4 h-4 text-gray-400" />}
                  label="Jenis"
                  value={data.jenis || "-"}
                />
                <Row
                  icon={<CalendarDays className="w-4 h-4 text-gray-400" />}
                  label="Target"
                  value={fmtDate(data.targetTanggal)}
                />
                <Row
                  icon={<CheckCircle2 className="w-4 h-4 text-gray-400" />}
                  label="Selesai"
                  value={fmtDate(data.selesaiTanggal, true)}
                />
                <Row
                  icon={<FileText className="w-4 h-4 text-gray-400" />}
                  label="Pelanggan"
                  value={
                    data.pelanggan
                      ? `${data.pelanggan.nama} (${data.pelanggan.kode})`
                      : "-"
                  }
                />
                <Row
                  icon={<MapPin className="w-4 h-4 text-gray-400" />}
                  label="No Sambungan"
                  value={sambNo}
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-gray-900">Deskripsi</h2>
              </div>
              <div className="px-4 py-4 whitespace-pre-wrap text-gray-900">
                {data.deskripsi?.trim() ? data.deskripsi : "—"}
              </div>
            </div>
          </div>

          {/* Right Column: Biaya + Meta */}
          <div className="space-y-5">
            <div className="bg-white rounded-xl border shadow-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-bold text-gray-900">Rincian Biaya</h2>
                </div>
                <div className="text-xs text-gray-500">
                  Seluruh angka dalam Rupiah
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-800">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-medium">Biaya Material</span>
                  </div>
                  <div className="font-bold text-gray-900">
                    {fmtRp(data.biayaMaterialRp)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-800">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-medium">Biaya Jasa</span>
                  </div>
                  <div className="font-bold text-gray-900">
                    {fmtRp(data.biayaJasaRp)}
                  </div>
                </div>
                <div className="border-t pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-900 font-bold">
                    <DollarSign className="w-4 h-4" />
                    <span>Total</span>
                  </div>
                  <div className="text-lg font-extrabold text-gray-900">
                    {fmtRp(totalBiaya)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-gray-900">Meta</h2>
              </div>
              <div className="p-4 space-y-2 text-sm text-gray-800">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">No. WO:</span>
                  <span className="font-semibold text-gray-900">{data.noWo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Dibuat:</span>
                  <span className="font-semibold text-gray-900">
                    {fmtDate(data.tanggalBuat, true)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Prioritas:</span>
                  <span className="font-semibold text-gray-900">{data.prioritas}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Tipe:</span>
                  <span className="font-semibold text-gray-900">
                    {data.tipe ? labelize(data.tipe) : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm done modal */}
      <ConfirmDialog
        open={openConfirm}
        title="Tandai sebagai selesai?"
        message="Status WO akan diubah menjadi DONE dan waktu selesai dicatat sekarang."
        confirmText="Ya, Tandai Selesai"
        cancelText="Batal"
        onConfirm={doMarkDone}
        onClose={() => setOpenConfirm(false)}
      />
    </div>
  );
}
