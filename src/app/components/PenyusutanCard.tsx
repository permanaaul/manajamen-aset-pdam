"use client";

import { useEffect, useState } from "react";
import { Calculator, CalendarClock, RefreshCw, Info, Pencil } from "lucide-react";

type Row = {
  id: number;
  periode: string; // ISO dari API
  metode: "GARIS_LURUS" | "SALDO_MENURUN";
  tarif: string | number;
  nilaiAwal: string | number;
  beban: string | number;
  akumulasi: string | number;
  nilaiAkhir: string | number;
};

function rupiah(n: string | number) {
  const v = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v || 0);
}

export default function PenyusutanCard({ asetId }: { asetId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [ringkas, setRingkas] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/penyusutan/${asetId}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal mengambil data penyusutan");
        setRows(
          (data.rows || []).map((r: any) => ({
            ...r,
            periode: r.periode, // tampilkan as is
          }))
        );
        setRingkas(data.ringkas);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [asetId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-5">
        <div className="text-gray-500">⏳ Memuat penyusutan…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="bg-white rounded-xl shadow p-5">
        <div className="text-red-600">{err}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-700 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Penyusutan Aset
        </h2>

        <a
          href={`/penyusutan?asetId=${asetId}`}
          className="text-sm text-blue-600 hover:underline"
          title="Lihat halaman penyusutan lengk ap"
        >
          Lihat semua »
        </a>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500 flex items-center gap-2"><Info className="w-4 h-4" /> Metode</div>
          <div className="font-semibold">{ringkas?.metode ?? "-"}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500">Nilai Buku</div>
          <div className="font-semibold">{rupiah(ringkas?.nilaiBuku ?? 0)}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500">Akumulasi</div>
          <div className="font-semibold">{rupiah(ringkas?.akumulasi ?? 0)}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500 flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Mulai</div>
          <div className="font-semibold">{ringkas?.tahunMulai ?? "-"}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500">Umur (thn)</div>
          <div className="font-semibold">{ringkas?.umur ?? "-"}</div>
        </div>
        <div className="p-3 rounded bg-gray-50">
          <div className="text-gray-500">Nilai Residu</div>
          <div className="font-semibold">{rupiah(ringkas?.nilaiResidu ?? 0)}</div>
        </div>
      </div>

      {/* Tabel (ringkas 8 baris) */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Tahun</th>
              <th className="px-3 py-2 text-left">Metode</th>
              <th className="px-3 py-2 text-left">Tarif</th>
              <th className="px-3 py-2 text-left">Nilai Awal</th>
              <th className="px-3 py-2 text-left">Beban</th>
              <th className="px-3 py-2 text-left">Akumulasi</th>
              <th className="px-3 py-2 text-left">Nilai Akhir</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((r) => {
              const yr = new Date(r.periode).getUTCFullYear();
              return (
                <tr key={yr} className="border-b">
                  <td className="px-3 py-2">{yr}</td>
                  <td className="px-3 py-2">{r.metode}</td>
                  <td className="px-3 py-2">{(Number(r.tarif) * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2">{rupiah(r.nilaiAwal)}</td>
                  <td className="px-3 py-2">{rupiah(r.beban)}</td>
                  <td className="px-3 py-2">{rupiah(r.akumulasi)}</td>
                  <td className="px-3 py-2">{rupiah(r.nilaiAkhir)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  Belum ada jadwal penyusutan (cek parameter aset).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tombol cepat (opsional) */}
      <div className="flex gap-2">
        <a
          href={`/inventarisasi/${asetId}/penyusutan/edit`}
          className="inline-flex items-center gap-2 bg-amber-600 text-white px-3 py-2 rounded hover:bg-amber-700"
          title="Ubah parameter penyusutan aset"
        >
          <Pencil className="w-4 h-4" /> Ubah Parameter
        </a>
        <button
          onClick={async () => {
            try {
              const res = await fetch(`/api/penyusutan/${asetId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}), // regenerate tanpa perubahan
              });
              if (!res.ok) throw new Error("Gagal regenerate");
              location.reload();
            } catch (e) {
              alert("❌ Gagal regenerasi jadwal");
            }
          }}
          className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200"
          title="Regenerasi ulang jadwal (pakai parameter terakhir)"
        >
          <RefreshCw className="w-4 h-4" /> Regenerate
        </button>
      </div>
    </div>
  );
}
