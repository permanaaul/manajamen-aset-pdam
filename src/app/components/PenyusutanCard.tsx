"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, CalendarClock, RefreshCw, Info, Pencil, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

/* ================= Types ================= */
type Row = {
  id: number;
  periode: string; // ISO
  metode: "GARIS_LURUS" | "SALDO_MENURUN";
  tarif: string | number;
  nilaiAwal: string | number;
  beban: string | number;
  akumulasi: string | number;
  nilaiAkhir: string | number;
};

type Ringkas = {
  metode?: string | null;
  nilaiBuku?: number | string | null;
  akumulasi?: number | string | null;
  tahunMulai?: number | null;
  umur?: number | null;
  nilaiResidu?: number | string | null;
} | null;

type Kategori = {
  id: number;
  kode: string;
  nama: string;
  tipe?: "BIAYA" | "PENDAPATAN" | "ASET" | null;
  isActive?: boolean | null;
  aktif?: boolean | null;
  // (opsional) kalau API kamu menambahkan field ini, UI tak menggunakannya langsung;
  // kita hanya memberi hint bahwa lawan diambil dari sini saat Posting GL.
  // kreditAkunId?: number | null;
};

/* =============== Helpers =============== */
function rupiah(n: string | number) {
  const v = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v || 0);
}

function isActiveKat(k: Kategori) {
  return typeof k.isActive === "boolean" ? k.isActive : (k.aktif ?? true);
}

function guessDefaultId(list: Kategori[], tipe: "BIAYA" | "ASET", patterns: RegExp[]): number | undefined {
  const pool = list.filter(k => (k.tipe ?? "") === tipe && isActiveKat(k));
  for (const p of patterns) {
    const hit = pool.find(k => p.test(k.kode) || p.test(k.nama));
    if (hit) return hit.id;
  }
  return pool[0]?.id;
}

/* =============== Component =============== */
export default function PenyusutanCard({ asetId, asetNama }: { asetId: number; asetNama?: string }) {
  // data penyusutan
  const [rows, setRows] = useState<Row[]>([]);
  const [ringkas, setRingkas] = useState<Ringkas>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // kategori biaya (hanya BEBAN, opsi 2 -> 1 baris jurnal)
  const [kats, setKats] = useState<Kategori[]>([]);
  const [kategoriBebanId, setKategoriBebanId] = useState<number | "">("");

  // ui state
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const yearOptions = useMemo(() => {
    const around = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => around - 3 + i);
  }, []);

  /* ========== Load penyusutan ========= */
  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/penyusutan/${asetId}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal mengambil data penyusutan");
      setRows((data.rows || []).map((r: any) => ({ ...r, periode: r.periode })));
      setRingkas(data.ringkas ?? null);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asetId]);

  /* ========== Load kategori ========= */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/akuntansi/kategori-biaya", { cache: "no-store", credentials: "include" });
        const j = (await r.json()) as Kategori[];
        const list = Array.isArray(j) ? j : [];
        setKats(list);

        // auto-guess default beban penyusutan
        const defBeban = guessDefaultId(list, "BIAYA", [/penyusutan/i, /\bdep/i, /beban\s*penyusutan/i]);
        if (typeof defBeban === "number") setKategoriBebanId(defBeban);
      } catch {
        // abaikan—UI tetap bisa pilih manual
      }
    })();
  }, []);

  const biayaOptions = useMemo(
    () => kats.filter(k => (k.tipe ?? "") === "BIAYA" && isActiveKat(k)),
    [kats]
  );

  /* ========== Bulk post helper ========= */
  async function previewBulk() {
    const url = `/api/akuntansi/penyusutan/${asetId}/bulk-post?year=${year}`;
    const res = await fetch(url, { cache: "no-store", credentials: "include" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Gagal preview bulk");
    return j as { year: number; total: number; already: number; pending: number; idsPending: number[] };
  }

  async function execBulk(y: number) {
    // Opsi 2: kirim hanya kategoriBebanId (debit); kredit akan dihandle saat Posting GL melalui mapping kreditAkun
    const res = await fetch(`/api/akuntansi/penyusutan/${asetId}/bulk-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        year: y,
        kategoriBebanId: Number(kategoriBebanId),
      }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Gagal bulk-post");
    return j as {
      ok: true;
      year: number;
      posted: number;
      skipped: number;
      errors: Array<{ id: number; message: string }>;
    };
  }

  /* ========== Render ========= */
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-5">
        <div className="text-gray-500">⏳ Memuat penyusutan…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="bg-white rounded-xl shadow p-5">
        <div className="text-red-600">{err}</div>
      </div>
    );
  }

  const canPost = Number(kategoriBebanId) > 0 && !busy;

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-700 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Penyusutan Aset{asetNama ? <span className="text-slate-500">&nbsp;— {asetNama}</span> : null}
        </h2>

        <a
          href={`/penyusutan?asetId=${asetId}`}
          className="text-sm text-blue-600 hover:underline"
          title="Lihat halaman penyusutan lengkap"
        >
          Lihat semua »
        </a>
      </div>

      {/* Ringkasan atas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500 flex items-center gap-2"><Info className="w-4 h-4" /> Metode</div>
          <div className="font-semibold">{ringkas?.metode ?? "-"}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500">Nilai Buku</div>
          <div className="font-semibold">{rupiah(ringkas?.nilaiBuku ?? 0)}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500">Akumulasi</div>
          <div className="font-semibold">{rupiah(ringkas?.akumulasi ?? 0)}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500 flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Mulai</div>
          <div className="font-semibold">{ringkas?.tahunMulai ?? "-"}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500">Umur (thn)</div>
          <div className="font-semibold">{ringkas?.umur ?? "-"}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500">Nilai Residu</div>
          <div className="font-semibold">{rupiah(ringkas?.nilaiResidu ?? 0)}</div>
        </div>
      </div>

      {/* Kontrol bulk-post + kategori */}
      <div className="flex flex-wrap items-center gap-2 border rounded-lg p-3 bg-gray-50">
        <div className="text-sm text-gray-600">Bulk posting (idempotent):</div>

        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          disabled={busy}
          title="Tahun"
        >
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Kategori Beban (BIAYA) — WAJIB */}
        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          title="Kategori Beban (BIAYA)"
          value={kategoriBebanId}
          onChange={(e) => setKategoriBebanId(e.target.value ? Number(e.target.value) : "")}
          disabled={busy}
        >
          <option value="">— Beban (BIAYA)… —</option>
          {biayaOptions.map(k => (
            <option key={k.id} value={k.id}>{k.kode} — {k.nama}</option>
          ))}
        </select>

        <button
          disabled={!canPost}
          onClick={async () => {
            try {
              setBusy(true);
              const preview = await previewBulk();
              const info = `Tahun ${preview.year}
- Total periode: ${preview.total}
- Sudah diposting: ${preview.already}
- Pending: ${preview.pending}

Lanjut posting otomatis untuk yang pending?`;
              const ok = confirm(info);
              if (!ok) return;
              const res = await execBulk(preview.year);
              setToast(`✔ Posted: ${res.posted}, Skipped: ${res.skipped}${res.errors.length ? `, Error: ${res.errors.length}` : ""}`);
              setTimeout(() => setToast(null), 1600);
              await reload();
            } catch (e: any) {
              alert(e?.message || "Gagal bulk-post");
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
          title="Post otomatis semua periode yang belum"
        >
          <Upload className="w-4 h-4" />
          Posting sisa tahun ini
        </button>

        <button
          disabled={busy}
          onClick={reload}
          className="inline-flex items-center gap-2 bg-white border px-3 py-2 rounded hover:bg-gray-50 text-sm"
          title="Regenerate tampil ulang"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>

        {Number(kategoriBebanId) <= 0 && (
          <div className="flex items-center gap-1 text-xs text-amber-700 ml-2">
            <AlertTriangle className="w-4 h-4" />
            Pilih kategori <b>Beban Penyusutan</b> terlebih dulu.
          </div>
        )}
      </div>

      {/* Hint: lawan kredit diambil dari kreditAkun kategori */}
      <div className="text-xs text-slate-600 -mt-2">
        Saat <b>Posting GL</b>, sistem otomatis menempatkan <i>akun lawan (kredit)</i> berdasarkan
        pengaturan <code>kreditAkun</code> pada <b>Kategori Beban</b> yang dipilih.
        Pastikan master kategori sudah terhubung ke akun <i>Akumulasi Penyusutan</i>.
      </div>

      {/* Tabel ringkas */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Tahun</th>
              <th className="px-3 py-2 text-left">Metode</th>
              <th className="px-3 py-2 text-left">Tarif</th>
              <th className="px-3 py-2 text-left">Nilai Awal</th>
              <th className="px-3 py-2 text-left">Beban</th>
              <th className="px-3 py-2 text-left">Akumulasi</th>
              <th className="px-3 py-2 text-left">Nilai Akhir</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((r) => {
              const yr = new Date(r.periode).getUTCFullYear();
              return (
                <tr key={`${r.id}-${yr}`} className="border-b">
                  <td className="px-3 py-2">{yr}</td>
                  <td className="px-3 py-2">{r.metode}</td>
                  <td className="px-3 py-2">{(Number(r.tarif) * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2">{rupiah(r.nilaiAwal)}</td>
                  <td className="px-3 py-2">{rupiah(r.beban)}</td>
                  <td className="px-3 py-2">{rupiah(r.akumulasi)}</td>
                  <td className="px-3 py-2">{rupiah(r.nilaiAkhir)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  Belum ada jadwal penyusutan (cek parameter aset).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tombol cepat */}
      <div className="flex gap-2">
        <a
          href={`/inventarisasi/${asetId}/penyusutan/edit`}
          className="inline-flex items-center gap-2 bg-amber-600 text-white px-3 py-2 rounded hover:bg-amber-700"
          title="Ubah parameter penyusutan aset"
        >
          <Pencil className="w-4 h-4" /> Ubah Parameter
        </a>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 rounded-xl shadow-lg px-4 py-3 text-sm bg-emerald-600 text-white flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}
    </div>
  );
}
