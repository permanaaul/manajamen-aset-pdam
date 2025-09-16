// app/laporan-keuangan/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import AkShell, { glass } from "@/components/AkShell";
import { Filter, Download, BadgeCheck, Info } from "lucide-react";

type TipeAkun = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";

/* ========= Types ========= */
// Laba Rugi
type LRItem = { akunId:number; kode:string; nama:string; nilai:number };
type LRResp = {
  periode: { dari:string; sampai:string };
  status: "ALL"|"POSTED"|"DRAFT";
  pendapatan: LRItem[];
  beban: LRItem[];
  totals: { pendapatan:number; beban:number; labaBersih:number };
};
// Neraca
type NeracaItem = { akunId:number; kode:string; nama:string; tipe:TipeAkun; closingDebit:number; closingKredit:number };
type NeracaResp = {
  periode: { dari:string; sampai:string };
  status: "ALL"|"POSTED"|"DRAFT";
  items: NeracaItem[];
  totals: { asetD:number; asetC:number; kewajibanEkuitasD:number; kewajibanEkuitasC:number; balanced:boolean };
};

/* ========= CSV helper types ========= */
type CSVCell = string | number | null | undefined;
type CSVRow  = CSVCell[];

const fmtIDR = (n:number) => n.toLocaleString("id-ID");

/* ========= Sumber filter (UI only) ========= */
const SOURCE_OPTIONS = [
  { value: "KAS_BANK",    label: "Kas/Bank" },
  { value: "MANUAL",      label: "Manual" },
  { value: "PENYUSUTAN",  label: "Penyusutan" },
  { value: "GUDANG",      label: "Gudang" },
  { value: "ASET",        label: "Aset" },
] as const;
type SourceValue = typeof SOURCE_OPTIONS[number]["value"];

function SourceChips({
  selected, onToggle,
}: { selected: SourceValue[]; onToggle:(v:SourceValue)=>void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SOURCE_OPTIONS.map(opt => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs
              ${active
                ? "border-indigo-300/30 bg-indigo-400/20 text-indigo-100"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            title={`Filter sumber: ${opt.label}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ========= Page ========= */
export default function LaporanKeuanganPage() {
  const [tab, setTab] = React.useState<"lr"|"neraca">("lr");
  const [q,setQ] = React.useState("");
  const [dari,setDari] = React.useState<string>(()=> {
    const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  });
  const [sampai,setSampai] = React.useState<string>(()=> {
    const d=new Date(); const last=new Date(d.getFullYear(), d.getMonth()+1, 0);
    return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,"0")}-${String(last.getDate()).padStart(2,"0")}`;
  });
  const [status, setStatus] = React.useState<"POSTED"|"ALL"|"DRAFT">("POSTED");
  const [sources, setSources] = React.useState<SourceValue[]>([]); // multi-select

  const [lr, setLR] = React.useState<LRResp|null>(null);
  const [neraca, setNeraca] = React.useState<NeracaResp|null>(null);
  const [loading,setLoading] = React.useState(false);
  const [err,setErr] = React.useState<string|null>(null);

  const apply = async () => {
    setErr(null); setLoading(true);
    try {
      const sourceParam = sources.length ? `&source=${encodeURIComponent(sources.join(","))}` : "";
      if (tab === "lr") {
        const url = `/api/laporan-keuangan/laba-rugi?dari=${dari}&sampai=${sampai}&status=${status}&q=${encodeURIComponent(q)}${sourceParam}`;
        const r = await fetch(url); const j:any = await r.json();
        if (!r.ok) throw new Error(j?.error || "Gagal memuat Laba-Rugi");
        setLR(j as LRResp); setNeraca(null);
      } else {
        const url = `/api/laporan-keuangan/neraca?dari=${dari}&sampai=${sampai}&status=${status}&q=${encodeURIComponent(q)}${sourceParam}`;
        const r = await fetch(url); const j:any = await r.json();
        if (!r.ok) throw new Error(j?.error || "Gagal memuat Neraca");
        setNeraca(j as NeracaResp); setLR(null);
      }
    } catch (e:any) {
      setErr(e.message); setLR(null); setNeraca(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(()=>{ apply(); /* load default tiap ganti tab */ }, [tab]); // eslint-disable-line

  /* ========= CSV Export (typed, noImplicitAny-safe) ========= */
  const rowsToCSV = (rows: CSVRow[]) =>
    rows
      .map((r: CSVRow) =>
        r.map((v: CSVCell) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

  const exportCSV = () => {
    if (tab === "lr" && lr) {
      const lines: CSVRow[] = [
        ["LAPORAN LABA-RUGI"],
        ["Periode", `${lr.periode.dari.slice(0,10)} s/d ${lr.periode.sampai.slice(0,10)}`],
        ["Status", lr.status],
        ["Sumber", sources.join(", ") || "Semua"],
        [],
        ["Pendapatan","Nilai"],
        ...lr.pendapatan.map<CSVRow>(x => [`${x.kode} ${x.nama}`, x.nilai]),
        ["Total Pendapatan", lr.totals.pendapatan],
        [],
        ["Beban","Nilai"],
        ...lr.beban.map<CSVRow>(x => [`${x.kode} ${x.nama}`, x.nilai]),
        ["Total Beban", lr.totals.beban],
        [],
        ["Laba Bersih", lr.totals.labaBersih],
      ];
      const csv = rowsToCSV(lines);
      const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url; a.download = `laba-rugi_${lr.periode.dari.slice(0,10)}_${lr.periode.sampai.slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    }
    if (tab === "neraca" && neraca) {
      const aset = neraca.items.filter(x=>x.tipe==="ASET");
      const kew  = neraca.items.filter(x=>x.tipe==="KEWAJIBAN");
      const eki  = neraca.items.filter(x=>x.tipe==="EKUITAS");

      const lines: CSVRow[] = [
        ["LAPORAN NERACA"],
        ["Per", `${neraca.periode.sampai.slice(0,10)}`],
        ["Status", neraca.status],
        ["Sumber", sources.join(", ") || "Semua"],
        [],
        ["ASET","D","C"],
        ...aset.map<CSVRow>(x => [`${x.kode} ${x.nama}`, x.closingDebit, x.closingKredit]),
        ["Total Aset", neraca.totals.asetD, neraca.totals.asetC],
        [],
        ["KEWAJIBAN","D","C"],
        ...kew.map<CSVRow>(x => [`${x.kode} ${x.nama}`, x.closingDebit, x.closingKredit]),
        [],
        ["EKUITAS","D","C"],
        ...eki.map<CSVRow>(x => [`${x.kode} ${x.nama}`, x.closingDebit, x.closingKredit]),
        ["Total Kewajiban+Ekuitas", neraca.totals.kewajibanEkuitasD, neraca.totals.kewajibanEkuitasC],
      ];
      const csv = rowsToCSV(lines);
      const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url; a.download = `neraca_${neraca.periode.sampai.slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    }
  };

  /* ========= Helpers ========= */
  const toBBUrl = (kode:string) =>
    `/akuntansi/buku-besar?kode=${encodeURIComponent(kode)}&dari=${dari}&sampai=${sampai}&status=${status}`;

  const toggleSource = (v:SourceValue) =>
    setSources(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev, v]);

  return (
    <AkShell title="Laporan Keuangan" subtitle="Laba-Rugi & Neraca" full>
      <section className={`${glass} p-4`}>
        {/* Tabs */}
        <div className="mb-3 inline-flex overflow-hidden rounded-lg border border-white/10">
          <button
            onClick={()=>setTab("lr")}
            className={`px-3 py-1.5 text-sm ${tab==="lr"?"bg-white/15":"bg-white/5 hover:bg-white/10"}`}
          >
            Laba-Rugi
          </button>
          <button
            onClick={()=>setTab("neraca")}
            className={`px-3 py-1.5 text-sm ${tab==="neraca"?"bg-white/15":"bg-white/5 hover:bg-white/10"}`}
          >
            Neraca
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-6 lg:col-span-3">
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") apply(); }}
              placeholder={tab==="lr" ? "Cari akun pendapatan/beban…" : "Cari akun Aset/Kewajiban/Ekuitas…"}
              className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none lg:max-w-[22rem]"
            />
          </div>
          <div className="col-span-6 lg:col-span-2">
            <input type="date" value={dari} onChange={e=>setDari(e.target.value)}
              className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"/>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <input type="date" value={sampai} onChange={e=>setSampai(e.target.value)}
              className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"/>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <select value={status} onChange={e=>setStatus(e.target.value as any)}
              className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none">
              <option value="POSTED">POSTED</option>
              <option value="ALL">ALL</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>
          <div className="col-span-12 lg:col-span-3 flex items-center gap-2">
            <button
              onClick={apply}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-400/20 px-3 text-sm text-indigo-100 hover:bg-indigo-400/30"
            >
              <Filter className="h-4 w-4"/> Terapkan
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 text-sm hover:bg-white/15"
            >
              <Download className="h-4 w-4"/> CSV
            </button>
          </div>
          {/* Row chips sumber */}
          <div className="col-span-12">
            <div className="flex items-center justify-between">
              <SourceChips selected={sources} onToggle={toggleSource} />
              <div className="hidden md:flex items-center gap-1 text-xs text-slate-300/80">
                <Info className="h-3.5 w-3.5" />
                <span>Tips: klik nama akun untuk drill-down ke Buku Besar (periode & status ikut).</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4">
          {err && <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</div>}
          {loading && <div className="h-24 animate-pulse rounded-lg bg-white/5" />}

          {/* Laba-Rugi */}
          {tab === "lr" && lr && !loading && (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04] text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">Akun</th>
                    <th className="px-3 py-2 text-right">Nilai</th>
                  </tr>
                </thead>
                <tbody className="text-slate-100">
                  <tr className="bg-white/[0.03]">
                    <td className="px-3 py-2 font-semibold">Pendapatan</td><td/>
                  </tr>
                  {lr.pendapatan.filter(x=>Math.abs(x.nilai) > 0).map(x=>(
                    <tr key={`p-${x.akunId}`} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        <Link
                          href={toBBUrl(x.kode)}
                          className="underline-offset-2 hover:underline"
                          title="Lihat Buku Besar akun ini"
                        >
                          {x.kode} — {x.nama}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right">Rp {fmtIDR(x.nilai)}</td>
                    </tr>
                  ))}
                  <tr className="bg-white/[0.02] text-slate-200">
                    <td className="px-3 py-2 font-medium">Total Pendapatan</td>
                    <td className="px-3 py-2 text-right font-medium">Rp {fmtIDR(lr.totals.pendapatan)}</td>
                  </tr>

                  <tr className="bg-white/[0.03]">
                    <td className="px-3 py-2 font-semibold">Beban</td><td/>
                  </tr>
                  {lr.beban.filter(x=>Math.abs(x.nilai) > 0).map(x=>(
                    <tr key={`b-${x.akunId}`} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        <Link
                          href={toBBUrl(x.kode)}
                          className="underline-offset-2 hover:underline"
                          title="Lihat Buku Besar akun ini"
                        >
                          {x.kode} — {x.nama}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right">Rp {fmtIDR(x.nilai)}</td>
                    </tr>
                  ))}
                  <tr className="bg-white/[0.02] text-slate-200">
                    <td className="px-3 py-2 font-medium">Total Beban</td>
                    <td className="px-3 py-2 text-right font-medium">Rp {fmtIDR(lr.totals.beban)}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-white/[0.04] text-slate-100">
                  <tr>
                    <td className="px-3 py-2 font-semibold">Laba Bersih</td>
                    <td className="px-3 py-2 text-right font-semibold">Rp {fmtIDR(lr.totals.labaBersih)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Neraca */}
          {tab === "neraca" && neraca && !loading && (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04] text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">Akun</th>
                    <th className="px-3 py-2 text-right">Saldo (D)</th>
                    <th className="px-3 py-2 text-right">Saldo (C)</th>
                  </tr>
                </thead>
                <tbody className="text-slate-100">
                  {/* ASET */}
                  <tr className="bg-white/[0.03]"><td className="px-3 py-2 font-semibold">ASET</td><td/><td/></tr>
                  {neraca.items.filter(x=>x.tipe==="ASET" && (x.closingDebit||x.closingKredit)).map(x=>(
                    <tr key={`a-${x.akunId}`} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        <Link href={toBBUrl(x.kode)} className="underline-offset-2 hover:underline" title="Lihat Buku Besar akun ini">
                          {x.kode} — {x.nama}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right">Rp {fmtIDR(x.closingDebit)}</td>
                      <td className="px-3 py-2 text-right">Rp {fmtIDR(x.closingKredit)}</td>
                    </tr>
                  ))}
                  <tr className="bg-white/[0.02] text-slate-200">
                    <td className="px-3 py-2 font-medium">Total Aset</td>
                    <td className="px-3 py-2 text-right font-medium">Rp {fmtIDR(neraca.totals.asetD)}</td>
                    <td className="px-3 py-2 text-right font-medium">Rp {fmtIDR(neraca.totals.asetC)}</td>
                  </tr>

                  {/* KEWAJIBAN */}
                  <tr className="bg-white/[0.03]"><td className="px-3 py-2 font-semibold">KEWAJIBAN</td><td/><td/></tr>
                  {neraca.items.filter(x=>x.tipe==="KEWAJIBAN" && (x.closingDebit||x.closingKredit)).map(x=>(
                    <tr key={`k-${x.akunId}`} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        <Link href={toBBUrl(x.kode)} className="underline-offset-2 hover:underline" title="Lihat Buku Besar akun ini">
                          {x.kode} — {x.nama}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right">Rp {fmtIDR(x.closingDebit)}</td>
                      <td className="px-3 py-2 text-right">Rp {fmtIDR(x.closingKredit)}</td>
                    </tr>
                  ))}

                  {/* EKUITAS */}
                  <tr className="bg-white/[0.03]"><td className="px-3 py-2 font-semibold">EKUITAS</td><td/><td/></tr>
                  {neraca.items.filter(x=>x.tipe==="EKUITAS" && (x.closingDebit||x.closingKredit)).map(x=>(
                    <tr key={`e-${x.akunId}`} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        <Link href={toBBUrl(x.kode)} className="underline-offset-2 hover:underline" title="Lihat Buku Besar akun ini">
                          {x.kode} — {x.nama}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right">Rp {fmtIDR(x.closingDebit)}</td>
                      <td className="px-3 py-2 text-right">Rp {fmtIDR(x.closingKredit)}</td>
                    </tr>
                  ))}
                  <tr className="bg-white/[0.02] text-slate-200">
                    <td className="px-3 py-2 font-medium">Total Kewajiban + Ekuitas</td>
                    <td className="px-3 py-2 text-right font-medium">Rp {fmtIDR(neraca.totals.kewajibanEkuitasD)}</td>
                    <td className="px-3 py-2 text-right font-medium">Rp {fmtIDR(neraca.totals.kewajibanEkuitasC)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex items-center justify-end gap-2 p-2">
                <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${neraca.totals.balanced ? "bg-emerald-500/15 text-emerald-200 border border-emerald-300/20" : "bg-rose-500/15 text-rose-200 border border-rose-300/20"}`}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {neraca.totals.balanced ? "Seimbang" : "Tidak Seimbang"}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
    </AkShell>
  );
}
