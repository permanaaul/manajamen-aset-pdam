// app/hublang/workorder/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import useToast from "../../../components/Toast";

/* ===== Enum mirror dari Prisma: JenisPekerjaanPemeliharaan ===== */
const JENIS_PEKERJAAN = [
  "INSPEKSI",
  "PELUMASAN",
  "KALIBRASI",
  "GANTI_SPAREPART",
  "PERBAIKAN_RINGAN",
  "PERBAIKAN_BESAR",
  "OVERHAUL",
  "TESTING",
] as const;
type JenisPekerjaan = typeof JENIS_PEKERJAAN[number];

const labelize = (s?: string | null) =>
  (s || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

type Row = {
  id: number;
  noWo: string;
  tanggalBuat: string;
  status: "DRAFT" | "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELED";
  prioritas: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  jenis: string | null;
  deskripsi: string | null;
  targetTanggal: string | null;
  selesaiTanggal: string | null;
  tipe?: JenisPekerjaan | null; // ← nilai enum dari server (alias jenisPekerjaan)
  pelanggan?: { id: number; nama: string } | null;
  sambungan?: { id: number; noSambungan: string } | null;
  rute?: { id: number; nama: string } | null; // fallback lama
  petugas?: { id: number; nama: string } | null;
};

const Chip = ({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "blue" | "green" | "red" | "amber";
}) => {
  const m: Record<string, string> = {
    gray: "bg-gray-100 text-gray-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m[tone]}`}>
      {children}
    </span>
  );
};

function toneByStatus(s: Row["status"]) {
  switch (s) {
    case "OPEN":
      return "blue";
    case "IN_PROGRESS":
      return "amber";
    case "DONE":
      return "green";
    case "CANCELED":
      return "red";
    default:
      return "gray";
  }
}

export default function PageWO() {
  const { push, View } = useToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [prior, setPrior] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [size] = React.useState(20);
  const [count, setCount] = React.useState(0);
  const [showCreate, setShowCreate] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (status) p.set("status", status);
      if (prior) p.set("prioritas", prior);
      p.set("page", String(page));
      p.set("size", String(size));
      const res = await fetch(`/api/hublang/workorder?${p.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat");
      setRows(data.rows);
      setCount(data.count);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setLoading(false);
    }
  }, [q, status, prior, page, size, push]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-5 text-gray-900">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <span className="inline-block rounded-lg bg-indigo-50 text-indigo-700 p-1.5">📋</span>
            Work Order
          </h1>
          <p className="text-sm text-gray-600">
            Tiket pekerjaan teknis (pemasangan, perbaikan, dsb).
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm"
        >
          <Plus size={18} />
          Buat WO
        </button>
      </div>

      {/* Filter bar - sejajar & responsif */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-12 md:col-span-5">
            <label className="block text-sm text-gray-700 mb-1">Cari</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full h-10 border rounded-lg px-3 text-sm"
              placeholder="no/jenis/nama/no sambungan…"
            />
          </div>

          <div className="col-span-6 md:col-span-3">
            <label className="block text-sm text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-10 border rounded-lg px-3 text-sm bg-white"
            >
              <option value="">(semua)</option>
              {["DRAFT", "OPEN", "IN_PROGRESS", "DONE", "CANCELED"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-6 md:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Prioritas</label>
            <select
              value={prior}
              onChange={(e) => setPrior(e.target.value)}
              className="w-full h-10 border rounded-lg px-3 text-sm bg-white"
            >
              <option value="">(semua)</option>
              {["LOW", "NORMAL", "HIGH", "URGENT"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-2 flex gap-2 justify-end">
            <button
              onClick={() => {
                setPage(1);
                load();
              }}
              className="h-10 px-3 rounded-lg border text-sm hover:bg-gray-50"
            >
              Terapkan
            </button>
            <button
              onClick={() => {
                setQ("");
                setStatus("");
                setPrior("");
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border text-sm hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">No</th>
              <th className="px-3 py-2 text-left">Jenis</th>
              <th className="px-3 py-2 text-left">Pelanggan / Samb.</th>
              <th className="px-3 py-2 text-left">Tipe</th>
              <th className="px-3 py-2 text-left">Petugas</th>
              <th className="px-3 py-2 text-left">Target</th>
              <th className="px-3 py-2 text-left">Selesai</th>
              <th className="px-3 py-2 text-left">Prioritas</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right w-28">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 align-top">
                  <div className="font-medium">{r.noWo}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(r.tanggalBuat).toLocaleString("id-ID")}
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="font-medium">{r.jenis || "-"}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">
                    {r.deskripsi || ""}
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  <div>{r.pelanggan?.nama || "-"}</div>
                  <div className="text-xs text-gray-500">
                    {r.sambungan?.noSambungan || ""}
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  {r.tipe ? labelize(r.tipe) : r.rute?.nama || "-"}
                </td>
                <td className="px-3 py-2 align-top">
                  {r.petugas?.nama || "-"}
                </td>
                <td className="px-3 py-2 align-top">
                  {r.targetTanggal
                    ? new Date(r.targetTanggal).toLocaleDateString("id-ID")
                    : "-"}
                </td>
                <td className="px-3 py-2 align-top">
                  {r.selesaiTanggal
                    ? new Date(r.selesaiTanggal).toLocaleString("id-ID")
                    : "-"}
                </td>
                <td className="px-3 py-2 align-top">
                  <Chip
                    tone={
                      r.prioritas === "URGENT"
                        ? "red"
                        : r.prioritas === "HIGH"
                        ? "amber"
                        : r.prioritas === "LOW"
                        ? "gray"
                        : "blue"
                    }
                  >
                    {r.prioritas}
                  </Chip>
                </td>
                <td className="px-3 py-2 align-top">
                  <Chip tone={toneByStatus(r.status) as any}>{r.status}</Chip>
                </td>
                <td className="px-3 py-2 align-top text-right">
                  <Link
                    href={`/hublang/workorder/${r.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    <Eye size={16} /> Detail
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  Tidak ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1.5 rounded border disabled:opacity-50"
        >
          Prev
        </button>
        <div className="text-sm text-gray-600">
          Hal {page} • {count} data
        </div>
        <button
          disabled={page * size >= count}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 rounded border disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            push("✅ WO dibuat", "ok");
            load();
          }}
        />
      )}
    </div>
  );
}

/* Modal Create – tanpa Sambungan ID, tambah Biaya Material & Jasa, dan Tipe dari enum JenisPekerjaanPemeliharaan */
function CreateModal({
  onClose,
  onSuccess,
}: {
  onClose(): void;
  onSuccess(): void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<{
    jenis: string;
    deskripsi: string;
    prioritas: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    status: "DRAFT" | "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELED";
    tipe: JenisPekerjaan;   // ← pakai enum UI
    pelangganId: string;
    sambunganNo: string;
    petugasId: string;
    targetTanggal: string;
    biayaMaterialRp: string;
    biayaJasaRp: string;
  }>({
    jenis: "",
    deskripsi: "",
    prioritas: "NORMAL",
    status: "DRAFT",
    tipe: "INSPEKSI",
    pelangganId: "",
    sambunganNo: "",
    petugasId: "",
    targetTanggal: "",
    biayaMaterialRp: "",
    biayaJasaRp: "",
  });

  type PelangganOpt = {
    id: number;
    kode: string;
    nama: string;
    sambunganId: number | null;
    noSambungan: string | null;
  };
  const [ops, setOps] = React.useState<PelangganOpt[]>([]);
  const [loadingOps, setLoadingOps] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      setLoadingOps(true);
      try {
        const res = await fetch(`/api/hublang/workorder/lookup?take=200`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal ambil pelanggan");
        setOps(data.options || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingOps(false);
      }
    })();
  }, []);

  const onPickPelanggan: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const val = e.target.value;
    const picked = ops.find((o) => String(o.id) === val);
    setForm((f) => ({
      ...f,
      pelangganId: val,
      sambunganNo: picked?.noSambungan || "",
    }));
  };

  const submit = async () => {
    if (!form.jenis.trim()) return;
    setSaving(true);
    try {
      const payload = {
        jenis: form.jenis,
        deskripsi: form.deskripsi || null,
        prioritas: form.prioritas,
        status: form.status,
        tipe: form.tipe, // dikirim ke API (akan dipetakan ke kolom jenisPekerjaan)
        pelangganId: form.pelangganId ? Number(form.pelangganId) : null,
        petugasId: form.petugasId ? Number(form.petugasId) : null,
        targetTanggal: form.targetTanggal || null,
        biayaMaterialRp: form.biayaMaterialRp ? Number(form.biayaMaterialRp) : null,
        biayaJasaRp: form.biayaJasaRp ? Number(form.biayaJasaRp) : null,
      };
      const res = await fetch("/api/hublang/workorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal simpan");
      onSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center z-40">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-5 shadow-xl border">
        {/* header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Buat Work Order</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-black">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <label className="text-gray-700">
              Jenis <span className="text-red-600">*</span>
            </label>
            <input
              value={form.jenis}
              onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value }))}
              className="border rounded w-full px-3 py-2"
              placeholder="Perbaikan kebocoran"
            />
          </div>

          <div>
            <label className="text-gray-700">Prioritas</label>
            <select
              value={form.prioritas}
              onChange={(e) => setForm((f) => ({ ...f, prioritas: e.target.value as any }))}
              className="border rounded w-full px-3 py-2 bg-white"
            >
              {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-700">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
              className="border rounded w-full px-3 py-2 bg-white"
            >
              {["DRAFT", "OPEN", "IN_PROGRESS", "DONE", "CANCELED"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-gray-700">Tipe</label>
            <select
              value={form.tipe}
              onChange={(e) => setForm((f) => ({ ...f, tipe: e.target.value as JenisPekerjaan }))}
              className="border rounded w-full px-3 py-2 bg-white"
            >
              {JENIS_PEKERJAAN.map((t) => (
                <option key={t} value={t}>
                  {labelize(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-700">Target Tanggal</label>
            <input
              type="date"
              value={form.targetTanggal}
              onChange={(e) => setForm((f) => ({ ...f, targetTanggal: e.target.value }))}
              className="border rounded w-full px-3 py-2"
            />
          </div>

          <div className="col-span-2">
            <label className="text-gray-700">Pilih Pelanggan</label>
            <select
              value={form.pelangganId}
              onChange={onPickPelanggan}
              className="border rounded w-full px-3 py-2 bg-white"
            >
              <option value="">{loadingOps ? "Memuat…" : "— Pilih —"}</option>
              {ops.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama} ({o.kode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-gray-700">No Sambungan</label>
            <input
              value={form.sambunganNo}
              readOnly
              placeholder="auto"
              className="border rounded w-full px-3 py-2 bg-gray-50"
            />
          </div>
          <div>
            <label className="text-gray-700">Petugas ID</label>
            <input
              value={form.petugasId}
              onChange={(e) => setForm((f) => ({ ...f, petugasId: e.target.value }))}
              className="border rounded w-full px-3 py-2"
              placeholder="opsional (input manual)"
            />
          </div>

          <div>
            <label className="text-gray-700">Biaya Material (Rp)</label>
            <input
              type="number"
              min="0"
              value={form.biayaMaterialRp}
              onChange={(e) => setForm((f) => ({ ...f, biayaMaterialRp: e.target.value }))}
              className="border rounded w-full px-3 py-2"
            />
          </div>
          <div>
            <label className="text-gray-700">Biaya Jasa (Rp)</label>
            <input
              type="number"
              min="0"
              value={form.biayaJasaRp}
              onChange={(e) => setForm((f) => ({ ...f, biayaJasaRp: e.target.value }))}
              className="border rounded w-full px-3 py-2"
            />
          </div>

          <div className="col-span-2">
            <label className="text-gray-700">Deskripsi</label>
            <textarea
              value={form.deskripsi}
              onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
              className="border rounded w-full px-3 py-2"
              rows={3}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
