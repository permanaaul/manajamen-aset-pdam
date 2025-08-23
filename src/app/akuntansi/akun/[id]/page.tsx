"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Layers,
  ChevronLeft,
  Save,
  TriangleAlert,
  CheckCircle2,
  RefreshCw,
  Trash2,
} from "lucide-react";

/* ====== Types ====== */
type AkunType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "CONTRA_ASSET"
  | "CONTRA_REVENUE";
type NormalBalance = "DEBIT" | "CREDIT";

type Akun = {
  id: number;
  kode: string;
  nama: string;
  tipe: AkunType;
  normal: NormalBalance;
  parentId?: number | null;
  isActive?: boolean | null;
  createdAt?: string | null;
};

/* ====== Helpers ====== */
const tipePill = (t: AkunType) =>
  ({
    ASSET: "bg-amber-100 text-amber-800",
    LIABILITY: "bg-violet-100 text-violet-800",
    EQUITY: "bg-emerald-100 text-emerald-800",
    REVENUE: "bg-blue-100 text-blue-800",
    EXPENSE: "bg-rose-100 text-rose-800",
    CONTRA_ASSET: "bg-gray-200 text-gray-800",
    CONTRA_REVENUE: "bg-gray-200 text-gray-800",
  }[t] || "bg-gray-100 text-gray-800");

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID") : "—";

/* ====== Page ====== */
export default function AkunEditPage() {
  const router = useRouter();
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);

  // auth guard
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw);
    setUser(u);
    if (!["ADMIN", "PIMPINAN"].includes(u.role)) router.replace("/forbidden");
  }, [router]);

  // meta + detail
  const [list, setList] = useState<Akun[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [tipe, setTipe] = useState<AkunType>("EXPENSE");
  const [normal, setNormal] = useState<NormalBalance>("DEBIT");
  const [parentId, setParentId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // UX state
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // inline validation (ringan)
  const vKode = useMemo(() => (kode.trim() ? null : "Kode wajib diisi."), [kode]);
  const vNama = useMemo(() => (nama.trim() ? null : "Nama wajib diisi."), [nama]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [lr, dr] = await Promise.all([
        fetch("/api/akuntansi/akun?onlyActive=false", { cache: "no-store" }),
        fetch(`/api/akuntansi/akun/${id}`, { cache: "no-store" }),
      ]);
      const listAll: Akun[] = lr.ok ? await lr.json() : [];
      const d: Akun | null = dr.ok ? await dr.json() : null;

      // jangan tampilkan diri sendiri di pilihan induk
      setList(listAll.filter((a) => a.id !== id));

      if (d) {
        setKode(d.kode || "");
        setNama(d.nama || "");
        setTipe(d.tipe);
        setNormal(d.normal);
        setParentId(d.parentId ? String(d.parentId) : "");
        setIsActive(d.isActive ?? true);
        setCreatedAt(d.createdAt ?? null);
      }
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setOk("");

    if (vKode || vNama) {
      setErr(vKode || vNama || "Periksa isian Anda.");
      return;
    }

    try {
      setSubmitting(true);
      const r = await fetch(`/api/akuntansi/akun/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode: kode.trim().toUpperCase(),
          nama: nama.trim(),
          tipe,
          normal,
          isActive,
          parentId: parentId ? Number(parentId) : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal menyimpan.");
      setOk("Perubahan disimpan.");
      setTimeout(() => router.push("/akuntansi/akun"), 650);
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan.");
    } finally {
      setSubmitting(false);
    }
  };

  const hapus = async () => {
    if (
      !confirm(
        `Hapus akun ini?\n\n${kode} — ${nama}\n\nAksi tidak bisa dibatalkan.`
      )
    )
      return;
    try {
      const r = await fetch(`/api/akuntansi/akun/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      router.push("/akuntansi/akun");
    } catch (e: any) {
      alert(e?.message || "Gagal menghapus.");
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Edit Akun
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
              title="Muat ulang"
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

        {/* Mini facts */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-gray-600">Status</div>
              <div className="mt-1">
                {isActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800">
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-800">
                    Nonaktif
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-gray-600">Tipe</div>
              <div className={`mt-1 inline-block px-2 py-0.5 rounded text-xs ${tipePill(tipe)}`}>
                {tipe}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-gray-600">Dibuat</div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {fmtDate(createdAt)}
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {err && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <TriangleAlert className="shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-semibold">Gagal</div>
              <div className="text-sm">{err}</div>
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
        {!loading && (
          <form
            onSubmit={submit}
            className="bg-white border border-gray-200 rounded-2xl shadow-sm"
          >
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Kode
                </label>
                <input
                  value={kode}
                  onChange={(e) => setKode(e.target.value.toUpperCase())}
                  className={`w-full border rounded-lg px-3 py-2 ${
                    vKode ? "border-red-300 focus:ring-red-200" : "border-gray-300"
                  }`}
                  placeholder="mis. 1210"
                  required
                />
                {vKode && (
                  <div className="text-xs text-red-600 mt-1">{vKode}</div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nama
                </label>
                <input
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 ${
                    vNama ? "border-red-300 focus:ring-red-200" : "border-gray-300"
                  }`}
                  placeholder="mis. Aset Tetap"
                  required
                />
                {vNama && (
                  <div className="text-xs text-red-600 mt-1">{vNama}</div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tipe
                </label>
                <select
                  value={tipe}
                  onChange={(e) => setTipe(e.target.value as AkunType)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="ASSET">Asset</option>
                  <option value="LIABILITY">Liability</option>
                  <option value="EQUITY">Equity</option>
                  <option value="REVENUE">Revenue</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="CONTRA_ASSET">Contra Asset</option>
                  <option value="CONTRA_REVENUE">Contra Revenue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Normal Balance
                </label>
                <select
                  value={normal}
                  onChange={(e) => setNormal(e.target.value as NormalBalance)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Induk (opsional)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">— Tanpa induk —</option>
                  {list.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.kode} — {a.nama}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Jika diisi, akun ini akan menjadi anak dari akun induk yang
                  dipilih.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="isActive" className="text-sm">
                  Aktif
                </label>
              </div>
            </div>

            {/* Actions (sticky on small screens) */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between sticky bottom-0 bg-white rounded-b-2xl">
              <button
                type="button"
                onClick={hapus}
                className="inline-flex items-center gap-2 border border-red-200 text-red-700 px-3 py-2 rounded-lg hover:bg-red-50"
                title="Hapus akun ini"
              >
                <Trash2 size={16} /> Hapus
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <Save size={16} />
                {submitting ? "Menyimpan…" : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        )}

        {loading && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
