"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
} from "lucide-react";

type SambunganPreview = {
  id: number;
  noSambungan: string;
  diameterMm: number;
  status: "AKTIF" | "TUTUP_SEMENTARA" | "PUTUS";
  golonganTarifId: number;
};

type Row = {
  id: number;
  kode: string;
  nama: string;
  tipe: "SOSIAL" | "NIAGA" | "INSTANSI" | "LAINNYA";
  hp: string | null;
  email: string | null;
  alamatJalan: string | null;
  aktif: boolean;
  _count: { sambungan: number };
  sambungan: SambunganPreview[];
};

export default function PagePelangganList() {
  const [q, setQ] = useState("");
  const [tipe, setTipe] = useState("");
  const [aktif, setAktif] = useState(""); // "", "true", "false"
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // UI state untuk hapus
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchList = async () => {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: "asc",
      });
      if (q) params.set("q", q);
      if (tipe) params.set("tipe", tipe);
      if (aktif) params.set("status", aktif === "true" ? "AKTIF" : "NONAKTIF");

      const res = await fetch(`/api/hublang/pelanggan-sambungan?${params.toString()}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setRows(data.data || []);
      setTotal(data.paging?.total || 0);
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, tipe, aktif]);

  const applyFilter = () => {
    setPage(1);
    fetchList();
  };

  // Hapus pelanggan (beserta sambungan & bacaan)
  const handleDeletePelanggan = async (id: number, label: string) => {
    setDeletingKey(`pel-${id}`);
    setMsg("");
    try {
      const res = await fetch(
        `/api/hublang/pelanggan-sambungan?target=pelanggan&id=${id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus pelanggan");

      setMsg(`✅ Terhapus: ${label}`);
      setConfirmId(null);
      if (rows.length === 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        await fetchList();
      }
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="p-6 space-y-4 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="text-blue-600" size={24} />
          <div>
            <h1 className="text-2xl font-semibold">Pelanggan</h1>
            <p className="text-sm text-gray-600">
              Daftar pelanggan beserta preview sambungan.
            </p>
          </div>
        </div>
        <Link
          href="/hublang/pelanggan-sambungan/tambah"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          <Plus size={16} /> Tambah
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl shadow border border-gray-200 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3">
        <div className="relative">
          <label className="block text-sm text-gray-600">Cari</label>
          <span className="absolute left-2 bottom-2.5 text-gray-400">
            <Search size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            placeholder="nama/kode/email/hp/no sambungan"
            className="border rounded px-8 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Tipe</label>
          <select
            className="border rounded px-3 py-2"
            value={tipe}
            onChange={(e) => {
              setTipe(e.target.value);
              setPage(1);
            }}
          >
            <option value="">(semua)</option>
            {["SOSIAL", "NIAGA", "INSTANSI", "LAINNYA"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Status</label>
          <select
            className="border rounded px-3 py-2"
            value={aktif}
            onChange={(e) => {
              setAktif(e.target.value);
              setPage(1);
            }}
          >
            <option value="">(semua)</option>
            <option value="true">Aktif</option>
            <option value="false">Non-aktif</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={applyFilter}
            disabled={loading}
            className="h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
          >
            {loading ? "Memuat..." : "Terapkan"}
          </button>
        </div>
        {msg && (
          <p className="md:col-span-4 text-sm text-gray-800">{msg}</p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto bg-white rounded-xl shadow border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Kode</th>
              <th className="p-3 text-left">Nama</th>
              <th className="p-3 text-left">Tipe</th>
              <th className="p-3 text-left">Kontak</th>
              <th className="p-3 text-left">Alamat</th>
              <th className="p-3 text-left">Aktif</th>
              <th className="p-3 text-left">Sambungan</th>
              <th className="p-3 text-left w-44">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  Tidak ada data.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isDeleting = deletingKey === `pel-${r.id}`;
                const isConfirm = confirmId === r.id;

                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-3 font-medium">{r.kode}</td>
                    <td className="p-3">{r.nama}</td>
                    <td className="p-3">{r.tipe}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Phone size={14} className="text-gray-400" />{" "}
                          <span>{r.hp || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Mail size={14} className="text-gray-400" />{" "}
                          <span>{r.email || "-"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-start gap-2 text-gray-700">
                        <MapPin size={14} className="text-gray-400 mt-0.5" />
                        <span>{r.alamatJalan ?? "-"}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                          r.aktif
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {r.aktif ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <XCircle size={14} />
                        )}
                        {r.aktif ? "Aktif" : "Non-aktif"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-xs text-gray-700 space-y-1">
                        <div>
                          Total: <b>{r._count.sambungan}</b>
                        </div>
                        {r.sambungan.map((s) => (
                          <div key={s.id} className="text-gray-600">
                            #{s.noSambungan} • Ø{s.diameterMm} • {s.status}
                          </div>
                        ))}
                        {r._count.sambungan > r.sambungan.length && (
                          <div className="text-gray-400">…</div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {!isConfirm ? (
                        <button
                          type="button"
                          onClick={() => setConfirmId(r.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                          title="Hapus pelanggan"
                        >
                          {isDeleting ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                          <span className="hidden sm:inline">Hapus</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-red-50 border border-red-200 text-red-700">
                          <span className="text-xs">Yakin hapus?</span>
                          <button
                            onClick={() => setConfirmId(null)}
                            disabled={isDeleting}
                            className="px-2 py-0.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs disabled:opacity-50"
                          >
                            Batal
                          </button>
                          <button
                            onClick={() =>
                              handleDeletePelanggan(r.id, `${r.kode} — ${r.nama}`)
                            }
                            disabled={isDeleting}
                            className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs disabled:opacity-50"
                          >
                            {isDeleting ? "Menghapus…" : "Hapus"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paging */}
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="text-sm">
          Page {page} / {totalPages}
        </span>
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="ml-2 border rounded px-2 py-1"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
