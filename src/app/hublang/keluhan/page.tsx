//app/hublang/keluhan/page.tsx
"use client";
import React from "react";
import useToast from "../../../components/Toast";

type Row = {
  id: number;
  tanggal: string;
  kanal: "WALKIN"|"TELP"|"WEB"|"APP"|"LAINNYA";
  ringkas: string;
  status: "OPEN"|"IN_PROGRESS"|"CLOSED"|"CANCELED";
  pelanggan?: { id:number; nama:string } | null;
  sambungan?: { id:number; noSambungan:string } | null;
  workOrder?: { id:number; noWo:string; status:string } | null;
};

export default function PageKeluhan() {
  const { push, View } = useToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [kanal, setKanal] = React.useState("");
  const [show, setShow] = React.useState(false);
  const load = async () => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (kanal) p.set("kanal", kanal);
    const res = await fetch(`/api/hublang/keluhan?${p}`);
    const data = await res.json();
    if (!res.ok) return push(data?.error || "Gagal memuat", "err");
    setRows(data.rows || []);
  };
  React.useEffect(()=>{ load(); }, [q,status,kanal]);

  return (
    <div className="p-6 space-y-5 text-gray-900">
      <View />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Keluhan</h1>
          <p className="text-sm text-gray-600">Pencatatan keluhan pelanggan & keterkaitan WO.</p>
        </div>
        <button onClick={()=>setShow(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">+ Tambah</button>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-wrap items-end gap-3">
        <div>
          <label className="text-sm text-gray-700">Cari</label>
          <input className="border rounded px-3 py-2 text-sm" value={q} onChange={(e)=>setQ(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-gray-700">Status</label>
          <select className="border rounded px-3 py-2 text-sm" value={status} onChange={(e)=>setStatus(e.target.value)}>
            <option value="">(semua)</option>
            {["OPEN","IN_PROGRESS","CLOSED","CANCELED"].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-700">Kanal</label>
          <select className="border rounded px-3 py-2 text-sm" value={kanal} onChange={(e)=>setKanal(e.target.value)}>
            <option value="">(semua)</option>
            {["WALKIN","TELP","WEB","APP","LAINNYA"].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Tanggal</th>
              <th className="px-3 py-2 text-left">Ringkas</th>
              <th className="px-3 py-2 text-left">Pelanggan/Samb.</th>
              <th className="px-3 py-2 text-left">Kanal</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">WO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{new Date(r.tanggal).toLocaleString("id-ID")}</td>
                <td className="px-3 py-2">{r.ringkas}</td>
                <td className="px-3 py-2">
                  <div>{r.pelanggan?.nama || "-"}</div>
                  <div className="text-xs text-gray-500">{r.sambungan?.noSambungan || ""}</div>
                </td>
                <td className="px-3 py-2">{r.kanal}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.workOrder?.noWo || "-"}</td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={6}>Tidak ada data</td></tr>}
          </tbody>
        </table>
      </div>

      {show && <CreateKeluhan onClose={()=>setShow(false)} onSuccess={()=>{setShow(false); load();}} />}
    </div>
  );
}

function CreateKeluhan({ onClose, onSuccess }:{ onClose():void; onSuccess():void; }) {
  const [saving, setSaving] = React.useState(false);
  const [f, setF] = React.useState({ ringkas:"", detail:"", kanal:"WALKIN", pelangganId:"", sambunganId:"", workOrderId:"" });
  const submit = async () => {
    if (!f.ringkas.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ringkas: f.ringkas,
        detail: f.detail || null,
        kanal: f.kanal,
        pelangganId: f.pelangganId ? Number(f.pelangganId) : null,
        sambunganId: f.sambunganId ? Number(f.sambunganId) : null,
        workOrderId: f.workOrderId ? Number(f.workOrderId) : null,
      };
      const res = await fetch("/api/hublang/keluhan", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal simpan");
      onSuccess();
    } catch (e) {
      console.error(e);
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center z-40">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-xl border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Tambah Keluhan</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-black">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <label className="text-gray-700">Ringkas *</label>
            <input value={f.ringkas} onChange={(e)=>setF(s=>({...s, ringkas:e.target.value}))} className="border rounded w-full px-3 py-2" />
          </div>
          <div className="col-span-2">
            <label className="text-gray-700">Detail</label>
            <textarea value={f.detail} onChange={(e)=>setF(s=>({...s, detail:e.target.value}))} className="border rounded w-full px-3 py-2" rows={3}/>
          </div>
          <div>
            <label className="text-gray-700">Kanal</label>
            <select value={f.kanal} onChange={(e)=>setF(s=>({...s, kanal:e.target.value}))} className="border rounded w-full px-3 py-2">
              {["WALKIN","TELP","WEB","APP","LAINNYA"].map(k=> <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-700">Work Order ID</label>
            <input value={f.workOrderId} onChange={(e)=>setF(s=>({...s, workOrderId:e.target.value}))} className="border rounded w-full px-3 py-2" placeholder="opsional" />
          </div>
          <div>
            <label className="text-gray-700">Pelanggan ID</label>
            <input value={f.pelangganId} onChange={(e)=>setF(s=>({...s, pelangganId:e.target.value}))} className="border rounded w-full px-3 py-2" placeholder="opsional" />
          </div>
          <div>
            <label className="text-gray-700">Sambungan ID</label>
            <input value={f.sambunganId} onChange={(e)=>setF(s=>({...s, sambunganId:e.target.value}))} className="border rounded w-full px-3 py-2" placeholder="opsional" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">Batal</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60">{saving ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}
