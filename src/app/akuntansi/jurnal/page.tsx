// src/app/akuntansi/jurnal/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Notebook,
  Plus,
  RefreshCcw,
  TriangleAlert,
  Filter,
  Search,
  PencilLine,
  X,
  Layers,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Info,
} from "lucide-react";

/* ================= helpers ================= */
const toIDR = (n: number = 0) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);

/** Parse angka yang mungkin berupa string lokal (23.730.468,75 atau 23730468.75) */
function money(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(s);
  return isFinite(n) ? n : 0;
}

const fmtID = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("id-ID") : "-";

const cn = (...c: Array<string | false | null | undefined>) =>
  c.filter(Boolean).join(" ");

/* ================= types (longgar) ================= */
type Kategori = { id: number; nama: string };

type JurnalRow = {
  id: number;
  tanggal?: string;
  ref?: string;
  uraian?: string;
  kategori?: { id?: number; nama?: string } | null;
  debit?: number | string | null;
  kredit?: number | string | null;
  alokasi?: Array<
    | {
        unitBiayaId?: number;
        unitBiaya?: { id?: number; nama?: string } | null;
        nama?: string;
        unit?: { id?: number; nama?: string } | null;
      }
    | any
  >;
};

type SideFilter = "Semua" | "Debit" | "Kredit" | "Keduanya";

/* ================= kecil2 UI ================= */
function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "blue" | "green" | "rose";
}) {
  const toneMap: Record<typeof tone, string> = {
    default: "bg-gray-50 border-gray-200",
    blue: "bg-blue-50 border-blue-100",
    green: "bg-emerald-50 border-emerald-100",
    rose: "bg-rose-50 border-rose-100",
  } as any;
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 flex items-center gap-3",
        toneMap[tone]
      )}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-600">{label}</div>
        <div className="text-lg font-bold text-gray-900 leading-snug">
          {value}
        </div>
        {sub ? (
          <div className="text-xs text-gray-500 leading-snug">{sub}</div>
        ) : null}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

/* ================= page ================= */
export default function JurnalListPage() {
  const router = useRouter();

  // ===== role guard =====
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) {
        router.replace("/login");
        return;
      }
      const u = JSON.parse(raw) as { nama: string; role: string };
      setUser(u);
      const allowed = ["ADMIN", "PIMPINAN"];
      if (!allowed.includes(u.role)) router.replace("/forbidden");
    } catch {
      router.replace("/login");
    }
  }, [router]);

  // ===== data state =====
  const [rows, setRows] = useState<JurnalRow[]>([]);
  const [kategoris, setKategoris] = useState<Kategori[]>([]);
  const [units, setUnits] = useState<Array<{ id: number; nama: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ===== filter state =====
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kategoriId, setKategoriId] = useState<string>("Semua");
  const [unitId, setUnitId] = useState<string>("Semua");
  const [side, setSide] = useState<SideFilter>("Semua");

  // debounce search
  const [qRaw, setQRaw] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(qRaw), 250);
    return () => clearTimeout(t);
  }, [qRaw]);

  // ===== fetch =====
  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setErr("");
    try {
      const [jr, kr, ur] = await Promise.all([
        fetch("/api/akuntansi/jurnal", { cache: "no-store", signal }),
        fetch("/api/akuntansi/kategori-biaya", { cache: "no-store", signal }),
        fetch("/api/akuntansi/unit-biaya", { cache: "no-store", signal }),
      ]);
      if (!jr.ok) throw new Error(`Jurnal: ${jr.status} ${jr.statusText}`);

      const j: JurnalRow[] = await jr.json();
      const k: Kategori[] = kr.ok ? await kr.json() : [];
      const u: Array<{ id: number; nama: string }> = ur.ok ? await ur.json() : [];

      setRows(j);
      setKategoris(k);
      setUnits(u);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        setErr(e?.message || "Gagal memuat jurnal.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  // ===== derived: filtering di client =====
  /** List yang disaring oleh semua filter KECUALI jenis (side) — dipakai untuk hitung breakdown badge */
  const baseFiltered = useMemo(() => {
    let list = [...rows];

    if (from) list = list.filter((r) => (r.tanggal ? r.tanggal.slice(0, 10) >= from : true));
    if (to) list = list.filter((r) => (r.tanggal ? r.tanggal.slice(0, 10) <= to : true));

    if (kategoriId !== "Semua") {
      const idNum = Number(kategoriId);
      list = list.filter((r) => (r.kategori?.id ? Number(r.kategori.id) === idNum : false));
    }

    if (unitId !== "Semua") {
      const idNum = Number(unitId);
      list = list.filter((r) =>
        Array.isArray(r.alokasi)
          ? r.alokasi.some((a) => {
              const viaUnitBiaya = (a as any)?.unitBiaya?.id ?? (a as any)?.unitBiayaId;
              const viaUnit = (a as any)?.unit?.id;
              return Number(viaUnitBiaya ?? viaUnit) === idNum;
            })
          : false
      );
    }

    if (q.trim()) {
      const key = q.toLowerCase();
      list = list.filter((r) => {
        const unitNames = (r.alokasi || [])
          .map((a: any) => a?.unitBiaya?.nama ?? a?.unit?.nama ?? a?.nama ?? "")
          .filter(Boolean)
          .join(", ");
        return (
          (r.ref ?? "-").toLowerCase().includes(key) ||
          (r.uraian ?? "-").toLowerCase().includes(key) ||
          (r.kategori?.nama ?? "-").toLowerCase().includes(key) ||
          unitNames.toLowerCase().includes(key)
        );
      });
    }

    return list.sort((a, b) => (a.tanggal ?? "").localeCompare(b.tanggal ?? ""));
  }, [rows, from, to, kategoriId, unitId, q]);

  // Hitung komposisi jenis pada baseFiltered (sebelum filter side diterapkan)
  const breakdown = useMemo(() => {
    let drOnly = 0, crOnly = 0, both = 0;
    for (const r of baseFiltered) {
      const d = money(r.debit);
      const k = money(r.kredit);
      if (d > 0 && k === 0) drOnly++;
      else if (k > 0 && d === 0) crOnly++;
      else if (d > 0 && k > 0) both++;
    }
    return { drOnly, crOnly, both };
  }, [baseFiltered]);

  // Terapkan filter jenis (side)
  const filtered = useMemo(() => {
    if (side === "Semua") return baseFiltered;
    return baseFiltered.filter((r) => {
      const d = money(r.debit);
      const k = money(r.kredit);
      if (side === "Debit") return d > 0 && k === 0;
      if (side === "Kredit") return k > 0 && d === 0;
      return d > 0 && k > 0; // Keduanya
    });
  }, [baseFiltered, side]);

  // ===== totals =====
  const totalDebit = useMemo(() => filtered.reduce((s, r) => s + money(r.debit), 0), [filtered]);
  const totalKredit = useMemo(() => filtered.reduce((s, r) => s + money(r.kredit), 0), [filtered]);
  const net = totalDebit - totalKredit;

  const hasAnyFilter =
    !!from || !!to || kategoriId !== "Semua" || unitId !== "Semua" || !!q || side !== "Semua";

  const clearFilters = () => {
    setFrom("");
    setTo("");
    setKategoriId("Semua");
    setUnitId("Semua");
    setSide("Semua");
    setQRaw("");
    setQ("");
  };

  if (!user) {
    return (
      <main className="p-6">
        <div className="animate-pulse text-gray-700">Menyiapkan halaman…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 subpixel-antialiased">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Notebook className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Jurnal Akuntansi
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm text-gray-800"
              title="Muat ulang data"
            >
              <RefreshCcw size={16} /> Refresh
            </button>
            <Link
              href="/akuntansi/jurnal/tambah"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              title="Tambah Jurnal"
            >
              <Plus size={16} />
              Tambah
            </Link>
          </div>
        </div>

        {/* Insight ringkas */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<Layers size={18} className="text-gray-600" />}
            label="Total Entri"
            value={`${filtered.length} / ${rows.length}`}
            sub="Sesuai filter aktif"
          />
          <StatCard
            icon={<ArrowUpRight size={18} className="text-blue-600" />}
            label="Total Debit"
            value={toIDR(totalDebit)}
            tone="blue"
          />
          <StatCard
            icon={<ArrowDownRight size={18} className="text-emerald-600" />}
            label="Total Kredit"
            value={toIDR(totalKredit)}
            tone="green"
          />
          <StatCard
            icon={<Wallet size={18} className={cn(net >= 0 ? "text-emerald-600" : "text-rose-600")} />}
            label="Net (Debit − Kredit)"
            value={toIDR(net)}
            tone={net >= 0 ? "green" : "rose"}
          />
        </section>

        {/* Error */}
        {err && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <TriangleAlert className="shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-semibold">Gagal memuat data</div>
              <div className="text-sm">{err}</div>
            </div>
          </div>
        )}

        {/* Filter Card */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-600" />
              <span className="font-semibold text-gray-900">Filter</span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Info size={14} /> Gunakan kolom “Cari” untuk Ref/Uraian/Kategori/Unit.
              </span>
            </div>
            {hasAnyFilter && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-sm border px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50"
                title="Bersihkan semua filter"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>

          {/* grid: satu baris (responsive) termasuk Jenis Nilai */}
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 items-start">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori</label>
              <select
                value={kategoriId}
                onChange={(e) => setKategoriId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="Semua">Semua</option>
                {kategoris.map((k) => (
                  <option key={k.id} value={k.id.toString()}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Unit Biaya</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="Semua">Semua</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id.toString()}>
                    {u.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cari</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  value={qRaw}
                  onChange={(e) => setQRaw(e.target.value)}
                  placeholder="Ref / Uraian / Kategori / Unit…"
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-gray-400 text-gray-900"
                />
              </div>
            </div>

            {/* Jenis Nilai (sebaris di grid) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Jenis Nilai</label>
              <div className="inline-flex w-full rounded-lg border bg-white overflow-hidden">
                {(["Semua", "Debit", "Kredit", "Keduanya"] as SideFilter[]).map((s, idx) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    className={cn(
                      "px-2.5 py-1.5 text-xs md:text-sm flex-1",
                      idx !== 0 && "border-l",
                      side === s ? "bg-gray-900 text-white" : "hover:bg-gray-50 text-gray-800"
                    )}
                    title={
                      s === "Debit"
                        ? "Hanya baris dengan Debit > 0 & Kredit = 0"
                        : s === "Kredit"
                        ? "Hanya baris dengan Kredit > 0 & Debit = 0"
                        : s === "Keduanya"
                        ? "Baris dengan Debit & Kredit sama-sama terisi"
                        : "Tampilkan semua"
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
              {/* breakdown mini */}
              <div className="mt-1.5 text-[11px] text-gray-600 flex flex-wrap gap-1.5">
                <span>Komposisi:</span>
                <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  DR: {breakdown.drOnly}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  CR: {breakdown.crOnly}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  DR+CR: {breakdown.both}
                </span>
              </div>
            </div>
          </div>

          {/* Chips ringkas filter aktif */}
          {hasAnyFilter && (
            <div className="px-5 pb-5 -mt-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500">Aktif:</span>
                {from && (
                  <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-800">Dari: {from}</span>
                )}
                {to && (
                  <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-800">Sampai: {to}</span>
                )}
                {kategoriId !== "Semua" && (
                  <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-800">
                    Kategori: {kategoris.find((k) => k.id.toString() === kategoriId)?.nama ?? kategoriId}
                  </span>
                )}
                {unitId !== "Semua" && (
                  <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-800">
                    Unit: {units.find((u) => u.id.toString() === unitId)?.nama ?? unitId}
                  </span>
                )}
                {side !== "Semua" && (
                  <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-800">Jenis: {side}</span>
                )}
                {q && <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-800">Cari: “{q}”</span>}
              </div>
            </div>
          )}
        </section>

        {/* Tabel */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Daftar Jurnal</h2>
            <div className="text-sm text-gray-700">
              Menampilkan <b>{filtered.length}</b> dari <b>{rows.length}</b> entri
            </div>
          </div>

          <div className="p-5 overflow-x-auto">
            {loading ? (
              <TableSkeleton />
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-white">
                    <th className="px-3 py-2 text-left whitespace-nowrap font-semibold">Tanggal</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap font-semibold">Ref</th>
                    <th className="px-3 py-2 text-left font-semibold">Uraian</th>
                    <th className="px-3 py-2 text-left font-semibold">Kategori</th>
                    <th className="px-3 py-2 text-left font-semibold">Unit</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap font-semibold">Jenis</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap font-semibold">Debit</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap font-semibold">Kredit</th>
                    <th className="px-3 py-2 text-left font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900">
                  {filtered.length ? (
                    filtered.map((r) => {
                      const unitText =
                        (r.alokasi || [])
                          .map((a: any) => a?.unitBiaya?.nama ?? a?.unit?.nama ?? a?.nama ?? "")
                          .filter(Boolean)
                          .join(", ") || (r.alokasi ? `${r.alokasi.length} unit` : "—");

                      const d = money(r.debit);
                      const k = money(r.kredit);
                      const kind =
                        d > 0 && k === 0 ? "DR" : k > 0 && d === 0 ? "CR" : d > 0 && k > 0 ? "DR+CR" : "-";
                      const kindTone =
                        kind === "DR"
                          ? "bg-blue-50 text-blue-700"
                          : kind === "CR"
                          ? "bg-emerald-50 text-emerald-700"
                          : kind === "DR+CR"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-gray-100 text-gray-700";

                      return (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">{fmtID(r.tanggal)}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono">{r.ref ?? "—"}</td>
                          <td className="px-3 py-2">{r.uraian ?? "—"}</td>
                          <td className="px-3 py-2">{r.kategori?.nama ?? "—"}</td>
                          <td className="px-3 py-2">
                            {unitText ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100">
                                {unitText}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={cn("px-2 py-0.5 rounded-full text-xs", kindTone)}>{kind}</span>
                          </td>
                          <td className="px-3 py-2">{toIDR(d)}</td>
                          <td className="px-3 py-2">{toIDR(k)}</td>
                          <td className="px-3 py-2">
                            <Link
                              href={`/akuntansi/jurnal/${r.id}`}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                              title="Edit jurnal"
                            >
                              <PencilLine size={14} />
                              Edit
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-gray-600">
                          <Notebook size={22} />
                          <div className="font-semibold">Tidak ada jurnal sesuai filter</div>
                          <div className="text-sm">
                            Coba longgarkan rentang tanggal atau bersihkan filter.
                          </div>
                          <div className="pt-2">
                            <button
                              onClick={clearFilters}
                              className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50"
                            >
                              Bersihkan Filter
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Ringkasan total */}
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-gray-900">
                    <td className="px-3 py-2" colSpan={6}>
                      Total
                    </td>
                    <td className="px-3 py-2">{toIDR(totalDebit)}</td>
                    <td className="px-3 py-2">{toIDR(totalKredit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
