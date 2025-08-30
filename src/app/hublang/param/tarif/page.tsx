"use client";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

/* ========= Icons (inline SVG, no extra deps) ========= */
const IconPlus = (p: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconSearch = (p: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconCopy = (p: any) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...p}>
    <path d="M9 9h9v9H9z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M6 6h9v9" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);
const IconTrash = (p: any) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...p}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);
const IconWarn = (p: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
    <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconClose = (p: any) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...p}>
    <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

type TarifRow = {
  id: number;
  kode: string;
  nama: string;
  diameterMm: number | null;
  minChargeM3: number | null;
  minChargeRp: string | null;
  biayaAdminRp: string | null;
  pajakAktif: boolean;
  pajakPersen: string | null;
  updatedAt: string;
};

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const fmtIDR = (v?: string | null) => (v ? idr.format(Number(String(v).replace(/[^\d]/g, ""))) : "—");

/* ====== Toast mini ====== */
type Toast = { id: number; type: "success" | "error" | "info"; text: string };
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, "id">, ms = 2200) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, ...t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), ms);
  };
  return { toasts, push, remove: (id: number) => setToasts((x) => x.filter((y) => y.id !== id)) };
}

export default function PageTarifList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sort, setSort] = useState<"id_asc" | "id_desc" | "updated_desc">("id_asc");
  const [rows, setRows] = useState<TarifRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; kode: string } | null>(null);
  const { toasts, push, remove } = useToast();
  const pages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;

  const query = useMemo(() => {
    const usp = new URLSearchParams({ q: search, page: String(page), limit: String(limit), sort });
    return `/api/hublang/tarif?${usp.toString()}`;
  }, [search, page, limit, sort]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(query);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat data");
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      push({ type: "error", text: "Gagal memuat data" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, limit, sort]);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(); };

  const copyId = async (id: number) => {
    try { await navigator.clipboard.writeText(String(id)); push({ type: "success", text: `ID ${id} disalin` }); }
    catch { push({ type: "error", text: "Gagal menyalin" }); }
  };

  const requestDelete = (id: number, kode: string) => setConfirm({ id, kode });

  const doDelete = async () => {
    if (!confirm) return;
    const { id, kode } = confirm;
    setDeleting(id);
    try {
        const res = await fetch("/api/hublang/tarif", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal hapus tarif");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      push({ type: "success", text: `Tarif ${kode} dihapus` });
      setConfirm(null);
    } catch (e: any) {
      push({ type: "error", text: e.message });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 space-y-4 text-gray-900">
      {/* Toasts */}
      <div className="fixed right-4 top-4 z-[60] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 rounded-lg px-3 py-2 shadow border text-sm bg-white ${
              t.type === "success" ? "border-emerald-200" :
              t.type === "error" ? "border-red-200" : "border-gray-200"
            }`}
          >
            <span className={`mt-0.5 h-2 w-2 rounded-full ${
              t.type === "success" ? "bg-emerald-500" :
              t.type === "error" ? "bg-red-500" : "bg-gray-400"
            }`} />
            <div className="pr-2">{t.text}</div>
            <button onClick={() => remove(t.id)} className="text-gray-500 hover:text-gray-700">
              <IconClose />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Parameter Tarif</h1>
          <p className="text-sm text-gray-600">Daftar golongan tarif. Gunakan kolom <b>ID</b> saat memilih di Sambungan.</p>
        </div>
        <Link href="/hublang/param/tarif/tambah" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm">
          <IconPlus /> Tambah
        </Link>
      </div>

      {/* Toolbar */}
      <form onSubmit={onSearch} className="bg-white p-3 rounded-xl shadow border border-gray-200 flex flex-wrap gap-3 items-end">
        <div className="relative">
          <label className="block text-sm text-gray-700">Cari</label>
          <div className="flex items-center border rounded px-2 w-72 max-w-full">
            <IconSearch className="text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="kode/nama" className="px-2 py-2 text-sm w-full outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-700">Sort</label>
          <select className="border rounded px-3 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="id_asc">ID ↑</option>
            <option value="id_desc">ID ↓</option>
            <option value="updated_desc">Updated ↓</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700">Per halaman</label>
          <select className="border rounded px-3 py-2 text-sm" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
        <button className="ml-auto bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-lg" disabled={loading}>
          {loading ? "Memuat..." : "Terapkan"}
        </button>
      </form>

      {/* Desktop table */}
      <div className="overflow-auto bg-white rounded-xl shadow border border-gray-200 hidden md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left w-20">ID</th>
              <th className="p-3 text-left">Kode</th>
              <th className="p-3 text-left">Nama</th>
              <th className="p-3 text-left">Ø (mm)</th>
              <th className="p-3 text-left">Min Charge</th>
              <th className="p-3 text-left">Admin</th>
              <th className="p-3 text-left">Pajak</th>
              <th className="p-3 text-left">Updated</th>
              <th className="p-3 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="p-6 text-center text-gray-500">{loading ? "Memuat..." : "Tidak ada data."}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-mono">{r.id}</td>
                <td className="p-3 font-semibold">{r.kode}</td>
                <td className="p-3">{r.nama}</td>
                <td className="p-3">{r.diameterMm ?? "—"}</td>
                <td className="p-3">{r.minChargeM3 != null ? <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5"><span className="font-mono">{r.minChargeM3}</span>&nbsp;m³</span> : <span className="font-mono">{fmtIDR(r.minChargeRp)}</span>}</td>
                <td className="p-3 font-mono">{fmtIDR(r.biayaAdminRp)}</td>
                <td className="p-3">{r.pajakAktif ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs">{r.pajakPersen ? `${r.pajakPersen}%` : "aktif"}</span> : <span className="text-gray-400">—</span>}</td>
                <td className="p-3">{new Date(r.updatedAt).toLocaleDateString("id-ID")}</td>
                <td className="p-3 space-x-2">
                  <button onClick={() => copyId(r.id)} className="inline-flex items-center gap-1 px-2 py-1 border rounded text-xs hover:bg-gray-100" title="Salin ID">
                    <IconCopy /> Copy ID
                  </button>
                  <button
                    onClick={() => requestDelete(r.id, r.kode)}
                    className="inline-flex items-center gap-1 px-2 py-1 border rounded text-xs text-red-600 hover:bg-red-50"
                    title="Hapus"
                  >
                    <IconTrash /> Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-gray-500 bg-white rounded-xl shadow border border-gray-200">{loading ? "Memuat..." : "Tidak ada data."}</div>
        ) : rows.map((r) => (
          <div key={r.id} className="bg-white rounded-xl shadow border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">ID {r.id}</div>
              <div className="flex gap-2">
                <button onClick={() => copyId(r.id)} className="inline-flex items-center gap-1 px-2 py-1 border rounded text-xs"><IconCopy /> Copy</button>
                <button onClick={() => requestDelete(r.id, r.kode)} className="inline-flex items-center gap-1 px-2 py-1 border rounded text-xs text-red-600"><IconTrash /> Hapus</button>
              </div>
            </div>
            <div className="mt-1 text-lg font-semibold">{r.kode}</div>
            <div className="text-sm text-gray-600">{r.nama}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Ø</div><div>{r.diameterMm ?? "—"}</div></div>
              <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Min Charge</div><div className="font-mono">{r.minChargeM3 != null ? `${r.minChargeM3} m³` : fmtIDR(r.minChargeRp)}</div></div>
              <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Admin</div><div className="font-mono">{fmtIDR(r.biayaAdminRp)}</div></div>
              <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Pajak</div><div>{r.pajakAktif ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs">{r.pajakPersen ? `${r.pajakPersen}%` : "aktif"}</span> : "—"}</div></div>
              <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Updated</div><div>{new Date(r.updatedAt).toLocaleDateString("id-ID")}</div></div>
            </div>
          </div>
        ))}
      </div>

      {/* Pager */}
      <div className="flex items-center gap-3">
        <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
        <span className="text-sm">Page {page} / {pages}</span>
        <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>Next</button>
      </div>

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-[min(92vw,420px)] p-5 animate-[fadeIn_.15s_ease]">
            <div className="flex items-start gap-3">
              <div className="text-red-600"><IconWarn /></div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Hapus tarif ini?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Tarif <b>{confirm.kode}</b> (ID {confirm.id}) akan dihapus beserta bloknya. Tindakan ini tidak bisa diurungkan.
                </p>
              </div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setConfirm(null)} aria-label="Tutup">
                <IconClose />
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="px-3 py-2 rounded border hover:bg-gray-50">Batal</button>
              <button
                onClick={doDelete}
                disabled={deleting === confirm.id}
                className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
              >
                {deleting === confirm.id ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
