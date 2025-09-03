// app/penyusutan/aset/[id]/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, Calculator } from "lucide-react";
import useToast from "@/components/Toast";

type Row = {
  id: number;
  periode: string | null;
  metode: string;
  basis: string;
  tarif: number;
  nilaiAwal: number;
  beban: number;
  akumulasi: number;
  nilaiAkhir: number;
};

type Resp = {
  aset: {
    id: number;
    nia: string;
    nama: string;
    kategori: string;
    lokasi: string | null;
    nilai: number;
  };
  rows: Row[];
  count: number;
  page: number;
  size: number;
  summary: { totalBeban: number; akumulasi: number; nilaiAkhir: number };
};

const fmtRp = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

const fmtPeriode = (iso: string | null, basis?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (basis === "TAHUNAN") return d.toLocaleDateString("id-ID", { year: "numeric" });
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

export default function PenyusutanPerAsetPage() {
  const { View, push } = useToast();
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();

  const id = Number(params.id);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [meta, setMeta] = React.useState<Resp["aset"] | null>(null);
  const [page, setPage] = React.useState<number>(Number(sp.get("page") || 1));
  const size = 50;
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<Resp["summary"] | null>(null);

  const dateFrom = sp.get("dateFrom") || "";
  const dateTo   = sp.get("dateTo") || "";

  const fetchData = React.useCallback(async (toPage = 1) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(toPage), size: String(size) });
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo)   qs.set("dateTo", dateTo);

      const url = `/api/aset/${id}/penyusutan?${qs.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      const data: Resp | any = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat data");
      setMeta(data.aset);
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setPage(toPage);
      setCount(Number(data.count || 0));
      setSummary(data.summary || null);

      // sinkronkan URL
      const keep = new URLSearchParams({ page: String(toPage) });
      if (dateFrom) keep.set("dateFrom", dateFrom);
      if (dateTo)   keep.set("dateTo", dateTo);
      router.replace(`/penyusutan/aset/${id}?${keep.toString()}`);
    } catch (e: any) {
      push(`❌ ${String(e.message || "Gagal memuat data")}`, "err");
      setRows([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [id, size, dateFrom, dateTo, router, push]);

  React.useEffect(() => { if (id) fetchData(page); }, [id]); // eslint-disable-line

  const fromIdx = Math.min((page - 1) * size + 1, Math.max(count, 1));
  const toIdx = Math.min(page * size, count);

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-indigo-600" />
            Penyusutan – Aset
          </h1>
          {meta && (
            <div className="text-[13px] text-gray-700">
              <div><b>{meta.nia}</b> — {meta.nama}</div>
              <div className="text-gray-600">{meta.kategori}{meta.lokasi ? ` • ${meta.lokasi}` : ""}</div>
            </div>
          )}
          {(dateFrom || dateTo) && (
            <div className="mt-1 text-xs text-gray-600">
              Filter tanggal aktif: {dateFrom || "—"} s/d {dateTo || "—"}
            </div>
          )}
        </div>
        <Link href="/penyusutan" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" /> Kembali
        </Link>
      </div>

      {summary && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-2 py-0.5 rounded-full bg-gray-100 ring-1 ring-gray-200">Total beban: <b>{fmtRp(summary.totalBeban)}</b></span>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 ring-1 ring-gray-200">Akumulasi akhir: <b>{fmtRp(summary.akumulasi)}</b></span>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 ring-1 ring-gray-200">Nilai akhir: <b>{fmtRp(summary.nilaiAkhir)}</b></span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b font-semibold text-gray-900">Riwayat Penyusutan</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="bg-gray-50">
              <tr className="text-gray-800">
                <th className="px-3 py-2 text-left">Periode</th>
                <th className="px-3 py-2 text-left">Metode</th>
                <th className="px-3 py-2 text-left">Basis</th>
                <th className="px-3 py-2 text-right">Tarif</th>
                <th className="px-3 py-2 text-right">Nilai Awal</th>
                <th className="px-3 py-2 text-right">Beban</th>
                <th className="px-3 py-2 text-right">Akumulasi</th>
                <th className="px-3 py-2 text-right">Nilai Akhir</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-700">Memuat…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-700">Tidak ada data.</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{fmtPeriode(r.periode, r.basis)}</td>
                  <td className="px-3 py-2">{r.metode.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">{r.basis}</td>
                  <td className="px-3 py-2 text-right">{r.tarif.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right">{fmtRp(r.nilaiAwal)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtRp(r.beban)}</td>
                  <td className="px-3 py-2 text-right">{fmtRp(r.akumulasi)}</td>
                  <td className="px-3 py-2 text-right">{fmtRp(r.nilaiAkhir)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-[13px] text-gray-800">
          <div>
            {count > 0 ? (
              <>Menampilkan <b>{fromIdx}</b>–<b>{toIdx}</b> dari <b>{count}</b> baris</>
            ) : <>0 baris</>}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => fetchData(page - 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page * size >= count}
              onClick={() => fetchData(page + 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
