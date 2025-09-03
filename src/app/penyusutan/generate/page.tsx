"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Calendar, Eye, Save, Loader2, Search, Factory } from "lucide-react";
import useToast from "@/components/Toast";

/* ===== Types ===== */
type AsetPick = { id: number; nia: string; nama: string; lokasi?: string | null };

type PreviewRow = {
  periode: string; // ISO
  metode: string;  // "GARIS_LURUS" | "SALDO_MENURUN"
  basis: "MONTHLY" | "YEARLY";
  tarif: number;   // %/tahun
  nilaiAwal: number;
  beban: number;
  akumulasi: number;
  nilaiAkhir: number;
};

/* ===== Helpers & Constants ===== */
const MAX_MONTHS = 120; // 10 tahun
const MAX_YEARS  = 50;  // 50 tahun

const fmtRp = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

const fmtYM = (s: string) => {
  try {
    return new Date(s).toLocaleDateString("id-ID", { year: "numeric", month: "short" });
  } catch {
    return s;
  }
};

const classIpt =
  "h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

// ===== Helpers basis =====
type UiBasis = "MONTHLY" | "YEARLY";

const toApiBasis = (b: UiBasis) => (b === "MONTHLY" ? "BULANAN" : "TAHUNAN");

const toUiBasis = (b: unknown): UiBasis => {
  const x = String(b || "").toUpperCase();
  if (x === "MONTHLY" || x === "BULANAN") return "MONTHLY";
  if (x === "YEARLY"  || x === "TAHUNAN") return "YEARLY";
  return "MONTHLY";
};

const basisLabel = (b: UiBasis) => (b === "MONTHLY" ? "Bulanan" : "Tahunan");

// Normalisasi response API -> PreviewRow
function normalizeRows(arr: any[]): PreviewRow[] {
  return (arr || []).map((r: any) => {
    const basis = toUiBasis(r.basis);
    const periodeIso =
      typeof r.periode === "string"
        ? r.periode
        : new Date(r.periode).toISOString();

    return {
      periode: periodeIso,
      metode: String(r.metode || ""),
      basis,                                     // <-- simpan kode, bukan label
      tarif: Number(r.tarif) || 0,
      nilaiAwal: Number(r.nilaiAwal) || 0,
      beban: Number(r.beban) || 0,
      akumulasi: Number(r.akumulasi) || 0,
      nilaiAkhir: Number(r.nilaiAkhir) || 0,
    };
  });
}

// diff bulan inklusif (Jan–Mar = 3), asumsi kedua tanggal sudah yyyy-mm-01
function monthsDiffInclusive(a: Date, b: Date) {
  const m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return m + 1;
}
// diff tahun inklusif (2020–2022 = 3)
function yearsDiffInclusive(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) + 1;
}

export default function PenyusutanGeneratePage() {
  const router = useRouter();
  const { View, push } = useToast();

  /* ===== Asset Picker ===== */
  const [q, setQ] = React.useState("");
  const [listAset, setListAset] = React.useState<AsetPick[]>([]);
  const [aset, setAset] = React.useState<AsetPick | null>(null);

  const findAset = React.useCallback(async () => {
    const sp = new URLSearchParams({ type: "aset", limit: "50" });
    if (q) sp.set("q", q);

    const res = await fetch(`/api/aset/lookup?${sp.toString()}`, { cache: "no-store" });
    const d = await res.json();
    const rows: AsetPick[] = Array.isArray(d?.rows) ? d.rows : [];
    setListAset(rows);
    if (!aset && rows.length > 0) setAset(rows[0]);
  }, [q, aset]);

  React.useEffect(() => { findAset(); }, [findAset]);

  /* ===== Form ===== */
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().substring(0, 10);

  const [basis, setBasis] = React.useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [from, setFrom] = React.useState(iso(thisMonth));
  const [to, setTo] = React.useState(iso(thisMonth));
  const [metodeOverride, setMetodeOverride] =
    React.useState<"" | "GARIS_LURUS" | "SALDO_MENURUN">("");
  const [tarifOverride, setTarifOverride] = React.useState<number | "">("");

  /* ===== Preview State ===== */
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<PreviewRow[]>([]);
  const totalBeban = React.useMemo(
    () => rows.reduce((s, r) => s + (Number(r.beban) || 0), 0),
    [rows]
  );

  /* ===== Validation ===== */
  const validateRange = (): boolean => {
    const dFrom = new Date(from);
    const dTo   = new Date(to);
    if (Number.isNaN(dFrom.getTime()) || Number.isNaN(dTo.getTime())) {
      push("Tanggal tidak valid.", "err");
      return false;
    }
    if (dFrom > dTo) {
      push("Rentang periode tidak valid: tanggal 'Dari' > 'Sampai'.", "err");
      return false;
    }

    if (basis === "MONTHLY") {
      const months = monthsDiffInclusive(
        new Date(dFrom.getFullYear(), dFrom.getMonth(), 1),
        new Date(dTo.getFullYear(),   dTo.getMonth(),   1)
      );
      if (months > MAX_MONTHS) {
        push(`Rentang terlalu panjang untuk basis bulanan: ${months} bulan (maks ${MAX_MONTHS}). Kecilkan rentangnya.`, "err");
        return false;
      }
    } else {
      const years = yearsDiffInclusive(
        new Date(dFrom.getFullYear(), 0, 1),
        new Date(dTo.getFullYear(),   0, 1)
      );
      if (years > MAX_YEARS) {
        push(`Rentang terlalu panjang untuk basis tahunan: ${years} tahun (maks ${MAX_YEARS}). Kecilkan rentangnya.`, "err");
        return false;
      }
    }
    return true;
  };

  /* ===== Actions ===== */
  const preview = async () => {
    if (!aset?.id) { push("Pilih aset terlebih dulu.", "err"); return; }
    if (!validateRange()) return;

    setLoading(true);
    setRows([]);

    try {
      const body: any = { basis: toApiBasis(basis), from, to };
      if (metodeOverride) body.metodeOverride = metodeOverride;
      if (tarifOverride !== "" && Number(tarifOverride) > 0) body.tarifOverride = Number(tarifOverride);

      const res = await fetch(`/api/aset/${aset.id}/penyusutan/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal preview penyusutan");

      const normalized = normalizeRows(d?.rows || []);
      setRows(normalized);
      if (normalized.length === 0) push("Tidak ada periode di rentang yang dipilih.", "err");
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setLoading(false);
    }
  };

  const generateNow = async () => {
    if (!aset?.id) { push("Pilih aset terlebih dulu.", "err"); return; }
    if (!validateRange()) return;

    setLoading(true);
    try {
      const body: any = { basis: toApiBasis(basis), from, to };
      if (metodeOverride) body.metodeOverride = metodeOverride;
      if (tarifOverride !== "" && Number(tarifOverride) > 0) body.tarifOverride = Number(tarifOverride);

      const res = await fetch(`/api/aset/${aset.id}/penyusutan/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal generate penyusutan");

      const info = d?.created ?? d?.count ?? rows.length;
      push(`✅ ${info} baris penyusutan berhasil dibuat.`, "ok");
      router.push("/penyusutan");
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setLoading(false);
    }
  };

  /* ===== UI ===== */
  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight flex items-center gap-2">
            <Factory className="h-6 w-6 text-indigo-600" />
            Generate Penyusutan
          </h1>
          <p className="text-[13px] text-gray-700">
            Buat jurnal penyusutan untuk satu aset dalam rentang periode. Kamu bisa memakai tarif & metode default
            dari aset, atau menimpa dengan <b>custom tarif %/tahun</b> dan/atau <b>metode</b> di bawah.
          </p>
        </div>
        <Link href="/penyusutan" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" /> Kembali
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        {/* Kiri: pilih aset */}
        <div className="md:col-span-5 rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="text-sm font-bold uppercase text-gray-800">Pilih Aset</div>

          <div className="flex gap-2">
            <input
              className={classIpt}
              placeholder="Ketik NIA / Nama aset / Lokasi"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findAset()}
            />
            <button onClick={findAset} className="h-11 inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 hover:bg-gray-50">
              <Search className="h-4 w-4" /> Cari
            </button>
          </div>

          <div className="mt-2 max-h-60 overflow-auto rounded-xl border">
            {listAset.map((a) => (
              <button
                key={a.id}
                onClick={() => setAset(a)}
                className={`w-full px-3 py-2 text-left hover:bg-indigo-50 ${aset?.id === a.id ? "bg-indigo-50" : ""}`}
              >
                <div className="font-semibold">{a.nia}</div>
                <div className="text-xs text-gray-700">{a.nama}{a.lokasi ? ` — ${a.lokasi}` : ""}</div>
              </button>
            ))}
            {listAset.length === 0 && <div className="px-3 py-6 text-gray-600 text-sm">Tidak ada data.</div>}
          </div>

          <div className="mt-3 rounded-xl border p-3 bg-gray-50 text-sm">
            <div className="font-semibold mb-1">Aset terpilih</div>
            {aset ? (
              <>
                <div>NIA: <b>{aset.nia}</b></div>
                <div>Nama: <b>{aset.nama}</b></div>
                <div>Lokasi: <b>{aset.lokasi || "-"}</b></div>
              </>
            ) : "—"}
          </div>
        </div>

        {/* Kanan: parameter & preview */}
        <div className="md:col-span-7 rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="text-sm font-bold uppercase text-gray-800">Parameter</div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-sm font-semibold">Basis</div>
              <select className={classIpt} value={basis} onChange={(e) => setBasis(e.target.value as any)}>
                <option value="MONTHLY">Bulanan (GL tiap bulan)</option>
                <option value="YEARLY">Tahunan</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="mb-1 text-sm font-semibold">Dari (periode)</div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="date" className={`${classIpt} pl-9`} value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
              </label>
              <label className="block">
                <div className="mb-1 text-sm font-semibold">Sampai (periode)</div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="date" className={`${classIpt} pl-9`} value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </label>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-sm font-semibold">Override Metode (opsional)</div>
              <select className={classIpt} value={metodeOverride} onChange={(e) => setMetodeOverride(e.target.value as any)}>
                <option value="">— pakai dari aset —</option>
                <option value="GARIS_LURUS">GARIS LURUS</option>
                <option value="SALDO_MENURUN">SALDO MENURUN</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-semibold">Override Tarif %/tahun (opsional)</div>
              <input
                type="number"
                className={classIpt}
                placeholder="mis. 20"
                value={tarifOverride}
                onChange={(e) => setTarifOverride(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={preview}
              disabled={loading || !aset}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview
            </button>
            <button
              onClick={generateNow}
              disabled={loading || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Generate
            </button>
          </div>

          <div className="rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-700">
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
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-600">Belum ada data preview.</td></tr>
                )}
                {!loading && rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{fmtYM(r.periode)}</td>
                    <td className="px-3 py-2">{r.metode.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2">{basisLabel(r.basis)}</td>
                    <td className="px-3 py-2 text-right">{(Number(r.tarif) || 0).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right">{fmtRp(Number(r.nilaiAwal) || 0)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtRp(Number(r.beban) || 0)}</td>
                    <td className="px-3 py-2 text-right">{fmtRp(Number(r.akumulasi) || 0)}</td>
                    <td className="px-3 py-2 text-right">{fmtRp(Number(r.nilaiAkhir) || 0)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-3 py-2" colSpan={5}></td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtRp(totalBeban)}</td>
                    <td className="px-3 py-2" colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="text-xs text-gray-600">
            Catatan: jika aset memakai <b>SALDO MENURUN</b>, beban menurun tiap periode.
            Jika <b>TAHUNAN</b>, sistem membuat 1 baris per tahun. Override tarif/metode hanya
            berlaku untuk proses generate ini (tidak mengubah master aset).
          </div>
        </div>
      </div>
    </div>
  );
}
