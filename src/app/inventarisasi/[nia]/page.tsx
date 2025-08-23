"use client";

import { useEffect, useState, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Package,
  MapPin,
  Calendar,
  Coins,
  BadgeCheck,
  AlertTriangle,
  ArrowLeft,
  Pencil,
  Trash2,
  Barcode,
  Copy as CopyIcon,
  StickyNote,
  Clock,
} from "lucide-react";
import { type KategoriAset } from "@/app/constants/kategoriAset";

// ➜ Card penyusutan (di dalamnya ada tombol Posting per-baris)
const PenyusutanCard = dynamic(() => import("@/app/components/PenyusutanCard"), { ssr: false });

type Aset = {
  id?: number;
  nama: string;
  kategori: KategoriAset | string;
  nia: string;
  lokasi: string;
  tahun: number;
  nilai: string | number;
  kondisi: "Baik" | "Perlu Cek" | "Rusak" | string;
  catatan?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const labelKategori = (k: string) => k.replace(/_/g, " ");
const rupiah = (v: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(typeof v === "string" ? Number(v) : v);

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function KondisiBadge({ status }: { status: string }) {
  const base = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium";
  switch (status) {
    case "Baik":
      return (
        <span className={`${base} bg-green-100 text-green-700`}>
          <BadgeCheck size={14} /> Baik
        </span>
      );
    case "Perlu Cek":
      return (
        <span className={`${base} bg-yellow-100 text-yellow-700`}>
          <AlertTriangle size={14} /> Perlu Cek
        </span>
      );
    case "Rusak":
      return (
        <span className={`${base} bg-red-100 text-red-700`}>
          <AlertTriangle size={14} /> Rusak
        </span>
      );
    default:
      return <span className={`${base} bg-gray-100 text-gray-600`}>{status}</span>;
  }
}

export default function DetailAset() {
  const { nia } = useParams<{ nia: string }>();
  const router = useRouter();

  const [aset, setAset] = useState<Aset | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // guard
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u = JSON.parse(raw);
    setUser(u);
    if (!["ADMIN", "PETUGAS"].includes(u.role)) router.replace("/forbidden");
  }, [router]);

  // load detail aset
  useEffect(() => {
    const fetchAset = async () => {
      try {
        const res = await fetch(`/api/inventarisasi/${nia}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAset(data);
      } catch {
        setAset(null);
      } finally {
        setLoading(false);
      }
    };
    if (nia) fetchAset();
  }, [nia]);

  const copyNIA = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setToast("NIA disalin ke clipboard");
    } catch {
      setToast("Gagal menyalin NIA");
    } finally {
      setTimeout(() => setToast(null), 1200);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 antialiased">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="h-7 w-64 bg-slate-200 rounded mb-6 animate-pulse" />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-pulse h-64" />
        </div>
      </main>
    );
  }

  if (!aset) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">❌ Aset tidak ditemukan</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 antialiased">
      <div className="max-w-4xl mx-auto px-6 py-8 text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Package className="text-blue-600" size={24} /> Detail Aset
          </h1>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
        </div>

        <div className="space-y-8">
          {/* CARD 1: DETAIL ASET */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-6 pt-6">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Chip className="bg-blue-50 text-blue-700">{labelKategori(String(aset.kategori))}</Chip>
                <KondisiBadge status={aset.kondisi} />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">{aset.nama}</h2>
              <p className="text-sm text-slate-500 mt-1">Nomor Induk Aset (NIA) &amp; detail umum</p>
            </div>

            <div className="px-6 py-6 text-[15px]">
              <dl className="divide-y divide-slate-100">
                {[
                  {
                    icon: <Barcode size={18} className="text-slate-500" />,
                    label: "NIA",
                    content: (
                      <span className="flex items-center gap-2">
                        <span className="font-mono">{aset.nia}</span>
                        <button
                          onClick={() => copyNIA(aset.nia)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                        >
                          <CopyIcon size={14} /> Salin
                        </button>
                      </span>
                    ),
                  },
                  { icon: <MapPin size={18} className="text-slate-500" />, label: "Lokasi", content: aset.lokasi },
                  { icon: <Calendar size={18} className="text-slate-500" />, label: "Tahun Perolehan", content: aset.tahun },
                  { icon: <Coins size={18} className="text-slate-500" />, label: "Nilai Perolehan", content: rupiah(aset.nilai) },
                  ...(aset.catatan
                    ? [
                        {
                          icon: <StickyNote size={18} className="text-slate-500" />,
                          label: "Catatan",
                          content: aset.catatan,
                        },
                      ]
                    : []),
                  {
                    icon: <Clock size={18} className="text-slate-500" />,
                    label: "Riwayat",
                    content: (
                      <span className="text-sm text-slate-600">
                        {aset.createdAt && <>Dibuat: {new Date(aset.createdAt).toLocaleString("id-ID")}</>}
                        {aset.createdAt && aset.updatedAt && " • "}
                        {aset.updatedAt && <>Diubah: {new Date(aset.updatedAt).toLocaleString("id-ID")}</>}
                      </span>
                    ),
                  },
                ].map((row, i) => (
                  <Fragment key={i}>
                    <div className="grid grid-cols-12 py-3">
                      <dt className="col-span-12 md:col-span-4 flex items-center gap-2 text-sm font-medium text-slate-600">
                        {row.icon}
                        {row.label}
                      </dt>
                      <dd className="col-span-12 md:col-span-8 mt-1 md:mt-0">{row.content}</dd>
                    </div>
                  </Fragment>
                ))}
              </dl>
            </div>

            {user?.role === "ADMIN" && (
              <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-2xl">
                <Link
                  href={`/inventarisasi/${aset.nia}/edit`}
                  className="inline-flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition"
                >
                  <Pencil size={16} /> Edit
                </Link>
                <button
                  onClick={async () => {
                    if (!confirm("Yakin ingin menghapus aset ini?")) return;
                    const res = await fetch(`/api/inventarisasi/${aset.nia}`, { method: "DELETE" });
                    if (res.ok) {
                      setToast("✅ Aset berhasil dihapus");
                      setTimeout(() => router.push("/inventarisasi"), 700);
                    } else {
                      setToast("❌ Gagal menghapus aset");
                      setTimeout(() => setToast(null), 1200);
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
                >
                  <Trash2 size={16} /> Hapus
                </button>
              </div>
            )}
          </section>

          {/* CARD 2: PENYUSUTAN */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Penyusutan Aset</h3>
              {/* Tombol posting berada per-baris di dalam tabel PenyusutanCard */}
            </div>
            <div className="p-5">
              {aset.id ? (
                <PenyusutanCard asetId={aset.id} asetNama={aset.nama} />
              ) : (
                <p className="text-sm text-slate-700">
                  ID aset tidak tersedia, penyusutan tidak bisa ditampilkan.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-black/90 text-white text-sm px-3 py-2 rounded-md shadow">
          {toast}
        </div>
      )}
    </main>
  );
}
