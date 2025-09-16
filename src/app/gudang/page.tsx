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
  ChevronRight,
  Search,
  LayoutGrid,
  AlertTriangle,
  CircleDot,
  ChevronDown,
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
  if (jenis === "IN") return "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20";
  if (jenis === "OUT") return "bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/20";
  if (jenis === "ADJ") return "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/20";
  return "bg-slate-400/10 text-slate-300 ring-1 ring-white/10";
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** Normalisasi row agar kompatibel API lama/baru */
function normalizeRows(input: any[]): Row[] {
  return (input || []).map((r: any) => {
    const no = r.noTransaksi ?? r.nomor ?? "-";
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

/** Sparkline mini chart (reusable) */
function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const norm = (v: number) => ((v - min) / Math.max(1, max - min)) * 28 + 2; // 2..30 px
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${32 - norm(v)}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={`h-10 w-full ${className}`}>
      <polyline fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" points={points} />
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

/** Small progress */
function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-white/60" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/** Cards */
function GlassCard({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/7.5 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ title, value, icon, hint, spark }: { title: string; value: number | string; icon: React.ReactNode; hint?: string; spark?: number[] }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] font-medium text-slate-300/90">{title}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</div>
          {hint ? <div className="mt-1 text-[11px] text-slate-400">{hint}</div> : null}
        </div>
        <div className="rounded-xl bg-white/10 p-2 text-white">{icon}</div>
      </div>
      {spark ? <Sparkline data={spark} className="mt-3 text-white/70" /> : null}
    </GlassCard>
  );
}

function QuickCard({ title, desc, href, className = "" }: { title: string; desc: string; href: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`group relative block rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm ring-1 ring-transparent transition hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-300/20 backdrop-blur supports-[backdrop-filter]:bg-white/7.5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white">{title}</div>
        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-300">{desc}</p>
    </Link>
  );
}

export default function GudangHome() {
  const router = useRouter();
  const { push, View } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [count, setCount] = React.useState(0);
  const [tipe, setTipe] = React.useState<"ALL" | "IN" | "OUT" | "ADJ">("ALL");
  const [q, setQ] = React.useState("");
  const [dense, setDense] = React.useState(false);

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

  React.useEffect(() => { load(); }, [load]);

  const rowsFiltered = rows.filter((r) => (tipe === "ALL" ? true : r.jenis === tipe) && (q ? (r.no + r.referensi + r.keterangan).toLowerCase().includes(q.toLowerCase()) : true));

  const totalIN = rows.filter((r) => r.jenis === "IN").length;
  const totalOUT = rows.filter((r) => r.jenis === "OUT").length;
  const totalADJ = rows.filter((r) => r.jenis === "ADJ").length;
  const totalTxn = rows.length;
  const totalLines = rows.reduce((a, b) => a + (b.lines || 0), 0);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto w-full max-w-none px-6 py-6">
        <View />

        {/* Sticky sub-header */}
        <div className="sticky top-0 z-10 -mx-6 mb-4 border-b border-white/10 bg-slate-950/70 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-slate-950/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white">
                <Boxes className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-semibold">Gudang</h1>
                <p className="text-[12px] text-slate-400">Ringkasan aktivitas & navigasi cepat</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm shadow-sm">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no/ref/keterangan…" className="h-5 w-[14rem] bg-transparent text-slate-100 outline-none placeholder:text-slate-400" />
              </label>

              {/* Segmented type */}
              <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/5 text-xs">
                {["ALL", "IN", "OUT", "ADJ"].map((s) => (
                  <button key={s} onClick={() => setTipe(s as typeof tipe)} className={`px-3 py-2 font-medium transition ${tipe === s ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"}`} aria-pressed={tipe === s}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Density toggle */}
              <button onClick={() => setDense((d) => !d)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm shadow-sm transition hover:bg-white/10">
                <LayoutGrid className="h-4 w-4" />
                {dense ? "Rapat" : "Legang"}
              </button>

              <Link href="/gudang/transaksi/tambah" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-medium text-slate-900 shadow-sm ring-1 ring-black/10 transition hover:opacity-90 active:scale-[.98]">
                <PlusCircle className="h-4 w-4" /> Buat Transaksi
              </Link>
            </div>
          </div>
        </div>

        {/* GRID 12 cols: main + aside */}
        <div className="grid grid-cols-12 gap-4">
          {/* MAIN */}
          <div className="col-span-12 xl:col-span-9 space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 sm:col-span-6 lg:col-span-3"><StatCard title="Transaksi Masuk" value={totalIN} icon={<PackagePlus className="h-5 w-5" />} spark={[4,6,5,7,9,8,12]} /></div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-3"><StatCard title="Transaksi Keluar" value={totalOUT} icon={<PackageMinus className="h-5 w-5" />} spark={[5,3,4,6,4,5,7]} /></div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-3"><StatCard title="Penyesuaian" value={totalADJ} icon={<Scale className="h-5 w-5" />} spark={[1,2,1,3,2,1,2]} /></div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-3"><StatCard title="Total Entri" value={totalTxn} icon={<ClipboardList className="h-5 w-5" />} hint={`${totalLines} total baris`} /></div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4"><QuickCard title="Transaksi" desc="Kelola transaksi masuk, keluar & penyesuaian." href="/gudang/transaksi" /></div>
              <div className="col-span-12 md:col-span-4"><QuickCard title="Master Item" desc="Data barang & atributnya." href="/gudang/item" /></div>
              <div className="col-span-12 md:col-span-4"><QuickCard title="Satuan" desc="Kelola satuan (pcs, m, ltr, dst)." href="/gudang/satuan" /></div>
              <div className="col-span-12"><QuickCard title="Kartu Stok" desc="Riwayat pergerakan per item (Masuk/Keluar/Saldo)." href="/gudang/kartu-stok" /></div>
            </div>

            {/* Recent table */}
            <GlassCard>
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="inline-grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white"><History className="h-5 w-5" /></span>
                <div className="font-semibold text-white">Transaksi Terbaru</div>
                <div className="ml-auto text-sm text-slate-300/90">{rowsFiltered.length} dari {count}</div>
              </div>
              <div className="p-4">
                {loading ? (
                  <table className="w-full text-sm"><tbody>{Array.from({ length: 5 }).map((_, i) => (<SkeletonRow key={i} />))}</tbody></table>
                ) : rowsFiltered.length === 0 ? (
                  <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 bg-white/5 px-4 py-10 text-slate-300"><FileQuestion className="h-5 w-5" /><span>Belum ada transaksi.</span></div>
                ) : (
                  <table className={`w-full text-sm ${dense ? "" : "table-fixed"}`}>
                    <thead className="bg-white/5 text-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">No</th>
                        <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                        <th className="px-3 py-2 text-left font-medium">Jenis</th>
                        <th className="px-3 py-2 text-left font-medium">Referensi</th>
                        <th className="px-3 py-2 text-left font-medium">Keterangan</th>
                        <th className="px-3 py-2 text-right font-medium">Lines</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-100">
                      {rowsFiltered.map((r) => (
                        <tr key={r.id} className={`border-t border-white/10 ${dense ? "" : "hover:bg-white/5"}`}>
                          <td className={`px-3 ${dense ? "py-1.5" : "py-2"}`}>
                            <Link href={`/gudang/transaksi/${r.id}`} className="font-medium text-indigo-300 underline-offset-2 hover:underline">{r.no}</Link>
                          </td>
                          <td className={`px-3 ${dense ? "py-1.5" : "py-2"}`}>{fmtDate(r.tanggal)}</td>
                          <td className={`px-3 ${dense ? "py-1.5" : "py-2"}`}>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-xs font-semibold ${chipTone(r.jenis)}`}>{r.jenis}</span>
                          </td>
                          <td className={`px-3 ${dense ? "py-1.5" : "py-2"}`}>{r.referensi || "-"}</td>
                          <td className={`px-3 ${dense ? "py-1.5" : "py-2"}`}>{r.keterangan || "-"}</td>
                          <td className={`px-3 ${dense ? "py-1.5" : "py-2"} text-right`}>{r.lines}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
                <Link href="/gudang/transaksi" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-white/10">
                  <Filter className="h-4 w-4" /> Lihat Semua <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </div>
            </GlassCard>
          </div>

          {/* ASIDE */}
          <aside className="col-span-12 xl:col-span-3 space-y-4">
            {/* Stock health */}
            <GlassCard className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Kesehatan Stok</div>
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="mb-1 flex items-center justify-between"><span className="text-slate-300">Coverage Pergerakan</span><span className="text-slate-200">—</span></div>
                  <Progress value={60} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between"><span className="text-slate-300">Item di Bawah Min</span><span className="text-slate-200">—</span></div>
                  <Progress value={35} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between"><span className="text-slate-300">Akurasi Pencatatan</span><span className="text-slate-200">—</span></div>
                  <Progress value={80} />
                </div>
              </div>
            </GlassCard>

            {/* Top movers (sementara by lines) */}
            <GlassCard className="p-4">
              <div className="mb-3 text-sm font-semibold text-white">Pergerakan Teratas</div>
              <ul className="space-y-2 text-sm">
                {rows
                  .slice(0, 5)
                  .sort((a, b) => (b.lines || 0) - (a.lines || 0))
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CircleDot className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{r.no}</span>
                      </div>
                      <span className="text-xs text-slate-400">{r.lines} lines</span>
                    </li>
                  ))}
              </ul>
            </GlassCard>

            {/* Shortcuts */}
            <GlassCard className="p-4">
              <div className="mb-2 text-sm font-semibold text-white">Aksi Cepat</div>
              <div className="grid grid-cols-1 gap-2">
                <Link href="/gudang/transaksi/tambah" className="inline-flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:bg-white/10">
                  <span className="inline-flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Buat Transaksi</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link href="/gudang/transaksi" className="inline-flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:bg-white/10">
                  <span className="inline-flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Lihat Semua</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </div>
            </GlassCard>
          </aside>
        </div>
      </div>
    </main>
  );
}

/* =========================
 * Skeleton row (dark)
 * ========================= */
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-3 py-3"><div className="h-3 w-28 rounded bg-slate-700/60" /></td>
      <td className="px-3 py-3"><div className="h-3 w-36 rounded bg-slate-700/60" /></td>
      <td className="px-3 py-3"><div className="h-6 w-14 rounded-full bg-slate-700/60" /></td>
      <td className="px-3 py-3"><div className="h-3 w-24 rounded bg-slate-700/60" /></td>
      <td className="px-3 py-3"><div className="h-3 w-40 rounded bg-slate-700/60" /></td>
      <td className="px-3 py-3 text-right"><div className="ml-auto h-3 w-10 rounded bg-slate-700/60" /></td>
    </tr>
  );
}
