// src/app/akuntansi/kategori-biaya/[id]/page.tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Save,
  Trash2,
  Tag,
  Layers,
  Info,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

type AkunType =
  | "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"
  | "CONTRA_ASSET" | "CONTRA_REVENUE";
type NormalBalance = "DEBIT" | "CREDIT";

type Akun = {
  id: number;
  kode: string;
  nama: string;
  tipe: AkunType;
  normal: NormalBalance;
  isActive?: boolean | null;
};

type ApiKategori = {
  id: number;
  kode: string;
  nama: string;
  tipe?: "BIAYA" | "PENDAPATAN" | "ASET" | null;
  isActive?: boolean | null; aktif?: boolean | null;
  createdAt?: string | null;
  debitAkunId?: number | null;
  kreditAkunId?: number | null;
  debitAkun?: { id: number; kode: string; nama: string } | null;
  kreditAkun?: { id: number; kode: string; nama: string } | null;
};

type FormState = {
  kode: string;
  nama: string;
  tipe: "BIAYA" | "PENDAPATAN" | "ASET";
  isActive: boolean;
  debitAkunId: number | null;
  kreditAkunId: number | null;
};

const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("id-ID") : "—";

const tipeBadge = (t?: string | null) => {
  switch (t) {
    case "BIAYA": return "bg-blue-100 text-blue-800";
    case "PENDAPATAN": return "bg-emerald-100 text-emerald-800";
    case "ASET": return "bg-amber-100 text-amber-800";
    default: return "bg-gray-100 text-gray-800";
  }
};
const akunPill = (t: AkunType) => {
  switch (t) {
    case "ASSET": return "bg-amber-100 text-amber-800";
    case "LIABILITY": return "bg-violet-100 text-violet-800";
    case "EQUITY": return "bg-emerald-100 text-emerald-800";
    case "REVENUE": return "bg-blue-100 text-blue-800";
    case "EXPENSE": return "bg-rose-100 text-rose-800";
    default: return "bg-gray-200 text-gray-800";
  }
};

export default function KategoriBiayaEditPage() {
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

  // states
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [meta, setMeta] = useState<{ createdAt?: string | null } | null>(null);

  const [form, setForm] = useState<FormState>({
    kode: "", nama: "", tipe: "BIAYA", isActive: true, debitAkunId: null, kreditAkunId: null,
  });

  const [akunList, setAkunList] = useState<Akun[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // load detail + akun
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true); setErr("");
      try {
        const [kr, ar] = await Promise.all([
          fetch(`/api/akuntansi/kategori-biaya/${id}`, { cache: "no-store" }),
          fetch(`/api/akuntansi/akun?onlyActive=false`, { cache: "no-store" }),
        ]);
        if (!kr.ok) throw new Error(await kr.text());
        const j: ApiKategori = await kr.json();
        const al: Akun[] = ar.ok ? (await ar.json()) : [];
        al.sort((a, b) => a.kode.localeCompare(b.kode));
        setAkunList(al);

        const active = typeof j.isActive === "boolean" ? j.isActive : (j.aktif ?? true);
        setForm({
          kode: j.kode ?? "",
          nama: j.nama ?? "",
          tipe: (j.tipe as FormState["tipe"]) ?? "BIAYA",
          isActive: active,
          debitAkunId: j.debitAkunId ?? j.debitAkun?.id ?? null,
          kreditAkunId: j.kreditAkunId ?? j.kreditAkun?.id ?? null,
        });
        setMeta({ createdAt: j.createdAt });
      } catch (e: any) {
        setErr(e?.message || "Gagal memuat data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // ⬇️ PANGGIL hook INI **SEBELUM** early return agar order stabil
  const akunOptions = useMemo(() => {
    const aktif = akunList.filter(a => a.isActive ?? true);
    const non = akunList.filter(a => !(a.isActive ?? true));
    return { aktif, non };
  }, [akunList]);

  if (!user) return null; // aman: semua hooks sudah dipanggil di atas

  const akunLabel = (a: Akun) => `${a.kode} — ${a.nama}`;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (!form.kode.trim() || !form.nama.trim()) { setErr("Kode & Nama wajib diisi."); return; }
    try {
      setSaving(true);
      const r = await fetch(`/api/akuntansi/kategori-biaya/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode: form.kode.trim().toUpperCase(),
          nama: form.nama.trim(),
          tipe: form.tipe,
          isActive: form.isActive,
          debitAkunId: form.debitAkunId ?? null,
          kreditAkunId: form.kreditAkunId ?? null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setOk("Perubahan disimpan.");
      setTimeout(() => router.push("/akuntansi/kategori-biaya"), 600);
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Hapus kategori ini secara permanen?")) return;
    setErr("");
    try {
      setDeleting(true);
      const r = await fetch(`/api/akuntansi/kategori-biaya/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      router.push("/akuntansi/kategori-biaya");
    } catch (e: any) {
      setErr(e?.message || "Gagal menghapus kategori (mungkin masih dipakai jurnal/anggaran).");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="text-blue-600" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Edit Kategori Biaya
            </h1>
          </div>
          <Link
            href="/akuntansi/kategori-biaya"
            className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm text-gray-800"
          >
            <ChevronLeft size={16} /> Kembali
          </Link>
        </div>

        {/* Alerts */}
        {err && (
          <div className="bg-red-50 text-red-800 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="text-sm">{err}</div>
          </div>
        )}
        {ok && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
            <div className="text-sm">{ok}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Layers className="text-gray-600" size={18} />
              <span className="font-semibold text-gray-900">Informasi Kategori</span>
            </div>

            <div className="p-5 space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Kode</label>
                      <input
                        value={form.kode}
                        onChange={(e) => setForm(s => ({ ...s, kode: e.target.value }))}
                        placeholder="Contoh: MAT"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-400"
                        required
                      />
                      <p className="text-xs text-gray-700 mt-1">Gunakan kode singkat huruf besar (unik).</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tipe</label>
                      <select
                        value={form.tipe}
                        onChange={(e) => setForm(s => ({ ...s, tipe: e.target.value as FormState["tipe"] }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="BIAYA">BIAYA</option>
                        <option value="PENDAPATAN">PENDAPATAN</option>
                        <option value="ASET">ASET</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nama</label>
                    <input
                      value={form.nama}
                      onChange={(e) => setForm(s => ({ ...s, nama: e.target.value }))}
                      placeholder="Contoh: Biaya Material"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-400"
                      required
                    />
                  </div>

                  {/* Mapping Akun */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Akun Debit (akun biaya)</label>
                      <select
                        value={form.debitAkunId ?? ""}
                        onChange={(e) => setForm(s => ({ ...s, debitAkunId: e.target.value === "" ? null : Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="">— Tidak dipilih —</option>
                        {akunOptions.aktif.map(a => (
                          <option key={a.id} value={a.id}>{akunLabel(a)}</option>
                        ))}
                        {akunOptions.non.length > 0 && (
                          <optgroup label="Nonaktif">
                            {akunOptions.non.map(a => (
                              <option key={a.id} value={a.id}>{akunLabel(a)}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Akun Kredit (akun lawan)</label>
                      <select
                        value={form.kreditAkunId ?? ""}
                        onChange={(e) => setForm(s => ({ ...s, kreditAkunId: e.target.value === "" ? null : Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="">— Tidak dipilih —</option>
                        {akunOptions.aktif.map(a => (
                          <option key={a.id} value={a.id}>{akunLabel(a)}</option>
                        ))}
                        {akunOptions.non.length > 0 && (
                          <optgroup label="Nonaktif">
                            {akunOptions.non.map(a => (
                              <option key={a.id} value={a.id}>{akunLabel(a)}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600">
                    Tip: Untuk kategori <b>BIAYA</b>, umumnya <b>Debit</b> = akun biaya (EXPENSE),
                    <b> Kredit</b> = akun kas/bank/utang yang sesuai.
                  </p>

                  <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm(s => ({ ...s, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                    />
                    Aktif
                  </label>
                </>
              )}
            </div>
          </section>

          <aside className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Info className="text-gray-600" size={18} />
              <span className="font-semibold text-gray-900">Ringkasan</span>
            </div>
            <div className="p-5 space-y-3 text-sm text-gray-800">
              <div className="flex items-center justify-between"><span className="text-gray-700">ID</span><span className="font-mono">{id}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-700">Dibuat</span><span>{fmtDateTime(meta?.createdAt)}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-700">Tipe</span><span className={`px-2 py-0.5 rounded ${tipeBadge(form.tipe)}`}>{form.tipe}</span></div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="w-full inline-flex items-center justify-center gap-2 border border-red-200 text-red-700 px-3 py-2 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={16} /> {deleting ? "Menghapus…" : "Hapus Kategori"}
                </button>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-3 flex items-center justify-between pt-1">
            <Link href="/akuntansi/kategori-biaya" className="text-sm text-gray-700 hover:text-gray-900">
              Batal & Kembali
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {saving ? "Menyimpan…" : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
