// app/neraca-saldo/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import AkShell, { glass } from "@/components/AkShell";
import { Filter, Download, ExternalLink, HelpCircle, X } from "lucide-react";

type Pos = "DEBIT" | "KREDIT";
type TipeAkun = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";

type TBRow = {
  akunId:number; kode:string; nama:string; pos:Pos; tipe:TipeAkun;
  openingDebit:number; openingKredit:number;
  mutDebit:number; mutKredit:number;
  closingDebit:number; closingKredit:number;
};
type TBResp = {
  periode: { dari:string; sampai:string };
  status: "ALL"|"POSTED"|"DRAFT";
  items: TBRow[];
  totals: {
    openingDebit:number; openingKredit:number;
    mutDebit:number; mutKredit:number;
    closingDebit:number; closingKredit:number;
    balancedMut:boolean; balancedClosing:boolean;
  };
};

const fmtIDR = (n:number) => n.toLocaleString("id-ID");

export default function NeracaSaldoPage() {
  const [q, setQ] = React.useState("");
  const [dari, setDari] = React.useState<string>(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  });
  const [sampai, setSampai] = React.useState<string>(() => {
    const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,"0")}-${String(last.getDate()).padStart(2,"0")}`;
  });
  const [status, setStatus] = React.useState<"POSTED"|"ALL"|"DRAFT">("POSTED");

  const [data, setData] = React.useState<TBResp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const apply = async () => {
    setErr(null); setLoading(true);
    try {
      const url = `/api/neraca-saldo?dari=${dari}&sampai=${sampai}&status=${status}&q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      const j: any = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal memuat Neraca Saldo");
      setData(j as TBResp);
    } catch (e:any) {
      setErr(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const lines = [
      ["Kode","Nama","Tipe","SA Debet","SA Kredit","Mut Debet","Mut Kredit","SK Debet","SK Kredit"],
      ...data.items.map(it => [
        it.kode, it.nama, it.tipe,
        it.openingDebit, it.openingKredit,
        it.mutDebit, it.mutKredit,
        it.closingDebit, it.closingKredit
      ])
    ];
    const csv = lines.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neraca-saldo_${data.periode.dari.slice(0,10)}_${data.periode.sampai.slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  React.useEffect(() => { apply(); /* auto load default */ }, []); // eslint-disable-line

  return (
    <AkShell title="Neraca Saldo" subtitle="Trial Balance per periode" full>
      <section className={`${glass} p-4`}>
        {/* Filter Bar */}
        <div className="grid grid-cols-12 gap-3">
          {/* 🔎 Cari — diperkecil */}
          <div className="col-span-12 md:col-span-8 lg:col-span-3">
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              onKeyDown={(e)=>{ if(e.key==="Enter") apply(); }}
              placeholder="Cari akun (kode/nama)…"
              className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none lg:max-w-[22rem]"
            />
          </div>

          <div className="col-span-6 lg:col-span-2">
            <input type="date" value={dari} onChange={(e)=>setDari(e.target.value)}
                   className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"/>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <input type="date" value={sampai} onChange={(e)=>setSampai(e.target.value)}
                   className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"/>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <select
              value={status}
              onChange={(e)=>setStatus(e.target.value as any)}
              className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"
            >
              <option value="POSTED">POSTED</option>
              <option value="ALL">ALL</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>

          {/* Aksi: Terapkan + CSV kiri, Bantuan ikon di ujung kanan */}
          <div className="col-span-12 md:col-span-4 lg:col-span-3 flex items-center gap-2">
            <button
              onClick={apply}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-400/20 px-3 text-sm text-indigo-100 hover:bg-indigo-400/30"
            >
              <Filter className="h-4 w-4" /> Terapkan
            </button>
            <button
              onClick={exportCSV}
              disabled={!data}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 text-sm hover:bg-white/15 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <HelpNeracaSaldoButton variant="icon" className="ml-auto" />
          </div>
        </div>

        <div className="mt-4">
          {err && <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</div>}
          {loading && <div className="h-24 animate-pulse rounded-lg bg-white/5" />}

          {data && !loading && (
            <>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-[1] bg-white/[0.04] text-slate-200 backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 text-left">Kode</th>
                      <th className="px-3 py-2 text-left">Nama</th>
                      <th className="px-3 py-2 text-left">Tipe</th>
                      <th className="px-3 py-2 text-right">SA (D)</th>
                      <th className="px-3 py-2 text-right">SA (C)</th>
                      <th className="px-3 py-2 text-right">Mutasi (D)</th>
                      <th className="px-3 py-2 text-right">Mutasi (C)</th>
                      <th className="px-3 py-2 text-right">SK (D)</th>
                      <th className="px-3 py-2 text-right">SK (C)</th>
                      <th className="px-3 py-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-100">
                    {data.items.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-slate-300/70">
                          Tidak ada data pada periode ini.
                        </td>
                      </tr>
                    )}
                    {data.items.map(it => (
                      <tr key={it.akunId} className="border-t border-white/10 hover:bg-white/[0.03]">
                        <td className="px-3 py-2 font-mono">{it.kode}</td>
                        <td className="px-3 py-2">{it.nama}</td>
                        <td className="px-3 py-2">{it.tipe}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.openingDebit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.openingKredit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.mutDebit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.mutKredit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.closingDebit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(it.closingKredit)}</td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/akuntansi/buku-besar`}
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                            title="Buka Buku Besar"
                          >
                            Buku Besar <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {data.items.length > 0 && (
                    <tfoot className="bg-white/[0.03] text-slate-200">
                      <tr>
                        <td className="px-3 py-2" colSpan={3}>Total</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(data.totals.openingDebit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(data.totals.openingKredit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(data.totals.mutDebit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(data.totals.mutKredit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(data.totals.closingDebit)}</td>
                        <td className="px-3 py-2 text-right">Rp {fmtIDR(data.totals.closingKredit)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-slate-300">
                  Periode: {new Date(data.periode.dari).toLocaleDateString("id-ID")} — {new Date(data.periode.sampai).toLocaleDateString("id-ID")}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 ${data.totals.balancedMut ? "bg-emerald-500/15 text-emerald-200 border border-emerald-300/20" : "bg-rose-500/15 text-rose-200 border border-rose-300/20"}`}>
                    Mutasi {data.totals.balancedMut ? "Seimbang" : "Tidak Seimbang"}
                  </span>
                  <span className={`rounded px-2 py-0.5 ${data.totals.balancedClosing ? "bg-emerald-500/15 text-emerald-200 border border-emerald-300/20" : "bg-rose-500/15 text-rose-200 border border-rose-300/20"}`}>
                    Saldo Akhir {data.totals.balancedClosing ? "Seimbang" : "Tidak Seimbang"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </AkShell>
  );
}

/* ====================== Bantuan (Modal) ====================== */
function HelpNeracaSaldoButton({ variant = "text", className = "" }:{
  variant?: "text" | "icon";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          variant === "icon"
            ? `ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/15 ${className}`
            : `inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/15 ${className}`
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Bantuan Neraca Saldo"
      >
        <HelpCircle className="h-4 w-4" />
        {variant !== "icon" && <span className="text-sm">Bantuan</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-0 grid place-items-center px-4">
            <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl">
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Bantuan Neraca Saldo</h3>
                  <p className="text-sm text-slate-300/80">Ringkasan & cara membacanya saat demo</p>
                </div>
                <button
                  ref={closeBtnRef}
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-slate-300 hover:bg-white/10"
                  aria-label="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-4 text-sm leading-relaxed text-slate-200">
                <section>
                  <h4 className="mb-1 font-semibold text-slate-100">Tujuan</h4>
                  <p>
                    Menyajikan ringkasan semua akun pada <b>periode terpilih</b> untuk memastikan pembukuan
                    <b> seimbang</b> (total Debit = total Kredit).
                  </p>
                </section>

                <section>
                  <h4 className="mb-1 font-semibold text-slate-100">Arti Kolom</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    <li><b>SA (D/C)</b>: <i>Saldo Awal</i> hingga <b>sebelum</b> tanggal “Dari”.</li>
                    <li><b>Mutasi (D/C)</b>: total transaksi di <b>dalam periode</b>.</li>
                    <li><b>SK (D/C)</b>: <i>Saldo Akhir</i> = SA + Mutasi.</li>
                  </ul>
                </section>

                <section>
                  <h4 className="mb-1 font-semibold text-slate-100">Normal Balance (aturan cepat)</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    <li><b>Aset</b> & <b>Beban</b> cenderung saldo <b>Debit</b>.</li>
                    <li><b>Kewajiban</b>, <b>Ekuitas</b>, <b>Pendapatan</b> cenderung saldo <b>Kredit</b>.</li>
                    <li><b>Akun kontra</b> (contoh: Akumulasi Penyusutan) kebalikan dari induknya, sering tampil di kolom Kredit.</li>
                  </ul>
                </section>

                <section>
                  <h4 className="mb-1 font-semibold text-slate-100">Cara Demo Cepat (±60 detik)</h4>
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>Pilih <b>periode</b> lalu klik <b>Terapkan</b>.</li>
                    <li>Tunjukkan badge <b>Mutasi/Saldo Akhir Seimbang</b>.</li>
                    <li>Klik <b>Buku Besar</b> pada satu akun untuk melihat mutasi & running saldo.</li>
                    <li>(Opsional) Klik <b>CSV</b> untuk ekspor audit/arsip.</li>
                  </ol>
                </section>

                <section>
                  <h4 className="mb-1 font-semibold text-slate-100">Jika “Tidak Seimbang”</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Pastikan filter <b>Status = POSTED</b> (entri DRAFT tidak dihitung).</li>
                    <li>Periksa periode <b>Dari–Sampai</b> (tidak terbalik, satuan tanggal benar).</li>
                    <li>Cek jurnal tidak lengkap (debit ≠ kredit) atau akun yang belum <i>posting</i>.</li>
                    <li>Konsistensi perubahan CoA (tipe/normal balance).</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
