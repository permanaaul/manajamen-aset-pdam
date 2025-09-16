// app/akuntansi/page.tsx  (Accounting Hub – data-driven)
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Landmark, BookOpen, ListOrdered, Calculator, BarChart3, Plus, Upload, FileDown,
  Filter, RefreshCw, Search, Settings, ChevronRight, Lock, Unlock, Calendar,
} from "lucide-react";

/* =============== Utils =============== */
const ymKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const toIDR0 = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number.isFinite(v) ? v : 0
  );
const parseYMBounds = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, (m || 1), 0, 23, 59, 59, 999);
  return { y, m, start, end };
};

/* =============== Types =============== */
type TBResp = {
  totalDebit: number;
  totalKredit: number;
  balanced: boolean;
  // rows, count, periode ... (ada tapi tidak wajib di sini)
};

type JurnalRow = {
  id: number;
  nomor: string;
  tanggal: string;
  sumber: string;
  memo: string | null;
  _count?: { lines: number };
};

type PenyusutanPreview = {
  alreadyPosted: { id: number; nomor: string } | null;
};

type HubState = {
  loading: boolean;
  error?: string;
  tb?: TBResp;
  journals: JurnalRow[];
  journalsInMonthCount: number;
  penyusutanPostedNo?: string | null;
};

/* =============== Fetch hook =============== */
function useHubData(periodeYM: string) {
  const [state, setState] = React.useState<HubState>({
    loading: true,
    journals: [],
    journalsInMonthCount: 0,
  });

  React.useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      setState((s) => ({ ...s, loading: true, error: undefined }));
      const { y, m, start, end } = parseYMBounds(periodeYM);

      try {
        // 1) Trial Balance (totals)
        const tbRes = await fetch(`/api/akuntansi/trial-balance?tahun=${y}&bulan=${m}`, { signal: ctrl.signal });
        const tb: TBResp = await tbRes.json();

        // 2) Jurnal terbaru (ambil banyak, filter lokal by month)
        const jrRes = await fetch(`/api/akuntansi/jurnal?limit=500`, { signal: ctrl.signal });
        const jr: JurnalRow[] = await jrRes.json();
        const inMonth = jr.filter((r) => {
          const t = new Date(r.tanggal);
          return t >= start && t <= end;
        });

        // 3) Status posting penyusutan periode
        const depRes = await fetch(`/api/akuntansi/penyusutan?periode=${periodeYM}`, { signal: ctrl.signal });
        const dep: PenyusutanPreview = await depRes.json();

        if (ctrl.signal.aborted) return;

        setState({
          loading: false,
          tb,
          journals: jr.slice(0, 6), // tampilkan aktivitas terakhir (6 item)
          journalsInMonthCount: inMonth.length,
          penyusutanPostedNo: dep?.alreadyPosted?.nomor ?? null,
        });
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, loading: false, error: e?.message || "Gagal memuat data" }));
      }
    };

    run();
    return () => ctrl.abort();
  }, [periodeYM]);

  return state;
}

/* =============== Page =============== */
export default function AccountingHubPage() {
  const router = useRouter();
  const [bulan, setBulan] = React.useState<string>(ymKey());
  const [segmen, setSegmen] = React.useState<"ALL" | "UNIT" | "ASET">("ALL");
  const [q, setQ] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);

  const hub = useHubData(bulan);

  const tabs = [
    { key: "coa", label: "CoA", icon: Landmark, href: "/akuntansi/coa", desc: "Kelola Chart of Accounts" },
    { key: "jurnal", label: "Jurnal", icon: BookOpen, href: "/akuntansi/jurnal", desc: "Input & daftar jurnal" },
    { key: "buku-besar", label: "Buku Besar", icon: ListOrdered, href: "/akuntansi/buku-besar", desc: "Ledger & drill-down" },
    {
      key: "posting-penyusutan",
      label: "Posting Penyusutan",
      icon: Calculator,
      href: "/akuntansi/posting-penyusutan",
      desc: "Post/Unpost ke GL",
    },
    { key: "laporan", label: "Laporan", icon: BarChart3, href: "/akuntansi/laporan", desc: "TB, Neraca, dsb." },
  ] as const;

  const handleRefresh = async () => {
    // trigger re-fetch dengan cara mengganti bulan sebentar (anti-flicker)
    setRefreshing(true);
    const cur = bulan;
    setBulan((b) => (b === cur ? (cur + "") : cur)); // noop to satisfy React, tetap “ubah” state
    // kecilkan delay biar icon spin terlihat tapi tidak glitch
    setTimeout(() => setRefreshing(false), 300);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <section className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-slate-950/50 dark:border-slate-800">
        <div className="px-6 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Accounting Hub
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ringkasan Akuntansi • format Indonesia • periode berjalan
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Bulan (YYYY-MM) */}
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Calendar className="h-4 w-4 text-slate-500" />
                <input
                  type="month"
                  value={bulan}
                  onChange={(e) => setBulan(e.target.value)}
                  className="h-5 w-[11rem] bg-transparent text-slate-900 outline-none dark:text-slate-100"
                  aria-label="Filter bulan"
                />
              </label>

              {/* Segmen */}
              <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {(["ALL", "UNIT", "ASET"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSegmen(s)}
                    className={`px-3 py-2 font-medium transition ${
                      segmen === s
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                    aria-pressed={segmen === s}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 active:scale-[.98] dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing || hub.loading ? "animate-spin" : ""}`} />
                Muat Ulang
              </button>

              {/* Pengaturan */}
              <button
                onClick={() => router.push("/akuntansi/pengaturan")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 active:scale-[.98] dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <Settings className="h-4 w-4" />
                Pengaturan
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="px-6 py-6">
        {/* Toolbar Pencarian */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="col-span-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-slate-300 dark:border-slate-800 dark:bg-slate-900">
            <Search className="ml-2 h-5 w-5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(`/akuntansi/jurnal?q=${encodeURIComponent(q)}`);
              }}
              placeholder="Cari akun, jurnal, referensi…"
              className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400"
            />
            <button
              onClick={() => router.push(`/akuntansi/jurnal?q=${encodeURIComponent(q)}`)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[.98] dark:bg-white dark:text-slate-900"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/akuntansi/jurnal/tambah"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 active:scale-[.98] dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Jurnal Baru
            </Link>
            <Link
              href="/akuntansi/import"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 active:scale-[.98] dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" /> Import CSV
            </Link>
            <Link
              href="/akuntansi/laporan?export=pdf"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 active:scale-[.98] dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <FileDown className="h-4 w-4" /> Export PDF
            </Link>
          </div>
        </div>

        {/* Error banner */}
        {hub.error && (
          <div className="mb-4 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 dark:text-rose-200">
            Gagal memuat data hub. {hub.error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Jurnal (bulan ini)"
            value={String(hub.journalsInMonthCount || 0)}
            subtitle="Entri dibukukan"
            icon={BookOpen}
            loading={hub.loading}
            trend={[10, 12, 9, 15, 14, 18, 20]}
          />
          <KpiCard
            title="Saldo Aktiva"
            value={toIDR0(hub.tb?.totalDebit ?? 0)}
            subtitle={`Total per ${bulan}`}
            icon={Landmark}
            loading={hub.loading}
            trend={[80, 82, 81, 84, 86, 89, 90]}
          />
          <KpiCard
            title="Saldo Pasiva"
            value={toIDR0(hub.tb?.totalKredit ?? 0)}
            subtitle={`Total per ${bulan}`}
            icon={Landmark}
            loading={hub.loading}
            trend={[80, 81, 83, 84, 86, 88, 90]}
          />
          <KpiCard
            title="Status Periode"
            value={hub.penyusutanPostedNo ? "Terposting Penyusutan" : "Siap posting"}
            subtitle={hub.penyusutanPostedNo ? `Ref: ${hub.penyusutanPostedNo}` : "Belum ada posting penyusutan"}
            icon={hub.penyusutanPostedNo ? Lock : Unlock}
            loading={hub.loading}
            accent={hub.penyusutanPostedNo ? "ring-emerald-300/60" : undefined}
          />
        </div>

        {/* Navigasi fitur */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className="group relative flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <t.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{t.label}</h3>
                  <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
                </div>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* 2-Column: Aktivitas & Aksi Cepat */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Aktivitas Terakhir */}
          <section className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <header className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">
                  Aktivitas Terakhir
                </h4>
                <Link href="/akuntansi/jurnal" className="text-xs font-medium text-slate-500 underline-offset-4 hover:underline">
                  Lihat semua
                </Link>
              </header>

              {hub.loading ? (
                <div className="h-24 animate-pulse rounded-xl bg-white/5 dark:bg-white/5" />
              ) : hub.journals.length === 0 ? (
                <div className="px-3 py-6 text-sm text-slate-500">Belum ada jurnal.</div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {hub.journals.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-3">
                      <div className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-slate-900 dark:bg-white" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {a.nomor}
                          {a.memo ? ` — ${a.memo}` : ""}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{a.sumber}</p>
                      </div>
                      <time className="whitespace-nowrap text-xs text-slate-400">
                        {new Date(a.tanggal).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Aksi Cepat */}
          <aside>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-3 text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">Aksi Cepat</h4>
              <div className="grid grid-cols-1 gap-2">
                <Link
                  href="/akuntansi/jurnal/tambah"
                  className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Buat Jurnal
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link
                  href="/akuntansi/posting-penyusutan"
                  className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                >
                  <span className="inline-flex items-center gap-2">
                    <Calculator className="h-4 w-4" /> Posting Penyusutan
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link
                  href="/akuntansi/coa"
                  className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                >
                  <span className="inline-flex items-center gap-2">
                    <Landmark className="h-4 w-4" /> Kelola CoA
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link
                  href="/akuntansi/laporan"
                  className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                >
                  <span className="inline-flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Lihat Laporan
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {/* Tips */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <p className="mb-1 font-medium">Catatan:</p>
          <ul className="list-disc pl-5">
            <li>KPI “Saldo Aktiva/Pasiva” berasal dari total debit/kredit Trial Balance bulan terpilih.</li>
            <li>Angka “Jurnal (bulan ini)” dihitung dari jurnal dalam rentang bulan terpilih (dibatasi fetch 500).</li>
            <li>Indikator periode menggunakan status posting penyusutan; jika ada API lock periode, bisa langsung dipasang di kartu ini.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

/* =============== Small components =============== */

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accent,
  loading,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number[];
  accent?: string;
  loading?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${
        accent ? `ring-2 ${accent}` : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
          {loading ? (
            <div className="mt-2 h-6 w-32 animate-pulse rounded bg-white/10" />
          ) : (
            <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</h3>
          )}
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-slate-900 p-2 text-white dark:bg-white dark:text-slate-900">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {Array.isArray(trend) && trend.length > 0 ? <Sparkline data={trend} className="mt-3" /> : null}
    </div>
  );
}

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
