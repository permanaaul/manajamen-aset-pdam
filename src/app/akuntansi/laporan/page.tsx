"use client";
import React from "react";
import AkShell, { glass, pill } from "@/components/AkShell";
import { Wallet, Download } from "lucide-react";

type TBRow = { akunId:number; kode:string; nama:string; pos:"DEBIT"|"KREDIT"; debit:number; kredit:number; saldoAkhir:number };
type TBRes = { periode:{tahun:number; bulan:number}; totalDebit:number; totalKredit:number; balanced:boolean; rows:TBRow[]; count:number };

export default function Page(){
  const now = new Date();
  const [tahun,setTahun] = React.useState(now.getFullYear());
  const [bulan,setBulan] = React.useState(now.getMonth()+1);
  const [data,setData]   = React.useState<TBRes|null>(null);
  const [loading,setLoading] = React.useState(true);

  async function load(y= tahun, m= bulan){
    setLoading(true);
    const res: TBRes = await fetch(`/api/akuntansi/trial-balance?tahun=${y}&bulan=${m}`).then(r=>r.json());
    setData(res); setLoading(false);
  }
  React.useEffect(()=>{load()},[]);

  return (
    <AkShell title="Laporan" subtitle="Trial Balance (Neraca Saldo)">
      {/* Filter */}
      <div className={`${glass} p-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-300/80">Bulan</label>
            <select value={bulan} onChange={e=>setBulan(Number(e.target.value))}
              className="h-10 rounded-lg border border-white/10 bg-white/10 px-3 text-sm outline-none">
              {Array.from({length:12}).map((_,i)=>(
                <option key={i} value={i+1}>{new Date(2000,i).toLocaleString("id-ID",{month:"long"})}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-300/80">Tahun</label>
            <input value={tahun} onChange={e=>setTahun(Number(e.target.value))}
              className="h-10 w-28 rounded-lg border border-white/10 bg-white/10 px-3 text-sm outline-none"/>
          </div>
          <button onClick={()=>load()} className="ml-auto rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Terapkan</button>
          <button className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15 inline-flex items-center gap-2">
            <Download className="h-4 w-4"/> Export CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${glass} p-4`}>
          <div className="text-sm text-slate-300">Total Debit</div>
          <div className="mt-2 text-3xl font-semibold">Rp {data? Math.round(data.totalDebit).toLocaleString("id-ID"):"—"}</div>
        </div>
        <div className={`${glass} p-4`}>
          <div className="text-sm text-slate-300">Total Kredit</div>
          <div className="mt-2 text-3xl font-semibold">Rp {data? Math.round(data.totalKredit).toLocaleString("id-ID"):"—"}</div>
        </div>
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-300">Status</div>
            <Wallet className="h-5 w-5 text-indigo-300"/>
          </div>
          <div className="mt-3">
            {data?.balanced
              ? <span className={`${pill} bg-emerald-400/10 text-emerald-300 ring-emerald-400/20`}>Seimbang</span>
              : <span className={`${pill} bg-rose-400/10 text-rose-300 ring-rose-400/20`}>Tidak seimbang</span>}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`${glass} mt-2 overflow-hidden`}>
        {loading ? (
          <div className="h-24 animate-pulse bg-white/5" />
        ) : !data || data.rows.length===0 ? (
          <div className="p-6 text-sm text-slate-300/80">Tidak ada data.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-slate-200">
              <tr>
                <th className="px-3 py-2 text-left">Kode</th>
                <th className="px-3 py-2 text-left">Nama Akun</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Kredit</th>
                <th className="px-3 py-2 text-right">Saldo Akhir</th>
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {data.rows.map((r)=>(
                <tr key={r.akunId} className="border-t border-white/10 hover:bg-white/[0.03]">
                  <td className="px-3 py-2 font-medium">{r.kode}</td>
                  <td className="px-3 py-2">{r.nama}</td>
                  <td className="px-3 py-2 text-right">Rp {Math.round(r.debit).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2 text-right">Rp {Math.round(r.kredit).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2 text-right">Rp {Math.round(r.saldoAkhir).toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AkShell>
  );
}
