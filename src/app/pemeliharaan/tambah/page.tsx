// app/pemeliharaan/tambah/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, Search, Loader2 } from "lucide-react";
import useToast from "@/components/Toast";

type AsetPick = { id: number; nia: string; nama: string; lokasi?: string | null };

const KERJA = [
  "INSPEKSI",
  "PELUMASAN",
  "KALIBRASI",
  "GANTI_SPAREPART",
  "PERBAIKAN_RINGAN",
  "PERBAIKAN_BESAR",
  "OVERHAUL",
  "TESTING",
] as const;

const STRATEGI = ["PREVENTIF", "KOREKTIF", "PREDIKTIF"] as const;

export default function TambahPemeliharaan() {
  const router = useRouter();
  const { View, push } = useToast();

  const [saving, setSaving] = React.useState(false);

  // form
  const [aset, setAset] = React.useState<AsetPick | null>(null);
  const [cari, setCari] = React.useState("");
  const [tanggal, setTanggal] = React.useState(new Date().toISOString().substring(0, 10));
  const [pelaksana, setPelaksana] = React.useState("");
  const [jenis, setJenis] = React.useState("PEMELIHARAAN");
  const [status, setStatus] = React.useState("OPEN");
  const [biaya, setBiaya] = React.useState<number | "">("");
  const [catatan, setCatatan] = React.useState("");
  const [jenisPekerjaan, setJenisPekerjaan] = React.useState("");
  const [strategi, setStrategi] = React.useState("");

  // lookup aset
  const [listAset, setListAset] = React.useState<AsetPick[]>([]);
  const [loadingLookup, setLoadingLookup] = React.useState(false);

  const searchAset = React.useCallback(async (keyword: string) => {
    setLoadingLookup(true);
    try {
      const sp = new URLSearchParams({ type: "aset" });
      if (keyword) sp.set("q", keyword);
      const res = await fetch(`/api/pemeliharaan/lookup?${sp.toString()}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal memuat aset");

      type Row = { id: number; nia: string; nama: string; lokasi?: string | null };
      const rows: Row[] = Array.isArray(d?.rows) ? d.rows : [];
      const mapped: AsetPick[] = rows.map((r: Row) => ({
        id: Number(r.id),
        nia: String(r.nia || "-"),
        nama: String(r.nama || "-"),
        lokasi: r.lokasi ?? null,
      }));
      setListAset(mapped);
    } catch (e: any) {
      setListAset([]);
      push(`❌ ${String(e?.message || "Gagal memuat aset")}`, "err");
    } finally {
      setLoadingLookup(false);
    }
  }, [push]);

  // debounce pencarian
  React.useEffect(() => {
    const t = setTimeout(() => searchAset(cari.trim()), 300);
    return () => clearTimeout(t);
  }, [cari, searchAset]);

  // muat awal
  React.useEffect(() => { searchAset(""); }, [searchAset]);

  const submit = async () => {
    if (!aset?.id) {
      push("Pilih aset terlebih dulu.", "err");
      return;
    }
    setSaving(true);
    try {
      const body = {
        asetId: aset.id,
        tanggal,
        pelaksana: pelaksana || "-",
        jenis,
        status,
        biaya: biaya === "" ? null : Number(biaya),
        catatan: catatan || null,
        jenisPekerjaan: jenisPekerjaan || null,
        strategi: strategi || null,
      };
      const res = await fetch("/api/pemeliharaan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Gagal menyimpan");
      router.push(`/pemeliharaan/${d.id}`);
    } catch (e: any) {
      push(`❌ ${e.message}`, "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <View />
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-extrabold tracking-tight">Tambah Pemeliharaan</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/pemeliharaan"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" /> Batal / Kembali
          </Link>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        {/* Kolom Aset */}
        <div className="md:col-span-6 rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="text-sm font-bold uppercase text-gray-800">Aset</div>

          <label className="block">
            <div className="mb-1 text-sm font-semibold">Cari Aset</div>
            <div className="flex gap-2">
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Ketik NIA / nama aset…"
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => searchAset(cari.trim())}
                className="h-11 inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 text-[14px] hover:bg-gray-50"
              >
                {loadingLookup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Cari
              </button>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              Tips: biarkan kosong untuk menampilkan aset terbaru.
            </div>
          </label>

          <div className="mt-2 max-h-56 overflow-auto rounded-xl border">
            {loadingLookup ? (
              <div className="px-3 py-6 text-gray-600 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat aset…
              </div>
            ) : listAset.length === 0 ? (
              <div className="px-3 py-6 text-gray-600 text-sm">Tidak ada data.</div>
            ) : (
              listAset.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAset(a)}
                  className={`w-full px-3 py-2 text-left hover:bg-indigo-50 ${
                    aset?.id === a.id ? "bg-indigo-50" : ""
                  }`}
                >
                  <div className="font-semibold">{a.nia}</div>
                  <div className="text-xs text-gray-700">
                    {a.nama} {a.lokasi ? `— ${a.lokasi}` : ""}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="mt-3 rounded-xl border p-3 bg-gray-50 text-sm">
            <div className="font-semibold mb-1">Aset terpilih</div>
            {aset ? (
              <>
                <div>
                  NIA: <b>{aset.nia}</b>
                </div>
                <div>
                  Nama: <b>{aset.nama}</b>
                </div>
                <div>
                  Lokasi: <b>{aset.lokasi || "-"}</b>
                </div>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>

        {/* Kolom Detail */}
        <div className="md:col-span-6 rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="text-sm font-bold uppercase text-gray-800">Detail</div>

          <label className="block">
            <div className="mb-1 text-sm font-semibold">Tanggal</div>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-sm font-semibold">Pelaksana</div>
              <input
                value={pelaksana}
                onChange={(e) => setPelaksana(e.target.value)}
                placeholder="mis. TIM A / Vendor X"
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm font-semibold">Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="OPEN">OPEN</option>
                <option value="SELESAI">SELESAI</option>
                <option value="BATAL">BATAL</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-sm font-semibold">Jenis Pekerjaan (opsional)</div>
              <select
                value={jenisPekerjaan}
                onChange={(e) => setJenisPekerjaan(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">(pilih)</option>
                {KERJA.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-sm font-semibold">Strategi (opsional)</div>
              <select
                value={strategi}
                onChange={(e) => setStrategi(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">(pilih)</option>
                {STRATEGI.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-sm font-semibold">Jenis</div>
              <input
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm font-semibold">Biaya (Rp)</div>
              <input
                type="number"
                value={biaya}
                onChange={(e) => setBiaya(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-1 text-sm font-semibold">Catatan</div>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="min-h-[90px] w-full rounded-xl border border-gray-300 px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
