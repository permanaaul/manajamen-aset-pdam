"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

/* ========= Types ========= */

type Row = {
  id: number;
  kode: string;
  nama: string;
  type?: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | "CONTRA_ASSET" | "CONTRA_REVENUE";
  normal?: "DEBIT" | "CREDIT";
  parentId?: number | null;
  saldo: number;
};

type NeracaResp = {
  asOf: string;
  filters: {
    period: string | null;
    asOf: string | null;
    unitId: number | null;
    asetId: number | null;
    showZero: boolean;
  };
  sections: {
    assets: Row[];
    liabilities: Row[];
    equity: Row[];
    labaRugi: { kode: string; nama: string; saldo: number };
  };
  totals: {
    assets: number;
    liabilitiesPlusEquity: number;
    balanced: boolean;
    difference?: number;
  };
};

type LkItem = { id: number; label: string };

/* ========= Helpers ========= */

const toIDR = (n = 0) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const fmtID = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("id-ID") : "—";

/* ========= Component ========= */

export default function NeracaPage() {
  // filters
  const [period, setPeriod] = useState<string>(""); // "YYYY-MM"
  const [asOf, setAsOf] = useState<string>(""); // "YYYY-MM-DD"
  const [segment, setSegment] = useState<"ALL" | "UNIT" | "ASET">("ALL");
  const [unitId, setUnitId] = useState<number | "">("");
  const [asetId, setAsetId] = useState<number | "">("");
  const [showZero, setShowZero] = useState<boolean>(false);

  // lookup
  const [unitQ, setUnitQ] = useState("");
  const [asetQ, setAsetQ] = useState("");
  const [unitList, setUnitList] = useState<LkItem[]>([]);
  const [asetList, setAsetList] = useState<LkItem[]>([]);

  // data
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NeracaResp | null>(null);
  const [err, setErr] = useState<string>("");

  const balanced = data?.totals.balanced ?? true;
  const difference = data?.totals.difference ?? 0;

  const fetchLookup = async (type: "unit" | "aset", q: string) => {
    const sp = new URLSearchParams();
    sp.set("type", type);
    if (q.trim()) sp.set("q", q.trim());
    const r = await fetch(`/api/akuntansi/neraca/lookup?${sp.toString()}`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    return (await r.json()) as LkItem[];
  };

  useEffect(() => {
    const to = setTimeout(async () => {
      if (segment === "UNIT") setUnitList(await fetchLookup("unit", unitQ));
      if (segment === "ASET") setAsetList(await fetchLookup("aset", asetQ));
    }, 300);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitQ, asetQ, segment]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const sp = new URLSearchParams();
      if (period) sp.set("period", period);
      else if (asOf) sp.set("asOf", asOf);
      if (segment === "UNIT" && unitId !== "") sp.set("unitId", String(unitId));
      if (segment === "ASET" && asetId !== "") sp.set("asetId", String(asetId));
      if (showZero) sp.set("showZero", "1");

      const r = await fetch(`/api/akuntansi/neraca?${sp.toString()}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as NeracaResp;
      setData(j);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat neraca.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = () => load();

  // Subtotal logic di UI (hanya untuk tampilan)
  const subtotalAsset = useMemo(() => {
    const rows = data?.sections.assets ?? [];
    return rows.reduce(
      (s, r) => s + (r.type === "CONTRA_ASSET" ? -r.saldo : r.saldo),
      0
    );
  }, [data]);

  const subtotalLiability = useMemo(
    () => (data?.sections.liabilities ?? []).reduce((s, r) => s + r.saldo, 0),
    [data]
  );
  const subtotalEquity = useMemo(
    () => (data?.sections.equity ?? []).reduce((s, r) => s + r.saldo, 0),
    [data]
  );

  /* ===== Row component ===== */
  const RowLine = ({ r }: { r: Row }) => (
    <tr className="border-t">
      <td className="px-3 py-2 font-mono text-gray-700 w-[110px]">{r.kode}</td>
      <td className="px-3 py-2 text-gray-900">
        <div className="flex items-center gap-2">
          <span>{r.nama}</span>
          {(r.type === "CONTRA_ASSET" || r.type === "CONTRA_REVENUE") && (
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border">
              kontra
            </span>
          )}
        </div>
      </td>
      <td
        className={
          "px-3 py-2 text-right font-mono " +
          (r.saldo < 0 ? "text-rose-600" : "")
        }
      >
        {toIDR(r.saldo)}
      </td>
    </tr>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Neraca
            </h1>
            <p className="text-sm text-gray-500">
              {segment === "ALL" ? "Semua segmen" : segment === "UNIT" ? "Per Unit" : "Per Aset"}{" "}
              – S.d. <b>{fmtID(data?.asOf)}</b>
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            <Printer size={16} /> Cetak
          </button>
        </div>

        {/* Filter */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Periode (bulan)</label>
              <div className="relative">
                <CalendarDays size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="month"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    if (e.target.value) setAsOf("");
                  }}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"
                />
              </div>
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">atau As-of (tanggal)</label>
              <div className="relative">
                <CalendarDays size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="date"
                  value={asOf}
                  onChange={(e) => {
                    setAsOf(e.target.value);
                    if (e.target.value) setPeriod("");
                  }}
                  disabled={!!period}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900 disabled:opacity-50"
                />
              </div>
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Segmentasi</label>
              <select
                value={segment}
                onChange={(e) => {
                  const v = e.target.value as "ALL" | "UNIT" | "ASET";
                  setSegment(v);
                  setUnitId("");
                  setAsetId("");
                }}
                className="border border-gray-300 rounded-lg px-2 py-2 bg-white text-gray-900 w-full"
              >
                <option value="ALL">Semua</option>
                <option value="UNIT">Per Unit Biaya</option>
                <option value="ASET">Per Aset</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              {segment === "UNIT" && (
                <>
                  <label className="block text-xs text-gray-500 mb-1">Pilih Unit</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      placeholder="Cari unit…"
                      value={unitQ}
                      onChange={(e) => setUnitQ(e.target.value)}
                      className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"
                    />
                  </div>
                  {!!unitList.length && (
                    <div className="mt-1 max-h-40 overflow-auto border rounded-lg bg-white">
                      {unitList.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setUnitId(u.id);
                            setUnitQ(u.label);
                            setUnitList([]);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-gray-50"
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {segment === "ASET" && (
                <>
                  <label className="block text-xs text-gray-500 mb-1">Pilih Aset</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      placeholder="Cari aset…"
                      value={asetQ}
                      onChange={(e) => setAsetQ(e.target.value)}
                      className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"
                    />
                  </div>
                  {!!asetList.length && (
                    <div className="mt-1 max-h-40 overflow-auto border rounded-lg bg-white">
                      {asetList.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setAsetId(a.id);
                            setAsetQ(a.label);
                            setAsetList([]);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-gray-50"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="lg:col-span-3 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showZero}
                  onChange={(e) => setShowZero(e.target.checked)}
                />
                Tampilkan akun saldo 0
              </label>
            </div>

            <div className="lg:col-span-12">
              <button
                onClick={apply}
                className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
              >
                <RefreshCw size={16} /> Terapkan
              </button>
            </div>
          </div>
        </section>

        {/* Hasil */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-600">
                S.d. <b>{fmtID(data?.asOf)}</b>
              </div>
              <span
                className={
                  "text-xs px-2 py-1 rounded-md border " +
                  (balanced
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200")
                }
              >
                {balanced ? "Seimbang" : "Tidak Seimbang"}
              </span>
            </div>

            {err && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2">
                {err}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-3 py-2 text-left w-[110px]">Kode</th>
                    <th className="px-3 py-2 text-left">Akun</th>
                    <th className="px-3 py-2 text-right w-[200px]">Saldo</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900">
                  {/* Aset */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-3 py-2 text-gray-600" colSpan={2}>Aset</td>
                    <td />
                  </tr>
                  {(data?.sections.assets ?? []).length ? (
                    (data?.sections.assets ?? []).map((r) => <RowLine key={r.id} r={r} />)
                  ) : (
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-500 italic" colSpan={3}>
                        (tidak ada akun)
                      </td>
                    </tr>
                  )}
                  <tr className="border-t bg-gray-50">
                    <td className="px-3 py-2 text-gray-700 font-semibold" colSpan={2}>
                      Subtotal Aset
                    </td>
                    <td
                      className={
                        "px-3 py-2 text-right font-mono font-semibold " +
                        (subtotalAsset < 0 ? "text-rose-600" : "")
                      }
                    >
                      {toIDR(subtotalAsset)}
                    </td>
                  </tr>

                  {/* Kewajiban */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-3 py-2 text-gray-600" colSpan={2}>Kewajiban</td>
                    <td />
                  </tr>
                  {(data?.sections.liabilities ?? []).length ? (
                    (data?.sections.liabilities ?? []).map((r) => <RowLine key={r.id} r={r} />)
                  ) : (
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-500 italic" colSpan={3}>
                        (tidak ada akun)
                      </td>
                    </tr>
                  )}
                  <tr className="border-t bg-gray-50">
                    <td className="px-3 py-2 text-gray-700 font-semibold" colSpan={2}>
                      Subtotal Kewajiban
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {toIDR(subtotalLiability)}
                    </td>
                  </tr>

                  {/* Ekuitas */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-3 py-2 text-gray-600" colSpan={2}>Ekuitas</td>
                    <td />
                  </tr>
                  {(data?.sections.equity ?? []).length ? (
                    (data?.sections.equity ?? []).map((r) => <RowLine key={r.id} r={r} />)
                  ) : (
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-500 italic" colSpan={3}>
                        (tidak ada akun)
                      </td>
                    </tr>
                  )}
                  <tr className="border-t bg-gray-50">
                    <td className="px-3 py-2 text-gray-700 font-semibold" colSpan={2}>
                      Subtotal Ekuitas
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {toIDR(subtotalEquity)}
                    </td>
                  </tr>

                  {/* L/R berjalan */}
                  <tr className="border-t bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {data?.sections.labaRugi.kode ?? "LRB"}
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      {data?.sections.labaRugi.nama ?? "Laba (Rugi) Berjalan"}
                    </td>
                    <td
                      className={
                        "px-3 py-2 text-right font-mono " +
                        ((data?.sections.labaRugi.saldo ?? 0) < 0 ? "text-rose-600" : "")
                      }
                    >
                      {toIDR(data?.sections.labaRugi.saldo ?? 0)}
                    </td>
                  </tr>
                </tbody>

                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total Aset
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {toIDR(data?.totals.assets ?? 0)}
                    </td>
                  </tr>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total Kewajiban + Ekuitas
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {toIDR(data?.totals.liabilitiesPlusEquity ?? 0)}
                    </td>
                  </tr>
                  {!balanced && (
                    <tr className="bg-amber-50 font-semibold text-amber-700">
                      <td className="px-3 py-2" colSpan={2}>
                        Selisih
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {toIDR(difference)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            {!balanced ? (
              <div className="mt-3 inline-flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
                <AlertTriangle size={14} />
                Tidak seimbang. Periksa mapping akun, jurnal dan akun kontra.
              </div>
            ) : (
              <div className="mt-3 inline-flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs">
                <CheckCircle2 size={14} />
                Neraca seimbang.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          nav, aside, header, footer, .print\\:hidden { display: none !important; }
        }
      `}</style>
    </main>
  );
}
