"use client";
import React, { useEffect, useMemo, useState } from "react";

// ===== Types dari API =====
type TagihanRow = {
  id: number;
  noTagihan: string;
  periode: string; // YYYY-MM
  pelanggan: { id: number; nama: string } | null;
  sambungan: { id: number; noSambungan: string } | null;
  pakaiM3: number;
  rincian: { air?: unknown; admin?: unknown; pajak?: unknown; denda?: unknown } | null;
  total: unknown;
  status: "DRAFT" | "FINAL" | "POSTED";
};

// ===== Helpers =====
const fmtMonth = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const toNum = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replaceAll(",", ""));
  // Prisma.Decimal atau object mirip—coba pakai valueOf/toString
  try {
    // @ts-ignore
    if (typeof v.valueOf === "function") return Number(v.valueOf());
    return Number(String(v));
  } catch {
    return 0;
  }
};

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const fmtIDR = (v: unknown) => idr.format(toNum(v));

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  if (!isFinite(y) || !isFinite(m)) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

// ===== Page =====
export default function PageTagihan() {
  const [periode, setPeriode] = useState<string>(fmtMonth());
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<TagihanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Baca ?periode=YYYY-MM dari URL (misal dari halaman Generate)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("periode");
    if (p) setPeriode(p);
  }, []);

  const fetchList = async () => {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({
        periode,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (status) params.set("status", status);
      if (q) params.set("q", q);

      const res = await fetch(`/api/hublang/tagihan?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal ambil data");

      setRows((data.data ?? []) as TagihanRow[]);
      setTotal(data.paging?.total ?? 0);
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchList();
  }, [periode, status, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const periodeNice = useMemo(() => monthLabel(periode), [periode]);

  // Subtotal halaman (bukan semua data)
  const subtotal = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.air += toNum(r.rincian?.air);
        acc.admin += toNum(r.rincian?.admin);
        acc.pajak += toNum(r.rincian?.pajak);
        acc.denda += toNum(r.rincian?.denda);
        acc.total += toNum(r.total);
        acc.pakai += Number(r.pakaiM3 ?? 0);
        return acc;
      },
      { air: 0, admin: 0, pajak: 0, denda: 0, total: 0, pakai: 0 }
    );
  }, [rows]);

  const StatusBadge = ({ s }: { s: TagihanRow["status"] }) => {
    const cls =
      s === "POSTED"
        ? "bg-indigo-100 text-indigo-700"
        : s === "FINAL"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-gray-100 text-gray-700";
    return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{s}</span>;
  };

  const tagihanGenerateUrl = `/hublang/billing?periode=${encodeURIComponent(periode)}`;

  return (
    <div className="p-6 space-y-5 relative text-gray-900">
      {/* Loading overlay tipis, tanpa blur */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 grid place-items-center z-10">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold">Daftar Tagihan</h1>
        <p className="text-sm text-gray-600">
          Periode aktif: <b>{periodeNice}</b>. Gunakan kolom pencarian untuk filter nama/kode pelanggan atau no sambungan.
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-xl shadow border border-gray-200 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm text-gray-700">Periode</label>
          <input
            type="month"
            value={periode}
            onChange={(e) => {
              setPeriode(e.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-2 text-gray-900"
          />
          <p className="text-xs text-gray-500 mt-1">{periodeNice}</p>
        </div>

        <div>
          <label className="block text-sm text-gray-700">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-2 text-gray-900"
          >
            <option value="">(semua)</option>
            <option value="DRAFT">DRAFT</option>
            <option value="FINAL">FINAL</option>
            <option value="POSTED">POSTED</option>
          </select>
        </div>

        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm text-gray-700">Cari</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                fetchList();
              }
            }}
            className="border rounded px-3 py-2 w-full text-gray-900 placeholder:text-gray-400"
            placeholder="nama/kode/no sambungan"
          />
        </div>

        <button
          onClick={() => {
            setPage(1);
            fetchList();
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Cari / Refresh
        </button>

        <a
          href={tagihanGenerateUrl}
          className="px-4 py-2 rounded-lg border hover:bg-gray-50"
          title="Buka halaman Generate Tagihan"
        >
          Generate Tagihan…
        </a>

        {!!msg && <p className="text-sm text-red-700">{msg}</p>}
      </div>

      {/* Tabel */}
      <div className="overflow-auto bg-white rounded-xl shadow border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left">
              <th className="p-3">No Tagihan</th>
              <th className="p-3">Periode</th>
              <th className="p-3">Pelanggan</th>
              <th className="p-3">No Sambungan</th>
              <th className="p-3 text-right">Pakai (m³)</th>
              <th className="p-3 text-right">Air</th>
              <th className="p-3 text-right">Admin</th>
              <th className="p-3 text-right">Pajak</th>
              <th className="p-3 text-right">Denda</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-6 text-center text-gray-500">
                  Data kosong. Coba <b>Cari / Refresh</b> atau ganti periode.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 font-medium">{t.noTagihan}</td>
                  <td className="p-3">{t.periode}</td>
                  <td className="p-3">{t.pelanggan?.nama ?? "-"}</td>
                  <td className="p-3">{t.sambungan?.noSambungan ?? "-"}</td>
                  <td className="p-3 text-right">{t.pakaiM3}</td>
                  <td className="p-3 text-right">{fmtIDR(t.rincian?.air)}</td>
                  <td className="p-3 text-right">{fmtIDR(t.rincian?.admin)}</td>
                  <td className="p-3 text-right">{fmtIDR(t.rincian?.pajak)}</td>
                  <td className="p-3 text-right">{fmtIDR(t.rincian?.denda)}</td>
                  <td className="p-3 text-right font-semibold">{fmtIDR(t.total)}</td>
                  <td className="p-3"><StatusBadge s={t.status} /></td>
                </tr>
              ))
            )}
          </tbody>

          {/* Subtotal halaman */}
          {rows.length > 0 && (
            <tfoot className="bg-gray-50">
              <tr className="font-medium">
                <td className="p-3" colSpan={4}>Subtotal halaman</td>
                <td className="p-3 text-right">{subtotal.pakai}</td>
                <td className="p-3 text-right">{fmtIDR(subtotal.air)}</td>
                <td className="p-3 text-right">{fmtIDR(subtotal.admin)}</td>
                <td className="p-3 text-right">{fmtIDR(subtotal.pajak)}</td>
                <td className="p-3 text-right">{fmtIDR(subtotal.denda)}</td>
                <td className="p-3 text-right">{fmtIDR(subtotal.total)}</td>
                <td className="p-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-sm">
          Page {page} / {totalPages} • {total} data
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="ml-2 border rounded px-2 py-1 text-gray-900"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
