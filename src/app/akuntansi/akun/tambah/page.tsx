"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  RefreshCw,
  Save,
  TriangleAlert,
  CheckCircle2,
  PlusCircle,
} from "lucide-react";

/* ================= helpers ================= */
type Role = "ADMIN" | "PETUGAS" | "TEKNISI" | "PIMPINAN";
type UserLocal = { nama: string; role: Role } | null;

type AkunType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "CONTRA_ASSET"
  | "CONTRA_REVENUE";

type NormalBalance = "DEBIT" | "CREDIT";

type AkunMeta = { id: number; kode: string; nama: string };

/* ================= page ================= */
export default function AkunTambahPage() {
  const router = useRouter();

  // ------- role guard -------
  const [user, setUser] = useState<UserLocal>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) {
        router.replace("/login");
        return;
      }
      const u = JSON.parse(raw) as UserLocal;
      setUser(u);
      if (!u || !["ADMIN", "PIMPINAN"].includes(u.role)) {
        router.replace("/forbidden");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  // ------- meta: daftar akun untuk induk -------
  const [akuns, setAkuns] = useState<AkunMeta[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const loadMeta = async () => {
    setLoadingMeta(true);
    try {
      const r = await fetch("/api/akuntansi/akun", { cache: "no-store" });
      const rows = r.ok ? await r.json() : [];
      setAkuns(
        Array.isArray(rows)
          ? rows.map((x: any) => ({ id: x.id, kode: x.kode, nama: x.nama }))
          : []
      );
    } catch {
      // no-op
    } finally {
      setLoadingMeta(false);
    }
  };
  useEffect(() => {
    loadMeta();
  }, []);

  // ------- form state -------
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [tipe, setTipe] = useState<AkunType>("ASSET");
  const [normal, setNormal] = useState<NormalBalance>("DEBIT");
  const [parentId, setParentId] = useState<string>(""); // "" = tanpa induk
  const [isActive, setIsActive] = useState(true);

  // UX
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // opsi tipe akun
  const tipeOptions: Array<{ v: AkunType; label: string }> = useMemo(
    () => [
      { v: "ASSET", label: "Asset" },
      { v: "LIABILITY", label: "Liability" },
      { v: "EQUITY", label: "Equity" },
      { v: "REVENUE", label: "Revenue" },
      { v: "EXPENSE", label: "Expense" },
      { v: "CONTRA_ASSET", label: "Kontra Aset" },
      { v: "CONTRA_REVENUE", label: "Kontra Pendapatan" },
    ],
    []
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!kode.trim()) return setErr("Kode wajib diisi.");
    if (!nama.trim()) return setErr("Nama wajib diisi.");

    // Sanitasi parentId: kosong → null (bukan 0 / "")
    const pNum = Number(parentId);
    const parentIdClean =
      Number.isFinite(pNum) && pNum > 0 ? pNum : null;

    const payload = {
      kode: kode.trim(),
      nama: nama.trim(),
      tipe,
      normal,
      isActive,
      parentId: parentIdClean, // <= kunci: null bila tanpa induk
    };

    try {
      setSubmitting(true);
      const r = await fetch("/api/akuntansi/akun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || "Gagal menyimpan akun.");
      }
      setOk("Akun berhasil ditambahkan.");
      setTimeout(() => router.push("/akuntansi/akun"), 600);
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan akun.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <main className="p-6">
        <div className="animate-pulse text-gray-500">Menyiapkan halaman…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
            Tambah Akun
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={loadMeta}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
              title="Muat ulang referensi"
            >
              <RefreshCw size={16} /> Muat ulang
            </button>
            <Link
              href="/akuntansi/akun"
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
            >
              <ChevronLeft size={16} /> Kembali
            </Link>
          </div>
        </div>

        {/* Alerts */}
        {err && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <TriangleAlert className="shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-semibold">Gagal</div>
              <div className="text-sm whitespace-pre-wrap">{err}</div>
            </div>
          </div>
        )}
        {ok && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-semibold">Berhasil</div>
              <div className="text-sm">{ok}</div>
            </div>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="bg-white border border-gray-200 rounded-2xl shadow-sm"
        >
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Kode
              </label>
              <input
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                placeholder="Mis. 1210"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nama
              </label>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Mis. Aset Tetap"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tipe
              </label>
              <select
                value={tipe}
                onChange={(e) => setTipe(e.target.value as AkunType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-400"
              >
                {tipeOptions.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Normal Balance
              </label>
              <select
                value={normal}
                onChange={(e) => setNormal(e.target.value as NormalBalance)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-400"
              >
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Kredit</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Induk (opsional)
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-400"
                disabled={loadingMeta}
              >
                <option value="">— Tanpa induk —</option>
                {akuns.map((a) => (
                  <option key={a.id} value={a.id.toString()}>
                    {a.kode} — {a.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="aktif"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <label htmlFor="aktif" className="text-sm text-gray-800">
                Aktif
              </label>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
            <Link
              href="/akuntansi/akun"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Kembali ke daftar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={16} />
              {submitting ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>

        {/* Hint contoh cepat */}
        <div className="text-xs text-gray-600">
          Contoh cepat:
          <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="p-2 rounded border bg-gray-50">
              <b>1210</b> — Aset Tetap (ASSET/DEBIT)
            </div>
            <div className="p-2 rounded border bg-gray-50">
              <b>1219</b> — Akumulasi Penyusutan AT (CONTRA_ASSET/CREDIT, induk 1210)
            </div>
            <div className="p-2 rounded border bg-gray-50">
              <b>5110</b> — Beban Penyusutan (EXPENSE/DEBIT)
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
