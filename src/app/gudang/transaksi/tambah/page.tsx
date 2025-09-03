// app/gudang/transaksi/tambah/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  PlusCircle,
  Trash2,
  AlertCircle,
  Info,
} from "lucide-react";
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
  // hanya untuk UI
  _info?: ItemInfo;
};

type LineError = {
  itemId?: string;
  qty?: string;
  hargaRp?: string;
};

export default function TransaksiNew() {
  const router = useRouter();
  const { push, View } = useToast();

  /* ===== Header ===== */
  const [tanggal, setTanggal] = React.useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  });
  const [jenis, setJenis] = React.useState<Jenis>("IN");
  const [referensi, setReferensi] = React.useState("");
  const [keterangan, setKeterangan] = React.useState("");

  /* ===== Lines ===== */
  const [lines, setLines] = React.useState<Line[]>([{ itemId: "", qty: "" }]);
  const [lineErrors, setLineErrors] = React.useState<Record<number, LineError>>(
    {}
  );
  const [saving, setSaving] = React.useState(false);

  /* ===== Helpers ===== */
  const parseNum = (v?: string) => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const fmtRp = (n?: number | null) =>
    ((n ?? 0) as number).toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });

  const addLine = () => setLines((ls) => [...ls, { itemId: "", qty: "" }]);
  const removeLine = (idx: number) => {
    setLines((ls) => ls.filter((_, i) => i !== idx));
    setLineErrors((e) => {
      const n = { ...e };
      delete n[idx];
      return n;
    });
  };
  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const clearErr = (idx: number, key?: keyof LineError) =>
    setLineErrors((e) => {
      const curr = { ...(e[idx] || {}) };
      if (key) delete curr[key];
      else return { ...e, [idx]: {} };
      return { ...e, [idx]: curr };
    });

  const totalQty = lines.reduce((s, l) => s + (parseNum(l.qty) || 0), 0);
  const totalRp = lines.reduce(
    (s, l) => s + (parseNum(l.qty) || 0) * (parseNum(l.hargaRp) || 0),
    0
  );

  async function loadItemInfo(id: number): Promise<ItemInfo> {
    try {
      const r = await fetch(`/api/gudang/items/${id}`);
      const j = await r.json();
      // coba beberapa key supaya fleksibel terhadap API kamu
      const satuan =
        j?.satuan?.nama ??
        j?.satuan ??
        j?.Satuan?.nama ??
        j?.satuanNama ??
        null;
      const saldo = j?.StokSaldo || j?.saldo || j?.stok || null;
      const stok = saldo?.qty ?? saldo?.jumlah ?? null;
      const hpp = saldo?.hpp ?? saldo?.harga ?? null;
      const label =
        (j?.kode ? `${j.kode} — ` : "") + (j?.nama ?? j?.name ?? "");
      return { satuan, stok, hpp, label };
    } catch {
      return {};
    }
  }

  /* ===== Submit ===== */
  const submit = async () => {
    if (!tanggal) {
      push("❌ Tanggal wajib diisi", "err");
      return;
    }

    let ok = true;
    const cleaned: any[] = [];
    const nextErr: Record<number, LineError> = {};

    lines.forEach((l, i) => {
      const e: LineError = {};
      const itemId = parseNum(l.itemId);
      const qty = parseNum(l.qty);
      const harga = parseNum(l.hargaRp);

      if (!itemId || itemId <= 0) {
        e.itemId = "Wajib";
        ok = false;
      }
      if (!qty || qty <= 0) {
        e.qty = "Wajib";
        ok = false;
      }
      if (jenis === "IN" && (!harga || harga <= 0)) {
        e.hargaRp = "Harga wajib untuk IN";
        ok = false;
      }
      if (jenis === "OUT" && qty && l._info?.stok != null && qty > l._info.stok) {
        e.qty = `Qty melebihi stok (${l._info.stok})`;
        ok = false;
      }

      if (Object.keys(e).length) nextErr[i] = e;

      if (itemId && qty && qty > 0 && (jenis !== "IN" || (harga && harga > 0))) {
        cleaned.push({
          itemId,
          qty,
          hargaRp: jenis === "IN" ? harga : undefined, // OUT diabaikan backend
          asetId: parseNum(l.asetId),
          pemeliharaanId: parseNum(l.pemeliharaanId),
          catatan: l.catatan?.trim() || undefined,
        });
      }
    });

    setLineErrors(nextErr);
    if (!ok || cleaned.length === 0) {
      push("❌ Periksa isian baris (item/qty & harga untuk IN).", "err");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/gudang/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggal,
          jenis,
          referensi: referensi || null,
          catatan: keterangan || null,
          lines: cleaned,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal simpan");
      push("✅ Transaksi dibuat", "ok");
      router.push(`/gudang/transaksi/${data.id}`);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setSaving(false);
    }
  };

  const isIN = jenis === "IN";
  const isOUT = jenis === "OUT";

  return (
    <div className="space-y-6 p-6">
      <View />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Buat Transaksi Gudang</h1>
      </div>

      {/* HEADER CARD */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <ClipboardList className="h-5 w-5 text-indigo-600" />
          <div className="font-semibold text-gray-900">Header</div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 text-sm md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-gray-700">Tanggal & Waktu</label>
            <div className="relative">
              <input
                type="datetime-local"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-gray-900 outline-none ring-1 ring-transparent transition focus:ring-indigo-200"
              />
              <CalendarDays className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-gray-700">Jenis</label>
            <select
              value={jenis}
              onChange={(e) => setJenis(e.target.value as Jenis)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 outline-none ring-1 ring-transparent transition focus:ring-indigo-200"
            >
              <option value="IN">IN (Masuk)</option>
              <option value="OUT">OUT (Keluar)</option>
              <option value="ADJ">ADJ (Penyesuaian)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-gray-700">Referensi</label>
            <input
              value={referensi}
              onChange={(e) => setReferensi(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-gray-900 outline-none ring-1 ring-transparent transition placeholder:text-gray-400 focus:ring-indigo-200"
              placeholder="PO/WO/Ref lain (opsional)"
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-[13px] font-medium text-gray-700">Keterangan</label>
            <input
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-gray-900 outline-none ring-1 ring-transparent transition placeholder:text-gray-400 focus:ring-indigo-200"
              placeholder="Catatan transaksi (opsional)"
            />
          </div>
        </div>
      </div>

      {/* LINES CARD */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
            <div className="font-semibold text-gray-900">Item</div>
          </div>
          <button
            onClick={addLine}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <PlusCircle className="h-4 w-4" /> Tambah Baris
          </button>
        </div>

        <div className="space-y-4 p-4">
          {lines.map((l, idx) => {
            const err = lineErrors[idx] || {};
            const stok = l._info?.stok ?? null;
            const hpp = l._info?.hpp ?? null;
            const satuan = l._info?.satuan ?? null;

            const qtyNum = parseNum(l.qty) || 0;
            const overStok = isOUT && stok != null && qtyNum > stok;

            return (
              <div key={idx} className="grid grid-cols-12 items-start gap-2 rounded-lg border border-gray-200 p-3">
                <div className="col-span-12 grid grid-cols-12 gap-2">
                  {/* Nama Item */}
                  <div className="col-span-12 md:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Nama Item <span className="text-rose-600">*</span>
                    </label>
                    <ItemNamaSelect
                      onSelect={async (it) => {
                        updateLine(idx, { itemId: String(it.id) });
                        clearErr(idx, "itemId");
                        const info = await loadItemInfo(it.id);
                        // kalau OUT, tampilkan HPP di input harga (readonly)
                        updateLine(idx, {
                          _info: info,
                          ...(isOUT && info.hpp != null
                            ? { hargaRp: String(info.hpp) }
                            : {}),
                        });
                      }}
                      placeholder="Ketik untuk pilih item…"
                    />
                    {l._info && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <Info className="h-3.5 w-3.5 text-gray-400" />
                          Stok: <span className="font-medium text-gray-900">{stok ?? 0}</span>
                          {satuan ? <span className="ml-1 text-gray-500">({satuan})</span> : null}
                        </span>
                        <span>HPP: <span className="font-medium text-gray-900">{fmtRp(hpp)}</span></span>
                      </div>
                    )}
                    {err.itemId && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5" /> {err.itemId}
                      </div>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="col-span-6 md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Qty <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={l.qty}
                      onChange={(e) => {
                        updateLine(idx, { qty: e.target.value });
                        clearErr(idx, "qty");
                      }}
                      className={`h-10 w-full rounded-lg border px-2 text-gray-900 outline-none ring-1 ring-transparent transition placeholder:text-gray-400 focus:ring-indigo-200 ${
                        err.qty || overStok ? "border-rose-400 ring-rose-100" : "border-gray-300"
                      }`}
                      placeholder="0"
                    />
                    {satuan && (
                      <div className="mt-1 text-[11px] text-gray-500">Satuan: {satuan}</div>
                    )}
                    {(err.qty || overStok) && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {err.qty || (overStok ? `Qty melebihi stok (${stok})` : "")}
                      </div>
                    )}
                  </div>

                  {/* Harga */}
                  <div className="col-span-6 md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Harga (Rp){isIN ? <span className="text-rose-600"> *</span> : null}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={l.hargaRp || ""}
                      onChange={(e) => updateLine(idx, { hargaRp: e.target.value })}
                      disabled={isOUT}
                      className={`h-10 w-full rounded-lg border px-2 text-gray-900 outline-none ring-1 ring-transparent transition placeholder:text-gray-400 focus:ring-indigo-200 ${
                        isOUT ? "border-gray-200 bg-gray-50 text-gray-500" : "border-gray-300"
                      } ${err.hargaRp ? "border-rose-400 ring-rose-100" : ""}`}
                      placeholder={isOUT ? "Harga = HPP" : "0"}
                    />
                    {isOUT && (
                      <div className="mt-1 text-[11px] text-gray-500">
                        Harga otomatis menggunakan HPP saat ini.
                      </div>
                    )}
                    {err.hargaRp && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5" /> {err.hargaRp}
                      </div>
                    )}
                  </div>

                  {/* Aset / Pemeliharaan */}
                  <div className="col-span-6 md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Aset ID (ops)
                    </label>
                    <input
                      value={l.asetId || ""}
                      onChange={(e) => updateLine(idx, { asetId: e.target.value })}
                      className="h-10 w-full rounded-lg border border-gray-300 px-2 text-gray-900 outline-none ring-1 ring-transparent transition placeholder:text-gray-400 focus:ring-indigo-200"
                      placeholder="cth: 12"
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Pemeliharaan ID (ops)
                    </label>
                    <input
                      value={l.pemeliharaanId || ""}
                      onChange={(e) => updateLine(idx, { pemeliharaanId: e.target.value })}
                      className="h-10 w-full rounded-lg border border-gray-300 px-2 text-gray-900 outline-none ring-1 ring-transparent transition placeholder:text-gray-400 focus:ring-indigo-200"
                      placeholder="cth: 5"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-11">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Catatan (ops)
                    </label>
                    <input
                      value={l.catatan || ""}
                      onChange={(e) => updateLine(idx, { catatan: e.target.value })}
                      className="h-10 w-full rounded-lg border border-gray-300 px-2 text-gray-900 outline-none ring-1 ring-transparent transition placeholder:text-gray-400 focus:ring-indigo-200"
                      placeholder="Keterangan baris"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-1 flex md:block">
                    <button
                      onClick={() => removeLine(idx)}
                      className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-rose-600 transition hover:bg-gray-50"
                      title="Hapus baris"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ringkasan */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm">
          <div className="text-gray-600">
            Total baris:{" "}
            <span className="font-semibold text-gray-900">{lines.length}</span>{" "}
            • Total qty:{" "}
            <span className="font-semibold text-gray-900">{totalQty}</span> • Estimasi nilai:{" "}
            <span className="font-semibold text-gray-900">{fmtRp(totalRp)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => router.push("/gudang/transaksi")}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          Batal
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-indigo-500/20 transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}
