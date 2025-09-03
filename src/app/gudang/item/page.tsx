// app/gudang/item/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  Search,
  RotateCcw,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import useToast from "@/components/Toast";

type Unit = { id: number; nama: string; simbol: string | null };

type Row = {
  id: number;
  kode: string;
  nama: string;
  jenis: string;
  minQty: number | null;
  isActive: boolean;
  satuan?: Unit | null;
  stokQty?: number;
};

const JENIS_LIST = ["SPAREPART", "MATERIAL", "BHP", "JASA", "LAINNYA"];

/* ===== util kecil ===== */
const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`px-2 py-[3px] rounded-full text-xs font-semibold ${className}`} >
    {children}
  </span>
);

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
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
};

export default function MasterItemPage() {
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

      const res = await fetch(`/api/gudang/items?${p.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat items");
      setRows(data.rows || []);
      setCount(data.count || 0);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
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
    if (!confirm("Hapus item ini?")) return;
    try {
      const res = await fetch(`/api/gudang/items/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus");
      push("🗑️ Item dihapus", "ok");
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
          Master Item
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
            Tambah Item
          </Btn>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-12 md:col-span-7">
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Cari
            </label>
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-11 border border-slate-300 rounded-lg pl-10 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ketik kode atau nama…"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div className="col-span-12 md:col-span-5 flex gap-2 justify-end">
            <Btn onClick={() => { setPage(1); load(); }}>
              Terapkan
            </Btn>
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
                <th className="px-3 py-2 text-left font-semibold">Kode</th>
                <th className="px-3 py-2 text-left font-semibold">Nama</th>
                <th className="px-3 py-2 text-left font-semibold">Jenis</th>
                <th className="px-3 py-2 text-left font-semibold">Satuan</th>
                <th className="px-3 py-2 text-right font-semibold">Min. Qty</th>
                <th className="px-3 py-2 text-center font-semibold">Status</th>
                <th className="px-3 py-2 text-right w-40 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-3"><div className="h-3.5 w-24 bg-slate-200/70 rounded animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-3.5 w-48 bg-slate-200/70 rounded animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-3.5 w-24 bg-slate-200/70 rounded animate-pulse" /></td>
                      <td className="px-3 py-3"><div className="h-3.5 w-16 bg-slate-200/70 rounded animate-pulse" /></td>
                      <td className="px-3 py-3 text-right"><div className="ml-auto h-3.5 w-10 bg-slate-200/70 rounded animate-pulse" /></td>
                      <td className="px-3 py-3 text-center"><div className="mx-auto h-5 w-16 bg-slate-200/70 rounded-full animate-pulse" /></td>
                      <td className="px-3 py-3 text-right"><div className="ml-auto h-8 w-28 bg-slate-200/70 rounded-lg animate-pulse" /></td>
                    </tr>
                  ))}
                </>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-700">
                    Tidak ada data. Klik <span className="font-semibold">Tambah Item</span> untuk membuat item pertama.
                  </td>
                </tr>
              )}

              {!loading && rows.map((r, idx) => (
                <tr key={r.id} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                  <td className="px-3 py-2 font-semibold">{r.kode}</td>
                  <td className="px-3 py-2">{r.nama}</td>
                  <td className="px-3 py-2">
                    <Badge className="bg-slate-100 text-slate-800">{r.jenis}</Badge>
                  </td>
                  <td className="px-3 py-2">{r.satuan?.simbol ?? r.satuan?.nama ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{r.minQty ?? 0}</td>
                  <td className="px-3 py-2 text-center">
                    {r.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-800">AKTIF</Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-800">NONAKTIF</Badge>
                    )}
                  </td>
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
        <ItemModal editing={editing} onClose={() => setModalOpen(false)} onSaved={onSaved} />
      )}
    </div>
  );
}

/* ===== Modal ===== */
function ItemModal({
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

  const [kode, setKode] = React.useState(editing?.kode ?? "");
  const [nama, setNama] = React.useState(editing?.nama ?? "");
  const [jenis, setJenis] = React.useState(editing?.jenis ?? "SPAREPART");
  const [minQty, setMinQty] = React.useState<string>(editing?.minQty != null ? String(editing.minQty) : "");
  const [isActive, setIsActive] = React.useState<boolean>(editing?.isActive ?? true);

  // ====== combobox satuan ======
  const [unitOpen, setUnitOpen] = React.useState(false);
  const [unitQuery, setUnitQuery] = React.useState("");
  const [unitOpts, setUnitOpts] = React.useState<Unit[]>([]);
  const [unitLoading, setUnitLoading] = React.useState(false);
  const [unitPicked, setUnitPicked] = React.useState<Unit | null>(editing?.satuan ?? null);
  const [unitActiveIdx, setUnitActiveIdx] = React.useState(-1);

  React.useEffect(() => {
    if (!unitOpen) return;
    const q = unitQuery.trim();
    const t = setTimeout(async () => {
      setUnitLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set("page", "1");
        sp.set("size", "20");
        if (q) sp.set("q", q);
        const res = await fetch(`/api/gudang/satuan?${sp.toString()}`);
        const data = await res.json();
        const rows: Unit[] = res.ok ? (data?.rows || []) : [];
        setUnitOpts(rows);
        setUnitActiveIdx(rows.length ? 0 : -1);
      } catch {
        setUnitOpts([]);
        setUnitActiveIdx(-1);
      } finally {
        setUnitLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [unitOpen, unitQuery]);

  const pickUnit = (u: Unit) => {
    setUnitPicked(u);
    setUnitOpen(false);
  };

  const onUnitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!unitOpen || unitOpts.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setUnitActiveIdx((i) => (i + 1) % unitOpts.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setUnitActiveIdx((i) => (i - 1 + unitOpts.length) % unitOpts.length); }
    else if (e.key === "Enter") { e.preventDefault(); const u = unitOpts[Math.max(0, unitActiveIdx)]; if (u) pickUnit(u); }
    else if (e.key === "Escape") { setUnitOpen(false); }
  };

  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!kode.trim() || !nama.trim()) {
      push("❌ Kode & Nama wajib", "err");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        kode: kode.trim(),
        nama: nama.trim(),
        jenis,
        satuanId: unitPicked?.id ?? null,
        minQty: minQty ? Number(minQty) : 0,
        isActive,
      };
      const url = isEdit ? `/api/gudang/items/${editing!.id}` : `/api/gudang/items`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan item");
      push("✅ Item tersimpan", "ok");
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
      <div className="bg-white rounded-xl shadow-2xl w-[720px] max-w-[95vw] border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="text-lg font-bold">{isEdit ? "Edit Item" : "Tambah Item"}</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-300 hover:bg-slate-50 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="p-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-slate-800 mb-1 font-medium">Kode *</label>
              <input
                className="w-full h-11 border border-slate-300 rounded-lg px-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                placeholder="cth: ITM-001"
              />
            </div>
            <div>
              <label className="block text-slate-800 mb-1 font-medium">Nama *</label>
              <input
                className="w-full h-11 border border-slate-300 rounded-lg px-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="cth: Pipa PVC 2 inch"
              />
            </div>

            <div>
              <label className="block text-slate-800 mb-1 font-medium">Jenis</label>
              <select
                className="w-full h-11 border border-slate-300 rounded-lg px-3 bg-white text-[15px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
              >
                {JENIS_LIST.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-800 mb-1 font-medium">Satuan</label>
              <div className={`flex h-11 items-center rounded-lg border ${unitOpen ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-300"} bg-white px-3`}>
                <input
                  value={unitPicked ? `${unitPicked.simbol ?? ""} ${unitPicked.nama}`.trim() : unitQuery}
                  onChange={(e) => { setUnitPicked(null); setUnitQuery(e.target.value); setUnitOpen(true); }}
                  onFocus={() => setUnitOpen(true)}
                  onKeyDown={onUnitKeyDown}
                  placeholder="Cari satuan…"
                  className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
                />
                <ChevronDown className="ml-2 h-4 w-4 text-slate-400" />
              </div>

              {unitOpen && (
                <div
                  className="absolute z-50 mt-1 max-h-64 w-[calc(50%-0.375rem)] overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {unitLoading && <div className="px-3 py-2 text-sm text-slate-700">Memuat…</div>}
                  {!unitLoading && unitOpts.length === 0 && <div className="px-3 py-2 text-sm text-slate-700">Tidak ada hasil.</div>}
                  {!unitLoading && unitOpts.map((u, i) => {
                    const active = i === unitActiveIdx;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`w-full px-3 py-2 text-left ${active ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                        onClick={() => pickUnit(u)}
                        onMouseEnter={() => setUnitActiveIdx(i)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{u.simbol ?? "-"}</div>
                            <div className="truncate text-xs text-slate-700">{u.nama}</div>
                          </div>
                          {active ? <Check className="h-4 w-4 text-indigo-600" /> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-800 mb-1 font-medium">Min. Qty</label>
              <input
                type="number" min={0}
                className="w-full h-11 border border-slate-300 rounded-lg px-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="flex items-center gap-2 mt-7">
              <input
                id="aktif"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="aktif" className="text-[15px] text-slate-900">Aktif</label>
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
