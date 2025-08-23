// src/app/akuntansi/gl/posting/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ScrollText,
  RefreshCw,
  Filter,
  Search,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Eye,
  LoaderCircle,
  ChevronLeft,
  BadgeCheck,
  Undo2,
  Info,
  AlertTriangle,
} from "lucide-react";

/* ========== types ========== */
type SourceType = "jurnal" | "penyusutan";
type StatusType = "" | "posted" | "unposted";

type JurnalItem = {
  type: "JURNAL";
  id: number;
  tanggal: string;
  ref?: string | null;
  uraian?: string | null;
  kategori?: { id: number; kode: string; nama: string } | null;
  debit: number;
  kredit: number;
  alokasiCount: number;
  posted: boolean;
  // ➜ dipakai untuk pairing debit/kredit penyusutan
  penyusutanId?: number | null;
};
type PenyItem = {
  type: "PENYUSUTAN";
  id: number;
  periode: string;
  aset?: { id: number; nia: string; nama: string } | null;
  beban: number;
  posted: boolean;
};
type Row = JurnalItem | PenyItem;

type Preview = {
  type: "JURNAL" | "PENYUSUTAN";
  id: number;
  canPost: boolean;
  issues: string[];
  header: { tanggal: string; ref?: string | null; uraian?: string | null; sumber?: string | null } | null;
  lines: Array<{
    akunId: number;
    akun?: { kode: string; nama: string };
    debit: number;
    kredit: number;
    unitBiayaId?: number | null;
    asetId?: number | null;
  }>;
};

/* ========== helpers ========== */
const toIDR = (n: number = 0) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0,
  );
const fmtID = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("id-ID") : "—");
const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
const to2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
const renderCols = (classes: string[]) => classes.map((c, i) => <col key={i} className={c} />);

/* ========== Preview panel component ========== */
function PreviewPanel({
  pvId,
  pvLoading,
  pv,
  onClose,
}: {
  pvId: number;
  pvLoading: boolean;
  pv: Preview | null;
  onClose: () => void;
}) {
  const totalDebit = pv?.lines?.reduce((s, x) => s + (x.debit || 0), 0) ?? 0;
  const totalKredit = pv?.lines?.reduce((s, x) => s + (x.kredit || 0), 0) ?? 0;
  const balanced = Math.abs(totalDebit - totalKredit) < 0.005;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      {/* Header */}
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Preview</span>
          <span className="font-semibold !text-gray-900">{`#${pvId}`}</span>
          {pv && (
            <span
              className={
                "text-xs px-2 py-0.5 rounded border " +
                (pv.canPost
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200")
              }
            >
              {pv.canPost ? "Siap diposting" : "Belum bisa diposting"}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-sm border px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50">
          Tutup
        </button>
      </div>

      <div className="p-5 space-y-4">
        {pvLoading ? (
          <div className="flex items-center gap-2 text-gray-600">
            <LoaderCircle className="animate-spin" size={16} /> Memuat preview…
          </div>
        ) : !pv ? (
          <div className="text-gray-600">Preview tidak tersedia.</div>
        ) : (
          <>
            {/* Issues */}
            {pv.issues.length > 0 && (
              <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-xl p-3">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle size={16} /> Catatan / Issue
                </div>
                <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">
                  {pv.issues.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Header info */}
            {pv.header && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Tanggal</div>
                  <div className="font-semibold !text-gray-900 !opacity-100">{fmtID(pv.header.tanggal)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Ref</div>
                  <div className="font-semibold !text-gray-900 !opacity-100">{pv.header.ref || "—"}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-gray-500">Uraian</div>
                  <div className="font-semibold !text-gray-900 !opacity-100">{pv.header.uraian || "—"}</div>
                </div>
              </div>
            )}

            {/* Balance + totals */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div
                className={
                  "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm " +
                  (balanced
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200")
                }
              >
                {balanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {balanced ? "Seimbang (Debit = Kredit)" : "Tidak seimbang (cek baris)"}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border bg-white px-3 py-2">
                  <div className="text-gray-500 text-xs">Total Debit</div>
                  <div className="font-semibold !text-gray-900">{toIDR(totalDebit)}</div>
                </div>
                <div className="rounded-lg border bg-white px-3 py-2">
                  <div className="text-gray-500 text-xs">Total Kredit</div>
                  <div className="font-semibold !text-gray-900">{toIDR(totalKredit)}</div>
                </div>
                <div className="rounded-lg border bg-white px-3 py-2">
                  <div className="text-gray-500 text-xs">Baris</div>
                  <div className="font-semibold !text-gray-900">{pv.lines.length}</div>
                </div>
              </div>
            </div>

            {/* Lines */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-3 py-2 text-left">Akun</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Kredit</th>
                    <th className="px-3 py-2 text-left">Unit</th>
                    <th className="px-3 py-2 text-left">Aset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 !text-gray-900">
                  {pv.lines.length ? (
                    pv.lines.map((ln, i) => (
                      <tr key={i} className="odd:bg-slate-50 !opacity-100">
                        <td className="px-3 py-2 !text-gray-900">
                          {ln.akun ? (
                            <>
                              <span className="font-mono !text-gray-900">{ln.akun.kode}</span>{" "}
                              <span className="!text-gray-900">— {ln.akun.nama}</span>
                            </>
                          ) : (
                            <span className="font-mono !text-gray-900">#{ln.akunId}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono !text-emerald-700 !opacity-100">
                          {to2(ln.debit)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono !text-rose-700 !opacity-100">
                          {to2(ln.kredit)}
                        </td>
                        <td className="px-3 py-2 !text-gray-900">{ln.unitBiayaId ?? <span className="text-gray-500">—</span>}</td>
                        <td className="px-3 py-2 !text-gray-900">{ln.asetId ?? <span className="text-gray-500">—</span>}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-600">
                        Tidak ada line.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right font-mono !text-gray-900">{to2(totalDebit)}</td>
                    <td className="px-3 py-2 text-right font-mono !text-gray-900">{to2(totalKredit)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {!pv.canPost && (
              <div className="mt-1 text-xs text-rose-700">Item ini belum bisa diposting. Perbaiki catatan/issue di atas.</div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ========== page ========== */
export default function PostingGLPage() {
  // role guard
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      window.location.href = "/login";
      return;
    }
    const u = JSON.parse(raw);
    setUser(u);
    if (!["ADMIN", "PIMPINAN"].includes(u.role)) window.location.href = "/forbidden";
  }, []);

  // filters
  const [type, setType] = useState<SourceType>("jurnal");
  const [status, setStatus] = useState<StatusType>("unposted");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [q, setQ] = useState<string>("");

  // data state
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  // selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // preview
  const [pvId, setPvId] = useState<number | null>(null);
  const [pvLoading, setPvLoading] = useState(false);
  const [pv, setPv] = useState<Preview | null>(null);

  // posting feedback
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setErr("");
    setSelected(new Set());
    try {
      const sp = new URLSearchParams();
      sp.set("type", type);
      if (status) sp.set("status", status);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      if (q.trim()) sp.set("q", q.trim());
      const r = await fetch(`/api/akuntansi/gl/sources?${sp.toString()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as Row[];
      setRows(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat sumber.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, type, status]);

  const allSelectableIds = useMemo(() => rows.filter((r) => !r.posted).map((r) => r.id), [rows]);

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelected(new Set(allSelectableIds));
  const clearSel = () => setSelected(new Set());

  const openPreview = async (row: Row) => {
    setPvId(row.id);
    setPv(null);
    setPvLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("type", row.type === "JURNAL" ? "jurnal" : "penyusutan");
      sp.set("id", String(row.id));
      const r = await fetch(`/api/akuntansi/gl/preview?${sp.toString()}`, { cache: "no-store" });
      const j = (await r.json()) as Preview;
      setPv(j);
    } catch (e: any) {
      setPv({
        type: row.type,
        id: row.id,
        canPost: false,
        issues: [e?.message || "Gagal memuat preview"],
        header: null,
        lines: [],
      });
    } finally {
      setPvLoading(false);
    }
  };

  const doPost = async () => {
    if (selected.size === 0) {
      setPostMsg("Pilih minimal satu item yang belum posted.");
      return;
    }
    setPosting(true);
    setPostMsg("");
    try {
      const items = Array.from(selected).map((id) => ({ type: type === "jurnal" ? "JURNAL" : "PENYUSUTAN", id }));
      const r = await fetch("/api/akuntansi/gl/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal mem-posting.");
      setPostMsg(`Posted: ${j.posted}, dilewati: ${j.skipped}${j.errors?.length ? `, error: ${j.errors.length}` : ""}`);
      await load();
      setSelected(new Set());
    } catch (e: any) {
      setPostMsg(e?.message || "Gagal mem-posting.");
    } finally {
      setPosting(false);
    }
  };

  const doUnpost = async (row: Row) => {
    if (!row.posted) return;
    if (!confirm("Batalkan posting untuk item ini?")) return;
    try {
      const sp = new URLSearchParams();
      sp.set("type", row.type === "JURNAL" ? "jurnal" : "penyusutan");
      sp.set("id", String(row.id));
      const r = await fetch(`/api/akuntansi/gl/unpost?${sp.toString()}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (e: any) {
      alert(e?.message || "Gagal unpost.");
    }
  };

  // ===== Pairing penyusutan: Map penyusutanId → { debit, kredit } =====
  const pairByPeny = useMemo(() => {
    const m = new Map<number, { debit: number; kredit: number }>();
    for (const r of rows) {
      if (r.type === "JURNAL" && (r as JurnalItem).penyusutanId) {
        const id = (r as JurnalItem).penyusutanId as number;
        const cur = m.get(id) ?? { debit: 0, kredit: 0 };
        cur.debit += (r as JurnalItem).debit || 0;
        cur.kredit += (r as JurnalItem).kredit || 0;
        m.set(id, cur);
      }
    }
    return m;
  }, [rows]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">Posting GL</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
              title="Muat ulang"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <Link
              href="/akuntansi/gl"
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
            >
              <ChevronLeft size={16} /> Jurnal Umum (GL)
            </Link>
          </div>
        </div>

        {/* Filter */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm sticky top-0 z-10">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-600" />
              <span className="font-semibold text-gray-900">Filter Sumber</span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Info size={14} /> Pilih sumber, rentang tanggal & status.
              </span>
            </div>
            {(q || from || to || status || type) && (
              <button
                onClick={() => {
                  setQ("");
                  setFrom("");
                  setTo("");
                  setStatus("unposted");
                  setType("jurnal");
                }}
                className="text-sm border px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50"
                title="Bersihkan filter"
              >
                Bersihkan
              </button>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-6 gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
              className="border border-gray-300 rounded-lg px-2 py-2 bg-white text-gray-900"
              title="Tipe sumber"
            >
              <option value="jurnal">Jurnal Biaya</option>
              <option value="penyusutan">Penyusutan Aset</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusType)}
              className="border border-gray-300 rounded-lg px-2 py-2 bg-white text-gray-900"
              title="Status"
            >
              <option value="unposted">Belum posted</option>
              <option value="posted">Sudah posted</option>
              <option value="">Semua</option>
            </select>

            <div className="relative">
              <CalendarDays size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"
                placeholder="Dari"
              />
            </div>

            <div className="relative">
              <CalendarDays size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"
                placeholder="Sampai"
              />
            </div>

            <div className="relative lg:col-span-2">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={type === "jurnal" ? "Cari: ref / uraian / kategori…" : "Cari: nama aset…"}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"
              />
            </div>

            <div className="lg:col-span-6">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
              >
                <RefreshCw size={16} /> Terapkan Filter
              </button>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {rows.length ? (
              <>
                Menampilkan <b>{rows.length}</b> item {status ? <>({status})</> : null} dari sumber <b>{type}</b>.
              </>
            ) : (
              <>Tidak ada data.</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-sm border px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50">
              Pilih semua
            </button>
            <button onClick={clearSel} className="text-sm border px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50">
              Kosongkan
            </button>
            <button
              onClick={doPost}
              disabled={posting || selected.size === 0}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm",
                posting || selected.size === 0 ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700",
              )}
              title="Posting GL"
            >
              {posting ? <LoaderCircle className="animate-spin" size={16} /> : <BadgeCheck size={16} />}
              Post ke GL ({selected.size})
            </button>
          </div>
        </div>
        {postMsg && (
          <div className="text-sm px-3 py-2 rounded-lg border bg-blue-50 text-blue-700 border-blue-200">{postMsg}</div>
        )}

        {/* Table */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="p-5 overflow-x-auto">
            <table className="min-w-full table-fixed text-sm border-separate [border-spacing:0]">
              <colgroup>
                {renderCols([
                  "w-[42px]", // chk
                  "w-[110px]", // tanggal
                  "w-[110px]", // jenis
                  "", // detail
                  "w-[220px]", // nominal
                  "w-[120px]", // status
                  "w-[120px]", // aksi
                ])}
              </colgroup>
              <thead className="bg-gray-900 text-white">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Jenis</th>
                  <th className="px-3 py-2 text-left">Detail</th>
                  <th className="px-3 py-2 text-left">Nominal (Debit / Kredit)</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-gray-900">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-3">
                        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-3 w-64 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-3 w-28 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : rows.length ? (
                  rows.map((r) => {
                    const checked = selected.has(r.id);
                    const isJurnal = r.type === "JURNAL";
                    const tanggal = isJurnal ? (r as JurnalItem).tanggal : (r as PenyItem).periode;

                    // === Nominal display ===
                    let nominal: string;
                    if (isJurnal && (r as JurnalItem).penyusutanId) {
                      const pair = pairByPeny.get((r as JurnalItem).penyusutanId as number) ?? { debit: 0, kredit: 0 };
                      nominal = `${toIDR(pair.debit)} / ${toIDR(pair.kredit)}`;
                    } else if (isJurnal) {
                      nominal = `${toIDR((r as JurnalItem).debit || 0)} / ${toIDR((r as JurnalItem).kredit || 0)}`;
                    } else {
                      nominal = toIDR((r as PenyItem).beban || 0);
                    }

                    return (
                      <tr key={`${r.type}-${r.id}`} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="checkbox"
                            disabled={r.posted}
                            checked={checked}
                            onChange={() => toggleOne(r.id)}
                            className="rounded border-gray-300 text-blue-600 disabled:opacity-40"
                            title={r.posted ? "Sudah posted" : "Pilih"}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap align-middle">{fmtID(tanggal)}</td>
                        <td className="px-3 py-2 whitespace-nowrap align-middle">{isJurnal ? "Jurnal" : "Penyusutan"}</td>
                        <td className="px-3 py-2 align-middle">
                          {isJurnal ? (
                            <div className="min-w-0">
                              <div className="font-medium">{(r as JurnalItem).uraian || (r as JurnalItem).ref || "-"}</div>
                              <div className="text-xs text-gray-500">
                                {(r as JurnalItem).kategori
                                  ? `${(r as JurnalItem).kategori!.kode} — ${(r as JurnalItem).kategori!.nama}`
                                  : "—"}
                              </div>
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <div className="font-medium">{(r as PenyItem).aset?.nama || "-"}</div>
                              <div className="text-xs text-gray-500">NIA: {(r as PenyItem).aset?.nia || "—"}</div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap align-middle">{nominal}</td>
                        <td className="px-3 py-2 whitespace-nowrap align-middle">
                          {r.posted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800">
                              <CheckCircle2 size={14} /> Posted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-800">
                              <XCircle size={14} /> Unposted
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap align-middle">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openPreview(r)}
                              className="text-blue-600 hover:underline inline-flex items-center gap-1"
                              title="Preview"
                            >
                              <Eye size={14} /> Preview
                            </button>
                            {r.posted && (
                              <button
                                onClick={() => doUnpost(r)}
                                className="text-rose-600 hover:underline inline-flex items-center gap-1"
                                title="Batalkan posting"
                              >
                                <Undo2 size={14} /> Unpost
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-600">
                      Tidak ada data sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Preview panel */}
        {pvId !== null && (
          <PreviewPanel pvId={pvId} pvLoading={pvLoading} pv={pv} onClose={() => { setPvId(null); setPv(null); }} />
        )}
      </div>
    </main>
  );
}
