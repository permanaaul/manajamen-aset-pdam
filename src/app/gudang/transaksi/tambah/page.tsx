"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, PlusCircle, Trash2, AlertCircle, Info } from "lucide-react";
import useToast from "@/components/Toast";
import ItemNamaSelect from "@/components/ItemNamaSelect";

type Jenis = "IN" | "OUT" | "ADJ";

type ItemInfo = {
  label?: string;
  satuan?: string | null;
  stok?: number | null;
  hpp?: number | null;
};

type Line = {
  itemId: string;
  qty: string;
  hargaRp?: string;
  asetId?: string;
  pemeliharaanId?: string;
  catatan?: string;
  _info?: ItemInfo;
};

type LineError = { itemId?: string; qty?: string; hargaRp?: string };

/* ===== util ===== */
const cx = (...cls: Array<string | false | null | undefined>) => cls.filter(Boolean).join(" ");

function GlassCard({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cx("rounded-2xl border border-white/10 bg-white/5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/7.5", className)}>
      {children}
    </div>
  );
}

export default function TransaksiNew() {
  const router = useRouter();
  const { push, View } = useToast();

  /* ===== Header ===== */
  const [tanggal, setTanggal] = React.useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [jenis, setJenis] = React.useState<Jenis>("IN");
  const [referensi, setReferensi] = React.useState("");
  const [keterangan, setKeterangan] = React.useState("");

  /* ===== Lines ===== */
  const [lines, setLines] = React.useState<Line[]>([{ itemId: "", qty: "" }]);
  const [lineErrors, setLineErrors] = React.useState<Record<number, LineError>>({});
  const [saving, setSaving] = React.useState(false);

  const parseNum = (v?: string) => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const fmtRp = (n?: number | null) => ((n ?? 0) as number).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

  const addLine = () => setLines((ls) => [...ls, { itemId: "", qty: "" }]);
  const removeLine = (idx: number) => {
    setLines((ls) => ls.filter((_, i) => i !== idx));
    setLineErrors((e) => { const n = { ...e }; delete n[idx]; return n; });
  };
  const updateLine = (idx: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const clearErr = (idx: number, key?: keyof LineError) => setLineErrors((e) => { const curr = { ...(e[idx] || {}) }; if (key) delete curr[key]; else return { ...e, [idx]: {} }; return { ...e, [idx]: curr }; });

  const totalQty = lines.reduce((s, l) => s + (parseNum(l.qty) || 0), 0);
  const totalRp = lines.reduce((s, l) => s + (parseNum(l.qty) || 0) * (parseNum(l.hargaRp) || 0), 0);

  async function loadItemInfo(id: number): Promise<ItemInfo> {
    try {
      const r = await fetch(`/api/gudang/items/${id}`);
      const j = await r.json();
      const satuan = j?.satuan?.nama ?? j?.satuan ?? j?.Satuan?.nama ?? j?.satuanNama ?? null;
      const saldo = j?.StokSaldo || j?.saldo || j?.stok || null;
      const stok = saldo?.qty ?? saldo?.jumlah ?? null;
      const hpp = saldo?.hpp ?? saldo?.harga ?? null;
      const label = (j?.kode ? `${j.kode} — ` : "") + (j?.nama ?? j?.name ?? "");
      return { satuan, stok, hpp, label };
    } catch {
      return {};
    }
  }

  const submit = async () => {
    if (!tanggal) { push("❌ Tanggal wajib diisi", "err"); return; }

    let ok = true; const cleaned: any[] = []; const nextErr: Record<number, LineError> = {};

    lines.forEach((l, i) => {
      const e: LineError = {}; const itemId = parseNum(l.itemId); const qty = parseNum(l.qty); const harga = parseNum(l.hargaRp);
      if (!itemId || itemId <= 0) { e.itemId = "Wajib"; ok = false; }
      if (!qty || qty <= 0) { e.qty = "Wajib"; ok = false; }
      if (jenis === "IN" && (!harga || harga <= 0)) { e.hargaRp = "Harga wajib untuk IN"; ok = false; }
      if (jenis === "OUT" && qty && l._info?.stok != null && qty > l._info.stok!) { e.qty = `Qty melebihi stok (${l._info.stok})`; ok = false; }
      if (Object.keys(e).length) nextErr[i] = e;
      if (itemId && qty && qty > 0 && (jenis !== "IN" || (harga && harga > 0))) {
        cleaned.push({ itemId, qty, hargaRp: jenis === "IN" ? harga : undefined, asetId: parseNum(l.asetId), pemeliharaanId: parseNum(l.pemeliharaanId), catatan: l.catatan?.trim() || undefined });
      }
    });

    setLineErrors(nextErr);
    if (!ok || cleaned.length === 0) { push("❌ Periksa isian baris (item/qty & harga untuk IN).", "err"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/gudang/transaksi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tanggal, jenis, referensi: referensi || null, catatan: keterangan || null, lines: cleaned }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal simpan");
      push("✅ Transaksi dibuat", "ok");
      router.push(`/gudang/transaksi/${data.id}`);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally { setSaving(false); }
  };

  const isIN = jenis === "IN"; const isOUT = jenis === "OUT";

  return (
    <main className="min-h-dvh bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto w-full max-w-none px-6 py-6 space-y-6">
        <View />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Buat Transaksi Gudang</h1>
        </div>

        {/* HEADER CARD */}
        <GlassCard>
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="inline-grid h-8 w-8 place-items-center rounded-lg bg-white/10"><ClipboardList className="h-5 w-5" /></span>
            <div className="font-semibold text-white">Header</div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 text-sm md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-300">Tanggal & Waktu</label>
              <div className="relative">
                <input type="datetime-local" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:ring-white/20" />
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-300">Jenis</label>
              <select value={jenis} onChange={(e) => setJenis(e.target.value as Jenis)} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-slate-100 outline-none ring-1 ring-transparent transition focus:ring-white/20">
                <option value="IN">IN (Masuk)</option>
                <option value="OUT">OUT (Keluar)</option>
                <option value="ADJ">ADJ (Penyesuaian)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-300">Referensi</label>
              <input value={referensi} onChange={(e) => setReferensi(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:ring-white/20" placeholder="PO/WO/Ref lain (opsional)" />
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-[13px] font-medium text-slate-300">Keterangan</label>
              <input value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:ring-white/20" placeholder="Catatan transaksi (opsional)" />
            </div>
          </div>
        </GlassCard>

        {/* LINES CARD */}
        <GlassCard>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-grid h-8 w-8 place-items-center rounded-lg bg-white/10"><ClipboardList className="h-5 w-5" /></span>
              <div className="font-semibold text-white">Item</div>
            </div>
            <button onClick={addLine} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10">
              <PlusCircle className="h-4 w-4" /> Tambah Baris
            </button>
          </div>

          <div className="space-y-4 p-4">
            {lines.map((l, idx) => {
              const err = lineErrors[idx] || {}; const stok = l._info?.stok ?? null; const hpp = l._info?.hpp ?? null; const satuan = l._info?.satuan ?? null; const qtyNum = parseNum(l.qty) || 0; const overStok = isOUT && stok != null && qtyNum > stok;
              return (
                <div key={idx} className="grid grid-cols-12 items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="col-span-12 grid grid-cols-12 gap-2">
                    {/* Nama Item */}
                    <div className="col-span-12 md:col-span-4">
                      <label className="mb-1 block text-xs font-medium text-slate-300">Nama Item <span className="text-rose-300">*</span></label>
                      <ItemNamaSelect
                        onSelect={async (it) => {
                          updateLine(idx, { itemId: String(it.id) });
                          clearErr(idx, "itemId");
                          const info = await loadItemInfo(it.id);
                          updateLine(idx, { _info: info, ...(isOUT && info.hpp != null ? { hargaRp: String(info.hpp) } : {}) });
                        }}
                        placeholder="Ketik untuk pilih item…"
                      />
                      {l._info && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
                          <span className="inline-flex items-center gap-1"><Info className="h-3.5 w-3.5 text-slate-500" /> Stok: <span className="font-medium text-white">{stok ?? 0}</span>{satuan ? <span className="ml-1 text-slate-400">({satuan})</span> : null}</span>
                          <span>HPP: <span className="font-medium text-white">{fmtRp(hpp)}</span></span>
                        </div>
                      )}
                      {err.itemId && (<div className="mt-1 flex items-center gap-1 text-xs text-rose-300"><AlertCircle className="h-3.5 w-3.5" /> {err.itemId}</div>)}
                    </div>

                    {/* Qty */}
                    <div className="col-span-6 md:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-300">Qty <span className="text-rose-300">*</span></label>
                      <input type="number" min="0" step="0.001" value={l.qty} onChange={(e) => { updateLine(idx, { qty: e.target.value }); clearErr(idx, "qty"); }} className={cx("h-10 w-full rounded-xl border px-2 text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:ring-white/20", err.qty || overStok ? "border-rose-400 ring-rose-300/30 bg-white/5" : "border-white/10 bg-white/5") } placeholder="0" />
                      {satuan && (<div className="mt-1 text-[11px] text-slate-400">Satuan: {satuan}</div>)}
                      {(err.qty || overStok) && (<div className="mt-1 flex items-center gap-1 text-xs text-rose-300"><AlertCircle className="h-3.5 w-3.5" />{err.qty || (overStok ? `Qty melebihi stok (${stok})` : "")}</div>)}
                    </div>

                    {/* Harga */}
                    <div className="col-span-6 md:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-300">Harga (Rp){isIN ? <span className="text-rose-300"> *</span> : null}</label>
                      <input type="number" min="0" step="1" value={l.hargaRp || ""} onChange={(e) => updateLine(idx, { hargaRp: e.target.value })} disabled={isOUT} className={cx("h-10 w-full rounded-xl border px-2 text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:ring-white/20", isOUT ? "border-white/10 bg-white/5 text-slate-400" : "border-white/10 bg-white/5", err.hargaRp && "border-rose-400 ring-rose-300/30")} placeholder={isOUT ? "Harga = HPP" : "0"} />
                      {isOUT && (<div className="mt-1 text-[11px] text-slate-400">Harga otomatis menggunakan HPP saat ini.</div>)}
                      {err.hargaRp && (<div className="mt-1 flex items-center gap-1 text-xs text-rose-300"><AlertCircle className="h-3.5 w-3.5" /> {err.hargaRp}</div>)}
                    </div>

                    {/* Aset / Pemeliharaan */}
                    <div className="col-span-6 md:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-300">Aset ID (ops)</label>
                      <input value={l.asetId || ""} onChange={(e) => updateLine(idx, { asetId: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-2 text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:ring-white/20" placeholder="cth: 12" />
                    </div>

                    <div className="col-span-6 md:col-span-3">
                      <label className="mb-1 block text-xs font-medium text-slate-300">Pemeliharaan ID (ops)</label>
                      <input value={l.pemeliharaanId || ""} onChange={(e) => updateLine(idx, { pemeliharaanId: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-2 text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:ring-white/20" placeholder="cth: 5" />
                    </div>

                    <div className="col-span-12 md:col-span-11">
                      <label className="mb-1 block text-xs font-medium text-slate-300">Catatan (ops)</label>
                      <input value={l.catatan || ""} onChange={(e) => updateLine(idx, { catatan: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-2 text-slate-100 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:ring-white/20" placeholder="Keterangan baris" />
                    </div>

                    <div className="col-span-12 md:col-span-1 flex md:block">
                      <button onClick={() => removeLine(idx)} className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-rose-300 transition hover:bg-white/10" title="Hapus baris">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ringkasan */}
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
            <div className="text-slate-300">
              Total baris: <span className="font-semibold text-white">{lines.length}</span> • Total qty: <span className="font-semibold text-white">{totalQty}</span> • Estimasi nilai: <span className="font-semibold text-white">{fmtRp(totalRp)}</span>
            </div>
          </div>
        </GlassCard>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button onClick={() => router.push("/gudang/transaksi")} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">Batal</button>
          <button onClick={submit} disabled={saving} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-black/10 transition hover:opacity-90 disabled:opacity-60">{saving ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </div>
    </main>
  );
}
