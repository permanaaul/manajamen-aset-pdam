//app/hublang/sambungan/[id]/MeterLogForm.tsx
"use client";
import React from "react";
import useToast from "../../../../components/Toast";

export default function MeterLogForm({ sambunganId }: { sambunganId:number }) {
  const { push, View } = useToast();
  const [f, setF] = React.useState({ meterId:"", event:"PASANG", tanggal:"", digitAwal:"", digitAkhir:"", catatan:"" });

  const submit = async () => {
    try {
      const payload = {
        sambunganId,
        meterId: f.meterId ? Number(f.meterId) : null,
        event: f.event,
        tanggal: f.tanggal || null,
        digitAwal: f.digitAwal === "" ? null : Number(f.digitAwal),
        digitAkhir: f.digitAkhir === "" ? null : Number(f.digitAkhir),
        catatan: f.catatan || null,
      };
      const res = await fetch("/api/hublang/meter/riwayat", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal simpan");
      push("✅ Riwayat meter tersimpan", "ok");
      setF({ meterId:"", event:"PASANG", tanggal:"", digitAwal:"", digitAkhir:"", catatan:"" });
    } catch (e:any) {
      push(`❌ ${e.message}`, "err");
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm">
      <View />
      <h3 className="font-semibold mb-2">Tambah Riwayat Meter</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label className="text-gray-700">Event</label>
          <select value={f.event} onChange={(e)=>setF(s=>({...s, event:e.target.value}))} className="border rounded w-full px-3 py-2">
            {["PASANG","GANTI","CABUT","SERVIS","LAINNYA"].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="text-gray-700">Tanggal</label>
          <input type="datetime-local" value={f.tanggal} onChange={(e)=>setF(s=>({...s, tanggal:e.target.value}))} className="border rounded w-full px-3 py-2" />
        </div>
        <div>
          <label className="text-gray-700">Meter ID (opsional)</label>
          <input value={f.meterId} onChange={(e)=>setF(s=>({...s, meterId:e.target.value}))} className="border rounded w-full px-3 py-2" />
        </div>
        <div>
          <label className="text-gray-700">Digit Awal</label>
          <input value={f.digitAwal} onChange={(e)=>setF(s=>({...s, digitAwal:e.target.value}))} inputMode="numeric" className="border rounded w-full px-3 py-2" />
        </div>
        <div>
          <label className="text-gray-700">Digit Akhir</label>
          <input value={f.digitAkhir} onChange={(e)=>setF(s=>({...s, digitAkhir:e.target.value}))} inputMode="numeric" className="border rounded w-full px-3 py-2" />
        </div>
        <div className="col-span-2">
          <label className="text-gray-700">Catatan</label>
          <input value={f.catatan} onChange={(e)=>setF(s=>({...s, catatan:e.target.value}))} className="border rounded w-full px-3 py-2" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={submit} className="px-4 py-2 rounded bg-indigo-600 text-white">Simpan</button>
      </div>
    </div>
  );
}
