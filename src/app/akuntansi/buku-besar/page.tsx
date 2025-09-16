// app/akuntansi/buku-besar/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AkShell, { glass } from "@/components/AkShell";
import { Download, Filter, Copy, ChevronRight } from "lucide-react";

/* ===== Mini AccountPicker (autocomplete) ===== */
type Pos = "DEBIT" | "KREDIT";
type TipeAkun = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";
type AccountOption = { id:number; kode:string; nama:string; pos:Pos; tipe:TipeAkun; isPosting:boolean; isActive:boolean };

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(()=>setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function AccountPicker({ value, onPick }:{
  value: string;
  onPick: (opt: AccountOption) => void;
}) {
  const [q,setQ] = React.useState(value);
  const dq = useDebounced(q);
  const [open,setOpen] = React.useState(false);
  const [opts,setOpts] = React.useState<AccountOption[]>([]);
  const [loading,setLoading] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(()=>{
    let abort=false;
    (async()=>{
      if(!dq){ setOpts([]); return; }
      setLoading(true);
      try{
        const r = await fetch(`/api/akuntansi/coa?q=${encodeURIComponent(dq)}&size=20`);
        const j = await r.json();
        const rows: AccountOption[] = (j?.rows||j||[]).filter((x:AccountOption)=>x.isPosting && x.isActive);
        if(!abort) setOpts(rows);
      }catch{ if(!abort) setOpts([]); }
      finally{ if(!abort) setLoading(false); }
    })();
    return ()=>{ abort=true; };
  },[dq]);

  React.useEffect(()=>{
    const onDoc=(e:MouseEvent)=>{ if(boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return ()=>document.removeEventListener("mousedown", onDoc);
  },[]);

  return (
    <div className="relative w-full md:w-[32rem]" ref={boxRef}>
      <input
        value={q}
        onChange={(e)=>{ setQ(e.target.value); setOpen(true); }}
        onFocus={()=>setOpen(true)}
        placeholder="Ketik kode/nama akun..."
        className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/10 bg-slate-900/95 p-1 shadow-xl">
          {loading ? (
            <div className="p-3 text-sm text-slate-300/70">Mencari…</div>
          ) : opts.length === 0 ? (
            <div className="p-3 text-xs text-slate-300/70">Tidak ada hasil.</div>
          ) : (
            <ul className="text-sm">
              {opts.map(o=>(
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={()=>{ onPick(o); setQ(`${o.kode} — ${o.nama}`); setOpen(false); }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-white/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-[12px] font-semibold">{o.kode}</span>
                      <span className="truncate text-slate-200">{o.nama}</span>
                    </div>
                    <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[11px]">{o.pos}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ===== Types & helpers ===== */
type LedgerRow = {
  id:number; tanggal:string; nomor:string; sumber:string|null; memo:string|null;
  refTable:string|null; refId:number|null; refNo:string|null; debit:number; kredit:number; saldo:number;
};
type LedgerResp = {
  akun: { id:number; kode:string; nama:string; pos:Pos };
  periode: { dari:string; sampai:string };
  status: "ALL"|"POSTED"|"DRAFT";
  page:number; size:number; count:number;
  opening:number; totalDebit:number; totalKredit:number; closing:number;
  rows: LedgerRow[];
};

type SummaryItem = {
  akunId:number; kode:string; nama:string; pos:Pos; tipe:TipeAkun;
  opening:number; debit:number; kredit:number; closing:number;
};
type SummaryResp = {
  periode: { dari:string; sampai:string };
  status:"ALL"|"POSTED"|"DRAFT";
  items: SummaryItem[];
};

const fmtIDR = (n:number) => n.toLocaleString("id-ID");

/* ===== Page ===== */
export default function BukuBesarPage() {
  const search = useSearchParams();
  const didAuto = React.useRef(false);

  const [mode,setMode] = React.useState<"summary"|"detail">("summary");

  const [picked,setPicked] = React.useState<{id:number; kode:string; nama:string; pos:Pos} | null>(null);
  const [input,setInput]   = React.useState("");
  const [dari,setDari]     = React.useState<string>(()=> {
    const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  });
  const [sampai,setSampai] = React.useState<string>(()=> {
    const d=new Date(); const last=new Date(d.getFullYear(), d.getMonth()+1, 0);
    return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,"0")}-${String(last.getDate()).padStart(2,"0")}`;
  });

  const [detail,setDetail] = React.useState<LedgerResp | null>(null);
  const [summary,setSummary] = React.useState<SummaryResp | null>(null);
  const [loading,setLoading] = React.useState(false);
  const [err,setErr] = React.useState<string | null>(null);

  // pagination (detail)
  const [dPage, setDPage] = React.useState(1);

  const apply = async (forceKode?: string) => {
    setErr(null); setLoading(true);
    try{
      if (mode === "summary") {
        const url = `/api/akuntansi/ledger?summary=1&q=${encodeURIComponent(input)}&dari=${dari}&sampai=${sampai}&status=POSTED`;
        const r = await fetch(url);
        const j: any = await r.json();
        if(!r.ok) throw new Error(j?.error || "Gagal memuat ringkasan");
        setSummary(j as SummaryResp);
        setDetail(null);
      } else {
        // izinkan pakai kode paksa (dari query), atau picked, atau kode yang diketik (sebelum " — ")
        const typed = input ? input.split("—")[0].trim() : "";
        const kode = (forceKode || picked?.kode || typed).trim();
        if (!kode) throw new Error("Pilih/isi kode akun dulu.");
        const url = `/api/akuntansi/ledger?kode=${encodeURIComponent(kode)}&dari=${dari}&sampai=${sampai}&status=POSTED&page=${dPage}`;
        const r = await fetch(url);
        const j: any = await r.json();
        if(!r.ok) throw new Error(j?.error || "Gagal memuat buku besar");
        setDetail(j as LedgerResp);
        setSummary(null);
      }
    }catch(e:any){
      setErr(e.message);
      setSummary(null);
      setDetail(null);
    }finally{ setLoading(false); }
  };

  // re-apply ketika ganti page di mode detail
  React.useEffect(()=>{
    if (mode === "detail" && (picked || input.trim())) { apply(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dPage]);

  const exportCSV = () => {
    if (mode === "summary" && summary) {
      const lines = [
        ["Kode","Nama","Pos","Tipe","Saldo Awal","Debit","Kredit","Saldo Akhir"],
        ...summary.items.map(it=>[it.kode,it.nama,it.pos,it.tipe,it.opening,it.debit,it.kredit,it.closing])
      ];
      const csv = lines.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-summary-${summary.periode.dari.slice(0,10)}_${summary.periode.sampai.slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    if (mode === "detail" && detail) {
      const lines = [
        ["Tanggal","Nomor","Memo","Debit","Kredit","Saldo"],
        ...detail.rows.map(r=>[
          new Date(r.tanggal).toLocaleDateString("id-ID"), r.nomor, r.memo || "", r.debit, r.kredit, r.saldo
        ])
      ];
      const csv = lines.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-${detail.akun.kode}-${detail.periode.dari.slice(0,10)}_${detail.periode.sampai.slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // totals & balanced check (summary)
  const totals = React.useMemo(()=>{
    if (!summary) return { debit: 0, kredit: 0, balanced: true };
    const d = summary.items.reduce((s, x) => s + x.debit, 0);
    const k = summary.items.reduce((s, x) => s + x.kredit, 0);
    return { debit: d, kredit: k, balanced: Math.abs(d - k) < 0.5 };
  }, [summary]);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const onSwitch = (m:"summary"|"detail") => {
    setMode(m);
    setErr(null);
    if (m === "summary") { setDetail(null); }
    if (m === "detail") { setDPage(1); }
  };

  /* ===== AUTO-APPLY dari query ?kode=&dari=&sampai=&status= ===== */
  React.useEffect(() => {
    if (didAuto.current) return;
    const kodeQ = search.get("kode");
    if (!kodeQ) return;
    const dariQ   = search.get("dari");
    const sampaiQ = search.get("sampai");
    // set periode kalau ada
    if (dariQ) setDari(dariQ);
    if (sampaiQ) setSampai(sampaiQ);
    // switch ke detail dan isi input
    setMode("detail");
    setInput(kodeQ);
    setDPage(1);
    didAuto.current = true;
    // apply setelah state terset
    setTimeout(() => { apply(kodeQ); }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <AkShell title="Buku Besar" subtitle="Ringkasan & drill-down per akun" full>
      <section className={`${glass} p-4`}>
        {/* Mode switch */}
        <div className="mb-3 inline-flex overflow-hidden rounded-lg border border-white/10">
          <button onClick={()=>onSwitch("summary")}
            className={`px-3 py-1.5 text-sm ${mode==="summary"?"bg-white/15":"bg-white/5 hover:bg-white/10"}`}>
            Ringkasan
          </button>
          <button onClick={()=>onSwitch("detail")}
            className={`px-3 py-1.5 text-sm ${mode==="detail"?"bg-white/15":"bg-white/5 hover:bg-white/10"}`}>
            Per Akun
          </button>
        </div>

        <div className="grid grid-cols-12 gap-3">
          {mode==="detail" ? (
            <div className="col-span-12 lg:col-span-6">
              <AccountPicker
                value={input}
                onPick={(o)=>{ setPicked({ id:o.id, kode:o.kode, nama:o.nama, pos:o.pos }); setInput(`${o.kode} — ${o.nama}`); }}
              />
            </div>
          ) : (
            <div className="col-span-12 lg:col-span-6">
              <input
                value={input}
                onChange={(e)=>setInput(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==="Enter") apply(); }}
                placeholder="Cari akun (kode/nama)…"
                className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"
              />
            </div>
          )}

          <div className="col-span-6 lg:col-span-2">
            <input type="date" value={dari} onChange={(e)=>{ setDari(e.target.value); if(mode==="detail") setDPage(1); }}
                   className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"/>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <input type="date" value={sampai} onChange={(e)=>{ setSampai(e.target.value); if(mode==="detail") setDPage(1); }}
                   className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"/>
          </div>
          <div className="col-span-6 lg:col-span-1">
            <button onClick={()=>apply()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-400/20 px-3 text-sm text-indigo-100 hover:bg-indigo-400/30">
              <Filter className="h-4 w-4"/> Terapkan
            </button>
          </div>
          <div className="col-span-6 lg:col-span-1">
            <button onClick={exportCSV} disabled={(mode==="summary" && !summary) || (mode==="detail" && !detail)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 text-sm hover:bg-white/15 disabled:opacity-50">
              <Download className="h-4 w-4"/> Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4">
          {err && <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</div>}
          {loading && <div className="h-24 animate-pulse rounded-lg bg-white/5" />}

          {/* RINGKASAN */}
          {mode==="summary" && summary && !loading && (
            <>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-[1] bg-white/[0.04] text-slate-200 backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 text-left">Kode</th>
                      <th className="px-3 py-2 text-left">Nama</th>
                      <th className="px-3 py-2 text-left">Tipe</th>
                      <th className="px-3 py-2 text-right">Saldo Awal</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Kredit</th>
                      <th className="px-3 py-2 text-right">Saldo Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-100">
                    {summary.items.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-300/70">Tidak ada data pada periode ini.</td></tr>
                    )}
                    {summary.items.map(it=>(
                      <tr key={it.akunId} className="border-t border-white/10 hover:bg-white/[0.03] cursor-pointer"
                          onClick={()=>{ setPicked({id:it.akunId,kode:it.kode,nama:it.nama,pos:it.pos}); setInput(`${it.kode} — ${it.nama}`); setMode("detail"); setDPage(1); }}>
                        <td className="px-3 py-2 font-mono">{it.kode}</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          {it.nama}
                          <ChevronRight className="h-4 w-4 opacity-60" />
                        </td>
                        <td className="px-3 py-2">{it.tipe}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.opening)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.debit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.kredit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.closing)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {summary.items.length > 0 && (
                    <tfoot className="bg-white/[0.03]">
                      <tr className="text-slate-200">
                        <td className="px-3 py-2" colSpan={4}>Total</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(totals.debit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(totals.kredit)}</td>
                        <td className="px-3 py-2 text-right">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-slate-300">
                  Periode: {new Date(summary.periode.dari).toLocaleDateString("id-ID")} — {new Date(summary.periode.sampai).toLocaleDateString("id-ID")}
                </div>
                <div className={`rounded px-2 py-0.5 text-xs ${totals.balanced ? "bg-emerald-500/15 text-emerald-200 border border-emerald-300/20" : "bg-rose-500/15 text-rose-200 border border-rose-300/20"}`}>
                  {totals.balanced ? "Seimbang" : "Tidak Seimbang"}
                </div>
              </div>
            </>
          )}

          {/* DETAIL */}
          {mode==="detail" && detail && !loading && (
            <>
              <div className="grid grid-cols-12 gap-3 mb-3">
                <div className="col-span-12 lg:col-span-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-300/70">Akun</div>
                  <div className="mt-1 font-medium">{detail.akun.kode} — {detail.akun.nama}</div>
                </div>
                <div className="col-span-6 lg:col-span-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-300/70">Saldo Awal</div>
                  <div className="mt-1 text-lg font-semibold">Rp {fmtIDR(detail.opening)}</div>
                </div>
                <div className="col-span-6 lg:col-span-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-300/70">Mutasi</div>
                  <div className="mt-1 text-sm">Debit: <b>Rp {fmtIDR(detail.totalDebit)}</b></div>
                  <div className="text-sm">Kredit: <b>Rp {fmtIDR(detail.totalKredit)}</b></div>
                </div>
                <div className="col-span-12 lg:col-span-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-300/70">Saldo Akhir</div>
                  <div className="mt-1 text-lg font-semibold">Rp {fmtIDR(detail.closing)}</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-[1] bg-white/[0.04] text-slate-200 backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-left">Nomor</th>
                      <th className="px-3 py-2 text-left">Memo</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Kredit</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                      <th className="px-3 py-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-100">
                    {detail.rows.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-300/70">Belum ada mutasi di periode ini.</td></tr>
                    )}
                    {detail.rows.map(r=>(
                      <tr key={r.id} className="border-t border-white/10">
                        <td className="px-3 py-2">{new Date(r.tanggal).toLocaleDateString("id-ID")}</td>
                        <td className="px-3 py-2">{r.nomor}</td>
                        <td className="px-3 py-2">{r.memo || "—"}</td>
                        <td className="px-3 py-2 text-right">{fmtIDR(r.debit)}</td>
                        <td className="px-3 py-2 text-right">{fmtIDR(r.kredit)}</td>
                        <td className="px-3 py-2 text-right">{fmtIDR(r.saldo)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={()=>copy(r.nomor)}
                              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                              title="Copy #Jurnal"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <Link
                              href={`/akuntansi/jurnal?q=${encodeURIComponent(r.nomor)}`}
                              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                              title="Lihat Jurnal"
                            >
                              Lihat
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {detail.rows.length > 0 && (
                    <tfoot className="bg-white/[0.03]">
                      <tr className="text-slate-200">
                        <td className="px-3 py-2" colSpan={3}>Total Periode</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(detail.totalDebit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(detail.totalKredit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(detail.closing)}</td>
                        <td className="px-3 py-2" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="text-slate-300">
                  Menampilkan {(detail.page-1)*detail.size + 1}
                  {"–"}
                  {Math.min(detail.page*detail.size, detail.count)} dari {detail.count}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=>setDPage(p=>Math.max(1, p-1))}
                    disabled={detail.page <= 1}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={()=>setDPage(p=> (detail.page*detail.size < detail.count ? p+1 : p))}
                    disabled={detail.page*detail.size >= detail.count}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </AkShell>
  );
}
