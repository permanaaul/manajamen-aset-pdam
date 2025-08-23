"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Save, Tag, Info, CheckCircle2, AlertTriangle } from "lucide-react";

/* ================= Utils kecil ================= */
const cls = (...xs: Array<string | false | undefined>) => xs.filter(Boolean).join(" ");
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

/* ================= Types ================= */
type Role = "ADMIN" | "PIMPINAN" | "PETUGAS" | "TEKNISI" | "GUEST";
type KategoriTipe = "BIAYA" | "PENDAPATAN" | "ASET";
type AkunType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "CONTRA_ASSET"
  | "CONTRA_REVENUE";
type Normal = "DEBIT" | "CREDIT";

type Akun = {
  id: number;
  kode: string;
  nama: string;
  tipe: AkunType;
  normal: Normal;
};

/** Alert kecil */
function Alert({
  tone,
  title,
  message,
  icon,
}: {
  tone: "danger" | "success";
  title: string;
  message: string;
  icon: React.ReactNode;
}) {
  const isDanger = tone === "danger";
  return (
    <div
      className={cls(
        "flex items-start gap-3 rounded-2xl px-4 py-3 border",
        isDanger ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div>{message}</div>
      </div>
    </div>
  );
}

export default function KategoriBiayaTambahPage() {
  const router = useRouter();

  /* ---------- Guard role (TETAP di atas, tidak kondisional) ---------- */
  const [user, setUser] = useState<{ nama: string; role: Role } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.replace("/login");
      setAuthChecked(true);
      return;
    }
    const u = JSON.parse(raw) as { nama: string; role: Role };
    setUser(u);
    if (!["ADMIN", "PIMPINAN"].includes(u.role)) router.replace("/forbidden");
    setAuthChecked(true);
  }, [router]);

  /* ---------- Form state ---------- */
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [tipe, setTipe] = useState<KategoriTipe>("BIAYA");
  const [aktif, setAktif] = useState(true);

  /* ---------- COA mapping ---------- */
  const [akunList, setAkunList] = useState<Akun[]>([]);
  const [akunErr, setAkunErr] = useState("");
  const [debitAkunId, setDebitAkunId] = useState<string>("");
  const [kreditAkunId, setKreditAkunId] = useState<string>("");

  /* ---------- UX ---------- */
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  /* ---------- Keyboard: Ctrl/Cmd+S ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSave) {
        e.preventDefault();
        const btn = document.getElementById("btn-save") as HTMLButtonElement | null;
        btn?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- Load akun (SETELAH auth lolos) ---------- */
  useEffect(() => {
    if (!authChecked || !user) return; // cegah jalan saat belum siap
    let mounted = true;
    (async () => {
      setAkunErr("");
      try {
        const r = await fetch("/api/akuntansi/akun?onlyActive=false", { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const j = (await r.json()) as Akun[];
        const sorted = (Array.isArray(j) ? j : []).sort((a, b) => a.kode.localeCompare(b.kode, "id"));
        if (mounted) setAkunList(sorted);
      } catch (e: any) {
        if (mounted) setAkunErr(e?.message || "Gagal memuat akun COA.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authChecked, user]);

  /* ---------- Rekomendasi tipe akun ---------- */
  const debitRecs: Record<KategoriTipe, AkunType[]> = {
    BIAYA: ["EXPENSE"],
    PENDAPATAN: ["ASSET"],
    ASET: ["ASSET"],
  };
  const kreditRecs: Record<KategoriTipe, AkunType[]> = {
    BIAYA: ["ASSET", "LIABILITY"],
    PENDAPATAN: ["REVENUE"],
    ASET: ["ASSET", "LIABILITY"],
  };
  const recDebit = debitRecs[tipe];
  const recKredit = kreditRecs[tipe];

  const rekomendasiDebit = useMemo(() => akunList.filter((a) => recDebit.includes(a.tipe)), [akunList, recDebit]);
  const rekomendasiKredit = useMemo(() => akunList.filter((a) => recKredit.includes(a.tipe)), [akunList, recKredit]);

  const getAkunById = (id?: string) => akunList.find((a) => a.id === Number(id || 0));
  const debitMatch = !debitAkunId || (getAkunById(debitAkunId) && recDebit.includes(getAkunById(debitAkunId)!.tipe));
  const kreditMatch =
    !kreditAkunId || (getAkunById(kreditAkunId) && recKredit.includes(getAkunById(kreditAkunId)!.tipe));

  /* ---------- Submit ---------- */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!kode.trim()) return setErr("Kode wajib diisi.");
    if (!nama.trim()) return setErr("Nama wajib diisi.");
    if (kode.length > 16) return setErr("Maksimal panjang kode adalah 16 karakter.");

    if ((tipe === "BIAYA" || tipe === "PENDAPATAN") && (!debitAkunId || !kreditAkunId)) {
      return setErr("Untuk tipe BIAYA/PENDAPATAN, hubungkan Akun Debit & Akun Kredit agar bisa diposting ke GL.");
    }

    try {
      setSubmitting(true);
      const payload: any = {
        kode: kode.trim().toUpperCase(),
        nama: nama.trim(),
        tipe,
        isActive: aktif,
      };
      if (debitAkunId) payload.debitAkunId = Number(debitAkunId);
      if (kreditAkunId) payload.kreditAkunId = Number(kreditAkunId);

      const r = await fetch("/api/akuntansi/kategori-biaya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        let msg = "Gagal menyimpan kategori.";
        try {
          const j = await r.json();
          if (j?.error) msg = j.error;
          if (j?.code === "P2002") msg = "Kode sudah digunakan.";
        } catch {}
        throw new Error(msg);
      }

      setOk("Kategori berhasil ditambahkan.");
      setTimeout(() => router.push("/akuntansi/kategori-biaya"), 600);
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan kategori.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- UI ---------- */
  const stillChecking = !authChecked;
  const blocked = authChecked && !user; // sedang diarahkan ke /login atau /forbidden

  return (
    <main className="min-h-screen bg-gray-50 antialiased">
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600/10 p-2 text-blue-700">
              <Tag size={20} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
                Tambah Kategori Biaya
              </h1>
              <p className="text-sm text-gray-500">
                Gunakan kode singkat (mis. <span className="font-mono">MAT</span>,{" "}
                <span className="font-mono">JASA</span>) dan hubungkan ke COA agar transaksi bisa diposting ke GL.
              </p>
            </div>
          </div>

          <Link
            href="/akuntansi/kategori-biaya"
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
            Kembali
          </Link>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-800">
          <Info className="mt-0.5 shrink-0" size={18} />
          <div className="text-sm">
            <div className="font-semibold">Panduan singkat</div>
            <ul className="ml-4 list-disc space-y-0.5">
              <li>
                <b>BIAYA</b>: <i>Debit</i> ke <b>EXPENSE</b>, <i>Kredit</i> ke <b>ASSET/LIABILITY</b>.
              </li>
              <li>
                <b>PENDAPATAN</b>: <i>Debit</i> ke <b>ASSET</b>, <i>Kredit</i> ke <b>REVENUE</b>.
              </li>
              <li>
                <b>ASET</b>: <i>Debit</i> ke <b>ASSET</b> (kapitalisasi), <i>Kredit</i> ke <b>ASSET/LIABILITY</b>.
              </li>
            </ul>
          </div>
        </div>

        {/* Alerts */}
        {err && <Alert tone="danger" title="Gagal" message={err} icon={<AlertTriangle size={18} />} />}
        {ok && <Alert tone="success" title="Berhasil" message={ok} icon={<CheckCircle2 size={18} />} />}

        {/* Kalau masih cek auth / diarahkan, tampilkan skeleton supaya hooks tetap stabil */}
        {(stillChecking || blocked) ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
            <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            <div className="h-24 w-full bg-gray-200 rounded animate-pulse" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="p-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Kode */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Kode <span className="text-red-500">*</span>
                </label>
                <input
                  value={kode}
                  onChange={(e) => setKode(e.target.value.toUpperCase())}
                  onBlur={(e) => setKode(e.target.value.trim().toUpperCase())}
                  placeholder="Contoh: MAT"
                  maxLength={16}
                  className={inputCls}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Maks. 16 karakter. Otomatis huruf besar.</p>
              </div>

              {/* Tipe */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Tipe <span className="text-red-500">*</span>
                </label>
                <select value={tipe} onChange={(e) => setTipe(e.target.value as KategoriTipe)} className={inputCls}>
                  <option value="BIAYA">BIAYA</option>
                  <option value="PENDAPATAN">PENDAPATAN</option>
                  <option value="ASET">ASET</option>
                </select>
              </div>

              {/* Nama */}
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Nama <span className="text-red-500">*</span>
                </label>
                <input
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  onBlur={(e) => setNama(e.target.value.trim())}
                  placeholder="Contoh: Suku Cadang/Material"
                  className={cls(inputCls, "w-full")}
                  required
                />
              </div>

              {/* Akun Debit */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-500">Akun Debit</label>
                  <small className="text-[11px] text-gray-500">Disarankan: {debitRecs[tipe].join(" / ")}</small>
                </div>
                {akunErr ? (
                  <div className="text-xs text-rose-700">{akunErr}</div>
                ) : (
                  <select value={debitAkunId} onChange={(e) => setDebitAkunId(e.target.value)} className={inputCls}>
                    <option value="">— Pilih akun debit (opsional) —</option>
                    {rekomendasiDebit.length > 0 && (
                      <optgroup label="Disarankan">
                        {rekomendasiDebit.map((a) => (
                          <option key={`deb-rec-${a.id}`} value={a.id}>
                            {a.kode} — {a.nama} ({a.tipe})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Semua akun">
                      {akunList.map((a) => (
                        <option key={`deb-all-${a.id}`} value={a.id}>
                          {a.kode} — {a.nama} ({a.tipe})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                )}
                {!debitMatch && (
                  <p className="mt-1 text-xs text-amber-700">⚠️ Tipe akun debit kurang sesuai untuk tipe ini.</p>
                )}
              </div>

              {/* Akun Kredit */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-500">Akun Kredit</label>
                  <small className="text-[11px] text-gray-500">Disarankan: {kreditRecs[tipe].join(" / ")}</small>
                </div>
                {akunErr ? (
                  <div className="text-xs text-rose-700">{akunErr}</div>
                ) : (
                  <select value={kreditAkunId} onChange={(e) => setKreditAkunId(e.target.value)} className={inputCls}>
                    <option value="">— Pilih akun kredit (opsional) —</option>
                    {rekomendasiKredit.length > 0 && (
                      <optgroup label="Disarankan">
                        {rekomendasiKredit.map((a) => (
                          <option key={`kre-rec-${a.id}`} value={a.id}>
                            {a.kode} — {a.nama} ({a.tipe})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Semua akun">
                      {akunList.map((a) => (
                        <option key={`kre-all-${a.id}`} value={a.id}>
                          {a.kode} — {a.nama} ({a.tipe})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                )}
                {!kreditMatch && (
                  <p className="mt-1 text-xs text-amber-700">⚠️ Tipe akun kredit kurang sesuai untuk tipe ini.</p>
                )}
              </div>

              {/* Aktif */}
              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={aktif}
                    onChange={(e) => setAktif(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                  />
                  Aktif
                </label>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
              <span className="text-xs text-gray-500">
                Pintasan: <kbd className="rounded border bg-gray-50 px-1.5 py-0.5">Ctrl/⌘ + S</kbd>
              </span>

              <div className="flex items-center gap-2">
                <Link href="/akuntansi/kategori-biaya" className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50">
                  Batal
                </Link>
                <button
                  id="btn-save"
                  type="submit"
                  disabled={submitting}
                  className={cls(
                    "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white",
                    "hover:bg-blue-700 disabled:opacity-60"
                  )}
                >
                  <Save size={16} />
                  {submitting ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
