"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  History, RefreshCw, Filter, Search, Info, ChevronDown, ChevronRight,
  Trash2, Download, NotebookText, Factory, Calendar, ScrollText
} from "lucide-react";

type HeaderRow = {
  id: number;
  tanggal: string;
  ref?: string | null;
  uraian?: string | null;
  sumber?: string | null;
  sourceType?: "JURNAL" | "PENYUSUTAN" | null;
  sourceId?: number | null;
  linesCount: number;
  createdAt?: string;
};

type DetailRow = {
  id: number;
  akunId: number;
  akun?: { kode: string; nama: string } | null;
  debit: number;
  kredit: number;
  unit?: { id: number; nama: string } | null;
  aset?: { id: number; nia: string | null; nama: string | null } | null;
};

const fmtID = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("id-ID") : "—");
const to2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

export default function GLPostedPage() {
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);

  // filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qRaw, setQRaw] = useState("");
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"" | "jurnal" | "penyusutan">("");

  // data
  const [rows, setRows] = useState<HeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // expanded cache (detail per header)
  const [openIds, setOpenIds] = useState<number[]>([]);
  const [details, setDetails] = useState<Record<number, DetailRow[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<Record<number, boolean>>({});

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(qRaw), 250);
    return () => clearTimeout(t);
  }, [qRaw]);

  // role guard
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { window.location.href = "/login"; return; }
    const u = JSON.parse(raw);
    setUser(u);
    if (!["ADMIN", "PIMPINAN"].includes(u.role)) window.location.href = "/forbidden";
  }, []);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (q) sp.set("q", q);
    if (source) sp.set("source", source);
    return sp.toString();
  }, [from, to, q, source]);

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`/api/akuntansi/gl${params ? `?${params}` : ""}`, { cache: "no-store" });
      const j = r.ok ? await r.json() : [];
      setRows(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat GL.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* auto */ }, [params]);

  const toggle = async (id: number) => {
    const isOpen = openIds.includes(id);
    if (isOpen) {
      setOpenIds((s) => s.filter((x) => x !== id));
      return;
    }
    setOpenIds((s) => [...s, id]);
    if (!details[id]) {
      setLoadingDetail((m) => ({ ...m, [id]: true }));
      try {
        const r = await fetch(`/api/akuntansi/gl/${id}`, { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        setDetails((m) => ({ ...m, [id]: j?.lines || [] }));
      } catch {
        // noop
      } finally {
        setLoadingDetail((m) => ({ ...m, [id]: false }));
      }
    }
  };

  const unpost = async (h: HeaderRow) => {
    if (!h.sourceType || !h.sourceId) {
      alert("Tidak bisa unpost: sumber tidak dikenal.");
      return;
    }
    if (!confirm(`Unpost ${h.sourceType} #${h.sourceId}?`)) return;
    try {
      const r = await fetch(`/api/akuntansi/gl/unpost?type=${h.sourceType === "JURNAL" ? "jurnal" : "penyusutan"}&id=${h.sourceId}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal unpost.");
      setOpenIds((s) => s.filter((x) => x !== h.id));
      setDetails((m) => { const n = { ...m }; delete n[h.id]; return n; });
      load();
    } catch (e: any) {
      alert(e?.message || "Gagal unpost.");
    }
  };

  const exportHeader = (h: HeaderRow, lines: DetailRow[]) => {
    const head = ["HeaderID","Tanggal","Ref","Uraian","Sumber","AkunKode","AkunNama","Debit","Kredit","Unit","Aset"];
    const rowsCsv = lines.map((ln) => [
      h.id,
      fmtID(h.tanggal),
      h.ref ?? "",
      (h.uraian ?? "").replace(/[\r\n]+/g, " "),
      h.sumber ?? "",
      ln.akun?.kode ?? "",
      ln.akun?.nama ?? "",
      to2(ln.debit),
      to2(ln.kredit),
      ln.unit?.nama ?? "",
      ln.aset ? `${ln.aset.nia ?? ""} ${ln.aset.nama ?? ""}`.trim() : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [head.join(","), ...rowsCsv].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `GL_${h.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Jurnal Umum (GL)
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm" title="Muat ulang">
              <RefreshCw size={16}/> Muat ulang
            </button>
            <Link href="/akuntansi/gl/posting" className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm" title="Ke Posting GL">
              <ScrollText size={16}/> Posting GL
            </Link>
          </div>
        </div>

        {/* Filter */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm sticky top-0 z-10">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-600" />
              <span className="font-semibold text-gray-900">Filter</span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Info size={14}/> Cari di <b>ref / uraian / sumber</b>.
              </span>
            </div>
            {(from || to || q || source) && (
              <button
                onClick={() => { setFrom(""); setTo(""); setQRaw(""); setQ(""); setSource(""); }}
                className="text-sm border px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50"
              >
                Bersihkan
              </button>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Dari</label>
              <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Sampai</label>
              <input type="date" value={to} onChange={(e)=>setTo(e.target.value)}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"/>
            </div>
            <div className="relative md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cari</label>
              <Search size={16} className="absolute left-3 top-10 text-gray-400"/>
              <input value={qRaw} onChange={(e)=>setQRaw(e.target.value)} placeholder="Ref / uraian / sumber…"
                     className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full bg-white text-gray-900"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Sumber</label>
              <select value={source} onChange={(e)=>setSource(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 bg-white text-gray-900">
                <option value="">Semua</option>
                <option value="jurnal">Jurnal Biaya</option>
                <option value="penyusutan">Penyusutan</option>
              </select>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="p-5 overflow-x-auto">
            <table className="min-w-full table-fixed text-sm border-separate [border-spacing:0]">
              <colgroup>
                {[
                  <col key="c1" className="w-[110px]" />,
                  <col key="c2" className="w-[150px]" />,
                  <col key="c3" />,
                  <col key="c4" className="w-[170px]" />,
                  <col key="c5" className="w-[80px]" />,
                  <col key="c6" className="w-[160px]" />,
                ]}
              </colgroup>
              <thead className="bg-gray-900 text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Ref</th>
                  <th className="px-3 py-2 text-left">Uraian</th>
                  <th className="px-3 py-2 text-left">Sumber</th>
                  <th className="px-3 py-2 text-left">Lines</th>
                  <th className="px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900">
                {loading ? (
                  Array.from({length:8}).map((_,i)=>(
                    <tr key={i}>
                      <td className="px-3 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse"/></td>
                      <td className="px-3 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse"/></td>
                      <td className="px-3 py-3"><div className="h-3 w-64 bg-gray-200 rounded animate-pulse"/></td>
                      <td className="px-3 py-3"><div className="h-3 w-28 bg-gray-200 rounded animate-pulse"/></td>
                      <td className="px-3 py-3"><div className="h-5 w-10 bg-gray-200 rounded-full animate-pulse"/></td>
                      <td className="px-3 py-3"><div className="h-7 w-24 bg-gray-200 rounded animate-pulse"/></td>
                    </tr>
                  ))
                ) : err ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-red-700 flex items-center gap-2"><Info size={16}/><span>{err}</span></td></tr>
                ) : rows.length ? (
                  rows.map((h) => {
                    const isOpen = openIds.includes(h.id);
                    const srcLabel = h.sourceType === "JURNAL"
                      ? <span title="Jurnal Biaya" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800"><NotebookText size={14}/> Jurnal</span>
                      : h.sourceType === "PENYUSUTAN"
                        ? <span title="Penyusutan" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800"><Factory size={14}/> Penyusutan</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">—</span>;

                    return (
                      <Fragment key={h.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            <button onClick={()=>toggle(h.id)} className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800">
                              {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}{fmtID(h.tanggal)}
                            </button>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">{h.ref ?? "—"}</td>
                          <td className="px-3 py-2 align-middle">
                            <div className="truncate max-w-[520px]">{h.uraian ?? "—"}</div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">{srcLabel}</td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">{h.linesCount}</td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={()=>unpost(h)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 text-xs"
                                title="Unpost (hapus dari GL)"
                              >
                                <Trash2 size={14}/> Unpost
                              </button>
                              {isOpen && (details[h.id]?.length ?? 0) > 0 ? (
                                <button
                                  onClick={()=>exportHeader(h, details[h.id])}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-gray-50"
                                  title="Export CSV (baris ini)"
                                >
                                  <Download size={14}/> CSV
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>

                        {/* Detail (expand) */}
                        {isOpen && (
                          <tr>
                            <td colSpan={6} className="px-6 pb-4">
                              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                                {loadingDetail[h.id] ? (
                                  <div className="text-gray-600">Memuat detail…</div>
                                ) : (details[h.id]?.length ?? 0) === 0 ? (
                                  <div className="text-gray-600">Tidak ada line.</div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs">
                                      <thead>
                                        <tr className="bg-gray-800 text-white">
                                          <th className="px-2 py-1 text-left">Akun</th>
                                          <th className="px-2 py-1 text-left">Debit</th>
                                          <th className="px-2 py-1 text-left">Kredit</th>
                                          <th className="px-2 py-1 text-left">Unit</th>
                                          <th className="px-2 py-1 text-left">Aset</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {details[h.id].map((ln) => (
                                          <tr key={ln.id}>
                                            <td className="px-2 py-1">
                                              {ln.akun ? (
                                                <span className="font-mono">{ln.akun.kode}</span>
                                              ) : "—"}{" "}
                                              {ln.akun?.nama ?? ""}
                                            </td>
                                            <td className="px-2 py-1">{to2(ln.debit)}</td>
                                            <td className="px-2 py-1">{to2(ln.kredit)}</td>
                                            <td className="px-2 py-1">{ln.unit?.nama ?? "—"}</td>
                                            <td className="px-2 py-1">
                                              {ln.aset ? (
                                                <span className="inline-flex items-center gap-1">
                                                  <Calendar size={12}/> {(ln.aset.nia ?? "")} {ln.aset.nama ?? ""}
                                                </span>
                                              ) : "—"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-gray-100 font-semibold">
                                          <td className="px-2 py-1">Total</td>
                                          <td className="px-2 py-1">
                                            {to2(details[h.id].reduce((s, x) => s + (x.debit || 0), 0))}
                                          </td>
                                          <td className="px-2 py-1">
                                            {to2(details[h.id].reduce((s, x) => s + (x.kredit || 0), 0))}
                                          </td>
                                          <td colSpan={2}/>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600">Belum ada posting GL dalam filter ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
