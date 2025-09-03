// app/gudang/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  PlusCircle,
  ArrowRight,
  Filter,
  History,
  PackagePlus,
  PackageMinus,
  Scale,
  FileQuestion,
} from "lucide-react";
import useToast from "@/components/Toast";

/** =========================
 * Types + helpers
 * ========================= */
type Row = {
  id: number;
  no: string;
  tanggal: string; // ISO
  jenis: "IN" | "OUT" | "ADJ" | string;
  referensi: string | null;
  keterangan: string | null;
  lines: number;
};

function chipTone(jenis: Row["jenis"]) {
  if (jenis === "IN") return "bg-emerald-100 text-emerald-800 ring-emerald-200/70";
  if (jenis === "OUT") return "bg-rose-100 text-rose-800 ring-rose-200/70";
  if (jenis === "ADJ") return "bg-amber-100 text-amber-800 ring-amber-200/70";
  return "bg-gray-100 text-gray-800 ring-gray-200/70";
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** Normalisasi row agar kompatibel API lama/baru */
function normalizeRows(input: any[]): Row[] {
  return (input || []).map((r: any) => {
    // nomor vs noTransaksi
    const no = r.noTransaksi ?? r.nomor ?? "-";
    // jenis (IN/OUT/ADJ) vs tipe (RECEIPT/ISSUE/ADJUSTMENT/TRANSFER/RETURN)
    let jenis: Row["jenis"] = r.jenis;
    if (!jenis && r.tipe) {
      const t = String(r.tipe).toUpperCase();
      if (t === "RECEIPT") jenis = "IN";
      else if (t === "ISSUE") jenis = "OUT";
      else if (t === "ADJUSTMENT") jenis = "ADJ";
      else jenis = t;
    }
    return {
      id: r.id,
      no,
      tanggal: r.tanggal,
      jenis: jenis || "-",
      referensi: r.referensi ?? null,
      keterangan: r.keterangan ?? r.catatan ?? null,
      lines: r._count?.lines ?? r.linesCount ?? 0,
    };
  });
}

/** Skeleton loader */
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-3 py-3">
        <div className="h-3 w-28 rounded bg-gray-200" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-36 rounded bg-gray-200" />
      </td>
      <td className="px-3 py-3">
        <div className="h-6 w-14 rounded-full bg-gray-200" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-24 rounded bg-gray-200" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-40 rounded bg-gray-200" />
      </td>
      <td className="px-3 py-3 text-right">
        <div className="h-3 ml-auto w-10 rounded bg-gray-200" />
      </td>
    </tr>
  );
}

/** Mini stat card */
function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium text-gray-700">{title}</div>
        <div>{icon}</div>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-500">Dalam daftar terbaru</div>
    </div>
  );
}

/** Quick link card */
function QuickCard({
  title,
  desc,
  href,
  className = "",
}: {
  title: string;
  desc: string;
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-transparent transition hover:shadow-md hover:ring-indigo-200 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-900">{title}</div>
        <ArrowRight className="h-4 w-4 text-gray-400" />
      </div>
      <p className="mt-1 text-sm leading-6 text-gray-600">{desc}</p>
    </Link>
  );
}

export default function GudangHome() {
  const router = useRouter();
  const { push, View } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [count, setCount] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", size: "8" });
      const res = await fetch(`/api/gudang/transaksi?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat transaksi");
      setRows(normalizeRows(data.rows || []));
      setCount(data.count || 0);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setLoading(false);
    }
  }, [push]);

  React.useEffect(() => {
    load();
  }, [load]);

  const totalIN = rows.filter((r) => r.jenis === "IN").length;
  const totalOUT = rows.filter((r) => r.jenis === "OUT").length;
  const totalADJ = rows.filter((r) => r.jenis === "ADJ").length;

  return (
    <div className="p-6 space-y-6">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <Boxes className="h-6 w-6 text-indigo-600" />
            Gudang
          </h1>
          <p className="mt-1 text-[13px] leading-6 text-gray-600">
            Ringkasan aktivitas & navigasi cepat modul gudang.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/gudang/transaksi/tambah"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm ring-1 ring-indigo-500/20 transition hover:bg-indigo-700"
          >
            <PlusCircle className="h-4 w-4" />
            Buat Transaksi
          </Link>
          <Link
            href="/gudang/transaksi"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <ClipboardList className="h-4 w-4" />
            Lihat Semua
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Transaksi Masuk"
          value={totalIN}
          icon={<PackagePlus className="h-5 w-5 text-emerald-600" />}
        />
        <StatCard
          title="Transaksi Keluar"
          value={totalOUT}
          icon={<PackageMinus className="h-5 w-5 text-rose-600" />}
        />
        <StatCard title="Penyesuaian" value={totalADJ} icon={<Scale className="h-5 w-5 text-amber-600" />} />
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickCard title="Transaksi" desc="Kelola transaksi masuk, keluar & penyesuaian." href="/gudang/transaksi" />
        <QuickCard title="Master Item" desc="Data barang & atributnya." href="/gudang/item" />
        <QuickCard title="Satuan" desc="Kelola satuan (pcs, m, ltr, dst)." href="/gudang/satuan" />
        <QuickCard
          className="md:col-span-2"
          title="Kartu Stok"
          desc="Riwayat pergerakan per item (Masuk/Keluar/Saldo)."
          href="/gudang/kartu-stok"
        />
      </div>

      {/* Recent table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <History className="h-5 w-5 text-indigo-600" />
          <div className="font-semibold text-gray-900">Transaksi Terbaru</div>
          <div className="ml-auto text-sm text-gray-500">{count} total</div>
        </div>

        <div className="p-4">
          {loading ? (
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-gray-600">
              <FileQuestion className="h-5 w-5" />
              <span>Belum ada transaksi.</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">No</th>
                  <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                  <th className="px-3 py-2 text-left font-medium">Jenis</th>
                  <th className="px-3 py-2 text-left font-medium">Referensi</th>
                  <th className="px-3 py-2 text-left font-medium">Keterangan</th>
                  <th className="px-3 py-2 text-right font-medium">Lines</th>
                </tr>
              </thead>
              <tbody className="text-gray-900">
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-200">
                    <td className="px-3 py-2">
                      <Link
                        href={`/gudang/transaksi/${r.id}`}
                        className="font-medium text-indigo-700 underline-offset-2 hover:underline"
                      >
                        {r.no}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{fmtDate(r.tanggal)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-xs font-semibold ring-1 ${chipTone(
                          r.jenis
                        )}`}
                      >
                        {r.jenis}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.referensi || "-"}</td>
                    <td className="px-3 py-2">{r.keterangan || "-"}</td>
                    <td className="px-3 py-2 text-right">{r.lines}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 px-4 py-3">
          <Link
            href="/gudang/transaksi"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Lihat Semua
          </Link>
        </div>
      </div>
    </div>
  );
}
