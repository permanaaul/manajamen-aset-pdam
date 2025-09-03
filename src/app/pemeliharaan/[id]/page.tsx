"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, PackagePlus, Save, X, Filter as FilterIcon, RotateCcw } from "lucide-react";
import useToast from "@/components/Toast";

type ItemRow = {
  id: number;
  item: { id: number; kode: string; nama: string; satuan: string | null };
  qty: number;
  hargaRp: number;
  totalRp: number;
  catatan?: string | null;
};
type Head = {
  id: number;
  no: string;
  tanggal: string | null;
  jenis: string | null;
  pelaksana: string | null;
  status: string | null;
  biaya: number | null;
  catatan: string | null;
  jenisPekerjaan?: string | null;
  strategi?: string | null;
  downtimeJam?: number | null;
  aset?: { id: number; nia: string; nama: string; lokasi?: string | null } | null;
  items: ItemRow[];
  summary?: { totalQty: number; totalRp: number };
};

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";
const fmtNum = (n: number) => (Number.isFinite(n) ? n.toLocaleString("id-ID") : "0");
const fmtRp  = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function PemeliharaanDetail() {
  const params = useParams();
  const id = Number((params as any)?.id);
  const { View, push } = useToast();

  const [data, setData] = React.useState<Head | null>(null);
  const [loading, setLoading] = React.useState(true);

  // modal tambah item
  const [modal, setModal] = React.useState<{ open: boolean; gudangId: string; saving: boolean; items: Array<{ item: any|null; qty: string; harga: string; catatan: string }>}>({
    open: false, gudangId: "", saving: false, items: [{ item: null, qty: "", harga: "", catatan: "" }]
  });

  const load = React.useCallback(async ()=>{
    setLoading(true);
    try {
      const res = await fetch(`/api/pemeliharaan/${id}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal memuat");
      setData(d);
    } catch (e:any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setLoading(false);
    }
  }, [id, push]);

  React.useEffect(()=>{ if(id) load(); }, [id, load]);

  // lookup item (autocomplete kecil)
  const [qItem, setQItem] = React.useState("");
  const [itemList, setItemList] = React.useState<Array<{id:number; kode:string; nama:string; satuan?: string|null}>>([]);
  const searchItem = React.useCallback(async ()=>{
    const sp = new URLSearchParams({ type: "item" });
    if (qItem) sp.set("q", qItem);
    const res = await fetch(`/api/gudang/lookup?${sp.toString()}`);
    const d = await res.json();
    const rows = (d.rows || []).map((r:any)=>({ id:r.id, kode:r.kode, nama:r.nama, satuan: r?.satuan?.simbol ?? r?.satuan ?? null }));
    setItemList(rows);
  }, [qItem]);
  React.useEffect(()=>{ searchItem(); }, [searchItem]);

  const addLine = () => setModal(s=>({ ...s, items: [...s.items, { item: null, qty: "", harga: "", catatan: "" }] }));
  const delLine = (idx:number) => setModal(s=>({ ...s, items: s.items.filter((_,i)=>i!==idx) }));

  const submitItems = async () => {
    if (!data) return;
    const bodyItems = modal.items
      .map((l)=>({
        itemId: Number(l.item?.id || 0),
        qty: Number(l.qty || 0),
        hargaRp: l.harga ? Number(l.harga) : null,
        catatan: l.catatan || null
      }))
      .filter((x)=> x.itemId>0 && x.qty>0);

    if (bodyItems.length===0) { push("Isi minimal satu baris item yang valid.", "err"); return; }

    setModal(s=>({ ...s, saving: true }));
    try {
      const res = await fetch(`/api/pemeliharaan/${data.id}/items`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ gudangId: modal.gudangId ? Number(modal.gudangId) : undefined, items: bodyItems })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal menambah item");
      push("✅ Item ditambahkan & stok berkurang (ISSUE)", "ok");
      setModal({ open:false, gudangId:"", saving:false, items:[{ item:null, qty:"", harga:"", catatan:"" }] });
      await load();
    } catch (e:any) {
      push(`❌ ${e.message}`, "err");
      setModal(s=>({ ...s, saving:false }));
    }
  };

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold">Detail Pemeliharaan</h1>
          <p className="text-[13px] text-gray-700">Rincian pekerjaan & konsumsi sparepart.</p>
        </div>
        <Link href="/pemeliharaan" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" /> Kembali
        </Link>
      </div>

      {loading && <div className="rounded-2xl border border-gray-200 bg-white p-6">Memuat…</div>}
      {!loading && data && (
        <>
          {/* Ringkasan */}
          <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-7 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-bold uppercase text-gray-800 mb-2">Informasi</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
                <div className="text-gray-600">No</div><div className="font-semibold">{data.no}</div>
                <div className="text-gray-600">Tanggal</div><div className="font-semibold">{fmtDateTime(data.tanggal)}</div>
                <div className="text-gray-600">Aset</div>
                <div className="font-semibold">
                  {data.aset ? (<><div>{data.aset.nia}</div><div className="text-xs text-gray-700">{data.aset.nama}</div></>) : "-"}
                </div>
                <div className="text-gray-600">Pelaksana</div><div className="font-semibold">{data.pelaksana || "-"}</div>
                <div className="text-gray-600">Jenis</div><div className="font-semibold">{data.jenis || "-"}</div>
                <div className="text-gray-600">Status</div><div className="font-semibold">{data.status || "-"}</div>
                <div className="text-gray-600">Biaya</div><div className="font-semibold">{fmtRp(Number(data.biaya||0))}</div>
                <div className="text-gray-600">Catatan</div><div className="font-semibold">{data.catatan || "-"}</div>
              </div>
            </div>
            <div className="md:col-span-5 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-bold uppercase text-gray-800 mb-2">Ringkasan Sparepart</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
                <div className="text-gray-600">Total Qty</div><div className="font-semibold">{fmtNum(data.summary?.totalQty || 0)}</div>
                <div className="text-gray-600">Total Nilai</div><div className="font-semibold">{fmtRp(data.summary?.totalRp || 0)}</div>
              </div>

              <button
                onClick={()=>setModal(s=>({ ...s, open: true }))}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white px-3 py-2 font-semibold hover:bg-indigo-700"
              >
                <PackagePlus className="h-4 w-4" /> Tambah Item
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-[14px]">
              <thead className="bg-gray-50">
                <tr className="text-gray-800">
                  <th className="px-3 py-2 text-left font-semibold">Item</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">HPP/Unit (Rp)</th>
                  <th className="px-3 py-2 text-right font-semibold">Total (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length===0 && (<tr><td colSpan={4} className="px-3 py-8 text-center">Belum ada item.</td></tr>)}
                {data.items.map((r,i)=>(
                  <tr key={r.id} className={`${i%2?"bg-gray-50/40":"bg-white"} border-t`}>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.item.kode}</div>
                      <div className="text-xs text-gray-700">{r.item.nama}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{fmtNum(r.qty)}{r.item.satuan? ` ${r.item.satuan}`:""}</td>
                    <td className="px-3 py-2 text-right">{fmtRp(r.hargaRp)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtRp(r.totalRp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL Tambah Item */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-[820px] max-w-[95vw] border border-gray-200">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="text-lg font-bold">Tambah Item (Issue Stok)</div>
              <button onClick={()=>setModal(s=>({ ...s, open:false }))} className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 items-end">
                <label className="block col-span-2">
                  <div className="mb-1 text-sm font-semibold">Cari Item</div>
                  <div className="flex gap-2">
                    <input value={qItem} onChange={(e)=>setQItem(e.target.value)} placeholder="Ketik kode/nama item…"
                      className="h-11 w-full rounded-xl border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={searchItem} className="h-11 inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 hover:bg-gray-50">
                      <FilterIcon className="h-4 w-4"/> Cari
                    </button>
                    <button onClick={()=>setQItem("")} className="h-11 inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 hover:bg-gray-50">
                      <RotateCcw className="h-4 w-4"/> Reset
                    </button>
                  </div>
                </label>
                <label className="block">
                  <div className="mb-1 text-sm font-semibold">Gudang ID</div>
                  <input type="number" min={1} value={modal.gudangId} onChange={(e)=>setModal(s=>({ ...s, gudangId: e.target.value }))}
                    placeholder="contoh: 3"
                    className="h-11 w-full rounded-xl border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
              </div>

              {/* daftar item hasil cari */}
              <div className="rounded-xl border max-h-48 overflow-auto">
                {itemList.map(it=>(
                  <button key={it.id} onClick={()=>{
                    setModal(s=>{
                      const arr = [...s.items];
                      // cari slot kosong pertama:
                      const idx = arr.findIndex(x=>!x.item);
                      if (idx>=0) arr[idx].item = it;
                      else arr.push({ item: it, qty: "", harga: "", catatan: "" });
                      return { ...s, items: arr };
                    });
                  }} className="w-full px-3 py-2 text-left hover:bg-indigo-50">
                    <div className="font-semibold">{it.kode}</div>
                    <div className="text-xs text-gray-700">{it.nama}{it.satuan? ` • ${it.satuan}`:""}</div>
                  </button>
                ))}
                {itemList.length===0 && <div className="px-3 py-4 text-sm text-gray-600">Tidak ada data.</div>}
              </div>

              {/* form lines */}
              <div className="rounded-xl border overflow-auto">
                <table className="w-full text-[14px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right w-28">Qty</th>
                      <th className="px-3 py-2 text-right w-36">HPP (ops)</th>
                      <th className="px-3 py-2 text-left">Catatan</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {modal.items.map((l, idx)=>(
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">
                          {l.item ? (
                            <>
                              <div className="font-semibold">{l.item.kode}</div>
                              <div className="text-xs text-gray-700">{l.item.nama}</div>
                            </>
                          ) : <span className="text-gray-500">— pilih dari daftar di atas —</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input value={l.qty} onChange={(e)=>setModal(s=>{ const a=[...s.items]; a[idx]={...a[idx], qty:e.target.value}; return {...s, items:a}; })}
                            type="number" className="h-9 w-full rounded-lg border border-gray-300 text-right px-2"/>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input value={l.harga} onChange={(e)=>setModal(s=>{ const a=[...s.items]; a[idx]={...a[idx], harga:e.target.value}; return {...s, items:a}; })}
                            type="number" className="h-9 w-full rounded-lg border border-gray-300 text-right px-2" placeholder="opsional"/>
                        </td>
                        <td className="px-3 py-2">
                          <input value={l.catatan} onChange={(e)=>setModal(s=>{ const a=[...s.items]; a[idx]={...a[idx], catatan:e.target.value}; return {...s, items:a}; })}
                            className="h-9 w-full rounded-lg border border-gray-300 px-2" placeholder="opsional"/>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={()=>delLine(idx)} className="rounded-lg border px-2 py-1 hover:bg-gray-50">Hapus</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={addLine} className="rounded-lg border px-3 py-2 hover:bg-gray-50">Tambah Baris</button>
                <button onClick={submitItems} disabled={modal.saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white px-3 py-2 font-semibold hover:bg-indigo-700 disabled:opacity-60">
                  <Save className="h-4 w-4" /> {modal.saving? "Memproses…":"Simpan & Issue Stok"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
