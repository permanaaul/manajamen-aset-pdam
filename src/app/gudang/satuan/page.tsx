// app/gudang/satuan/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Plus, Search, RotateCcw, Pencil, Trash2, Package, X } from "lucide-react";
import useToast from "@/components/Toast";

type Row = {
  id: number;
  nama: string;
  simbol: string | null;
};

const Btn = ({
  children,
  onClick,
  variant = "outline",
  disabled,
  className = "",
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "outline" | "primary";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) => {
  const base =
    "inline-flex items-center gap-2 h-10 px-3 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500"
      : "border border-slate-300 text-slate-800 hover:bg-slate-50 focus:ring-indigo-500";
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
};

export default function MasterSatuanPage() {
  const { View, push } = useToast();

  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [size] = React.useState(15);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      p.set("page", String(page));
      p.set("size", String(size));

      const res = await fetch(`/api/gudang/satuan?${p.toString()}`);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // biarkan data null → akan ditangani di bawah
      }

      if (!res.ok) {
        throw new Error(data?.error || `Gagal memuat satuan (HTTP ${res.status})`);
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setCount(Number.isFinite(data?.count) ? data.count : 0);
    } catch (e: any) {
      setRows([]);
      setCount(0);
      push(`❌ ${e?.message || "Gagal memuat satuan"}`, "err");
    } finally {
      setLoading(false);
    }
  }, [q, page, size, push]);

  React.useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setQ("");
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setModalOpen(true);
  };

  const onSaved = () => {
    setModalOpen(false);
    load();
  };

  const onDelete = async (id: number) => {
    if (!confirm("Hapus satuan ini?")) return;
    try {
      const res = await fetch(`/api/gudang/satuan/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus satuan");
      push("🗑️ Satuan dihapus", "ok");
      load();
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    }
  };

  return (
    <div className="p-6 space-y-6 text-slate-900">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Package className="w-6 h-6 text-indigo-600" />
          Master Satuan
        </h1>
        <div className="flex gap-2">
          <Link
            href="/gudang"
            className="inline-flex items-center h-10 px-3 rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            ← Kembali
          </Link>
          <Btn variant="primary" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Tambah Satuan
          </Btn>
        </div>
      </div>

      {/* Deskripsi singkat */}
      <p className="text-sm text-slate-700">
        Kelola daftar <b>Satuan</b> (mis. PCS, METER, LITER). Gunakan <b>Nama</b> untuk penamaan lengkap dan{" "}
        <b>Simbol</b> opsional sebagai singkatan. Semua perubahan langsung tersimpan ke basis data.
      </p>

      {/* Filter */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-12 md:col-span-8">
            <label className="block text-sm font-medium text-slate-800 mb-1">Cari</label>
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-11 border border-slate-300 rounded-lg pl-10 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ketik nama atau simbol…"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[12px] text-slate-600 mt-1">Contoh: “meter”, “pcs”, “kg”.</p>
          </div>
          <div className="col-span-12 md:col-span-4 flex gap-2 justify-end">
            <Btn onClick={() => { setPage(1); load(); }}>Terapkan</Btn>
            <Btn onClick={reset}>
              <RotateCcw className="w-4 h-4" />
              Reset
            </Btn>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-slate-800">
                <th className="px-3 py-2 text-left font-semibold">Nama</th>
                <th className="px-3 py-2 text-left font-semibold">Simbol</th>
                <th className="px-3 py-2 text-right w-40 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-3">
                        <div className="h-3.5 w-40 bg-slate-200/70 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-3.5 w-24 bg-slate-200/70 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="ml-auto h-8 w-28 bg-slate-200/70 rounded-lg animate-pulse" />
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-slate-700">
                    Tidak ada data. Klik <span className="font-semibold">Tambah Satuan</span> untuk membuat entri baru.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r, idx) => (
                  <tr key={r.id} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                    <td className="px-3 py-2 font-semibold">{r.nama}</td>
                    <td className="px-3 py-2">{r.simbol ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Btn onClick={() => openEdit(r)}>
                          <Pencil className="w-4 h-4" />
                          Edit
                        </Btn>
                        <Btn onClick={() => onDelete(r.id)}>
                          <Trash2 className="w-4 h-4 text-rose-600" />
                          Hapus
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pager */}
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 disabled:opacity-50 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        >
          Prev
        </button>
        <div className="text-sm text-slate-800">
          Hal {page} • {count} data
        </div>
        <button
          disabled={page * size >= count}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 disabled:opacity-50 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        >
          Next
        </button>
      </div>

      {modalOpen && (
        <SatuanModal editing={editing} onClose={() => setModalOpen(false)} onSaved={onSaved} />
      )}
    </div>
  );
}

/* ========== Modal ========== */
function SatuanModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push, View } = useToast();
  const isEdit = !!editing;

  const [nama, setNama] = React.useState(editing?.nama ?? "");
  const [simbol, setSimbol] = React.useState(editing?.simbol ?? "");
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    const n = nama.trim();
    const s = simbol.trim();
    if (!n) {
      push("❌ Nama satuan wajib diisi", "err");
      return;
    }
    if (s && s.length > 10) {
      push("❌ Simbol maksimal 10 karakter", "err");
      return;
    }

    setSaving(true);
    try {
      const payload = { nama: n, simbol: s || null };
      const url = isEdit ? `/api/gudang/satuan/${editing!.id}` : `/api/gudang/satuan`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan satuan");
      push("✅ Satuan tersimpan", "ok");
      onSaved();
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <View />
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-w-[95vw] border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="text-lg font-bold">{isEdit ? "Edit Satuan" : "Tambah Satuan"}</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-300 hover:bg-slate-50 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="p-5 grid grid-cols-1 gap-3 text-sm">
            <div>
              <label className="block text-slate-800 mb-1 font-medium">
                Nama *
              </label>
              <input
                className="w-full h-11 border border-slate-300 rounded-lg px-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="cth: PCS, METER, LITER"
              />
              <p className="text-[12px] text-slate-600 mt-1">Penamaan lengkap satuan.</p>
            </div>

            <div>
              <label className="block text-slate-800 mb-1 font-medium">
                Simbol (opsional)
              </label>
              <input
                className="w-full h-11 border border-slate-300 rounded-lg px-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={simbol}
                onChange={(e) => setSimbol(e.target.value)}
                placeholder="cth: pcs, m, l"
                maxLength={10}
              />
              <p className="text-[12px] text-slate-600 mt-1">Singkatan maksimal 10 karakter. Otomatis disimpan huruf besar.</p>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
            <Btn onClick={onClose}>Batal</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
