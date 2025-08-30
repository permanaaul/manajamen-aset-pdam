//app/hublang/baca/components/CorrectionDialog.tsx
"use client";
import React from "react";
import useToast from "../../../../components/Toast";

export default function CorrectionDialog({
  bacaId, angkaKiniNow, onClose, onDone,
}: { bacaId:number; angkaKiniNow:number|null; onClose():void; onDone():void; }) {
  const { push, View } = useToast();
  const [angkaKini, setAngkaKini] = React.useState<string>(angkaKiniNow != null ? String(angkaKiniNow) : "");
  const [alasan, setAlasan] = React.useState("");

  const submit = async () => {
    try {
      const payload = { bacaId, angkaKini: angkaKini === "" ? null : Number(angkaKini), alasan };
      const res = await fetch("/api/hublang/baca/koreksi", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal koreksi");
      push("✅ Koreksi tersimpan", "ok");
      onDone();
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center z-40">
      <View />
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Koreksi Bacaan</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-black">✕</button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-gray-700">Angka Kini (baru)</label>
            <input value={angkaKini} onChange={(e)=>setAngkaKini(e.target.value)} inputMode="numeric" className="border rounded w-full px-3 py-2" />
          </div>
          <div>
            <label className="text-gray-700">Alasan</label>
            <textarea value={alasan} onChange={(e)=>setAlasan(e.target.value)} className="border rounded w-full px-3 py-2" rows={3}/>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">Batal</button>
          <button onClick={submit} className="px-4 py-2 rounded bg-indigo-600 text-white">Simpan</button>
        </div>
      </div>
    </div>
  );
}
