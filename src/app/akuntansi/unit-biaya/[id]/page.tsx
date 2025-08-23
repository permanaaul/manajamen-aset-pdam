"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  Save,
  Trash2,
  CheckCircle2,
  TriangleAlert,
} from "lucide-react";

type Jenis =
  | "PRODUKSI"
  | "DISTRIBUSI"
  | "PELAYANAN"
  | "ADMINISTRASI"
  | "UMUM_SDM"
  | "LABORATORIUM"
  | "LAINNYA";

const JENIS_OPTIONS: Jenis[] = [
  "PRODUKSI",
  "DISTRIBUSI",
  "PELAYANAN",
  "ADMINISTRASI",
  "UMUM_SDM",
  "LABORATORIUM",
  "LAINNYA",
];

type UnitDetail = {
  id: number;
  kode: string;
  nama: string;
  jenis: Jenis;
  isActive?: boolean | null;
  aktif?: boolean | null; // fallback
  createdAt?: string;
};

export default function UnitBiayaEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  // guard
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as { nama: string; role: string };
    setUser(u);
    if (!["ADMIN", "PIMPINAN"].includes(u.role)) router.replace("/forbidden");
  }, [router]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<UnitDetail>({
    id,
    kode: "",
    nama: "",
    jenis: "LAINNYA",
    isActive: true,
  });

  // load detail
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true); setErr("");
      try {
        const r = await fetch(`/api/akuntansi/unit-biaya/${id}`, { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        setForm({
          id,
          kode: j?.kode ?? "",
          nama: j?.nama ?? "",
          jenis: (j?.jenis ?? "LAINNYA") as Jenis,
          isActive: typeof j?.isActive === "boolean" ? j.isActive : (j?.aktif ?? true),
          aktif: typeof j?.aktif === "boolean" ? j.aktif : undefined,
          createdAt: j?.createdAt,
        });
      } catch (e: any) {
        setErr(e?.message || "Gagal memuat data unit biaya.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const canSubmit = useMemo(
    () => form.kode.trim().length > 0 && form.nama.trim().length > 0 && !!form.jenis,
    [form.kode, form.nama, form.jenis]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (!canSubmit) {
      setErr("Kode, Nama, dan Jenis wajib diisi.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        kode: form.kode.trim().toUpperCase(),
        nama: form.nama.trim(),
        jenis: form.jenis,
        isActive: !!(typeof form.isActive === "boolean" ? form.isActive : form.aktif ?? true),
        aktif: !!(typeof form.isActive === "boolean" ? form.isActive : form.aktif ?? true),
        parentId: null, // tetap flat
      };

      // NOTE: kalau route kamu pakai PUT, ganti method jadi "PUT"
      const r = await fetch(`/api/akuntansi/unit-biaya/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      setOk("Perubahan disimpan.");
      setTimeout(() => router.push("/akuntansi/unit-biaya"), 600);
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan perubahan.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Hapus unit biaya ini secara permanen?")) return;
    try {
      const r = await fetch(`/api/akuntansi/unit-biaya/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      router.push("/akuntansi/unit-biaya");
    } catch (e: any) {
      alert(e?.message || "Gagal menghapus.");
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50 antialiased">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Edit Unit Biaya
            </h1>
          </div>
          <Link
            href="/akuntansi/unit-biaya"
            className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
          >
            <ChevronLeft size={16} /> Kembali
          </Link>
        </div>

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

        {/* Form Card */}
        <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
          {loading ? (
            <div className="text-gray-500">Memuat…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kode</label>
                  <input
                    value={form.kode}
                    onChange={(e) => setForm((s) => ({ ...s, kode: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Jenis</label>
                  <select
                    value={form.jenis}
                    onChange={(e) => setForm((s) => ({ ...s, jenis: e.target.value as Jenis }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-400"
                  >
                    {JENIS_OPTIONS.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nama</label>
                <input
                  value={form.nama}
                  onChange={(e) => setForm((s) => ({ ...s, nama: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(typeof form.isActive === "boolean" ? form.isActive : form.aktif ?? true)}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      isActive: e.target.checked,
                      aktif: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                />
                Aktif
              </label>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-2 border border-red-200 text-red-700 px-3 py-2 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={16} /> Hapus
                </button>
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save size={16} /> {submitting ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </main>
  );
}
