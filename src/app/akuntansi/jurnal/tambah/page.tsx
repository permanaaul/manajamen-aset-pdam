"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  NotebookPen,
  ChevronLeft,
  Save,
  TriangleAlert,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Scale,
  Info,
  Sparkles,
} from "lucide-react";

/* ================= helpers ================= */
const toIDR = (n: number = 0) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);

const round2 = (n: number) => Math.round(n * 100) / 100;

const sanitizeMoneyInput = (s: string) => s.replace(/[^\d.,-]/g, "");
function parseMoney(v: unknown): number {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? round2(n) : 0;
}
const cls = (...xs: Array<string | false | undefined>) => xs.filter(Boolean).join(" ");

/* ================= types ================= */
type AkunMini = { id: number; kode: string; nama: string };
type Kategori = {
  id: number;
  nama: string;
  tipe?: "BIAYA" | "PENDAPATAN" | "ASET" | null;
  debitAkunId?: number | null;
  kreditAkunId?: number | null;
  debitAkun?: AkunMini | null;
  kreditAkun?: AkunMini | null;
};
type Unit = { id: number; nama: string };

/* ================= page ================= */
export default function JurnalTambahPage() {
  const router = useRouter();

  /* role guard */
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return router.replace("/login");
      const u = JSON.parse(raw) as { nama: string; role: string };
      setUser(u);
      if (!["ADMIN", "PIMPINAN"].includes(u.role)) router.replace("/forbidden");
    } catch {
      router.replace("/login");
    }
  }, [router]);

  /* meta */
  const [kategoris, setKategoris] = useState<Kategori[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const reloadMeta = async () => {
    setLoadingMeta(true);
    try {
      const [kr, ur] = await Promise.all([
        fetch("/api/akuntansi/kategori-biaya", { cache: "no-store" }),
        fetch("/api/akuntansi/unit-biaya", { cache: "no-store" }),
      ]);
      setKategoris(kr.ok ? await kr.json() : []);
      setUnits(ur.ok ? await ur.json() : []);
    } finally {
      setLoadingMeta(false);
    }
  };
  useEffect(() => {
    reloadMeta();
  }, []);

  /* form state */
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [tanggal, setTanggal] = useState<string>(today);
  const [ref, setRef] = useState<string>("");
  const [uraian, setUraian] = useState<string>("");
  const [kategoriId, setKategoriId] = useState<string>("");

  const [debit, setDebit] = useState<string>("0");
  const [kredit, setKredit] = useState<string>("0");

  const [alokasiUnitIds, setAlokasiUnitIds] = useState<number[]>([]);

  /* ux */
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string>("");
  const [okMsg, setOkMsg] = useState<string>("");

  /* derived */
  const dVal = parseMoney(debit);
  const kVal = parseMoney(kredit);
  const selectedKategori = useMemo(
    () => kategoris.find((k) => String(k.id) === String(kategoriId)),
    [kategoris, kategoriId]
  );
  const hasMapping =
    !!selectedKategori?.debitAkun && !!selectedKategori?.kreditAkun;
  const balanced =
    (dVal > 0 && kVal > 0 && dVal === kVal) ||
    (dVal > 0 && kVal === 0) ||
    (kVal > 0 && dVal === 0); // kita auto-balance sebelum submit

  const toggleUnit = (id: number) =>
    setAlokasiUnitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const equalize = () => {
    if (dVal > 0 && kVal === 0) setKredit(String(dVal));
    else if (kVal > 0 && dVal === 0) setDebit(String(kVal));
  };

  const validate = (): string | null => {
    if (!tanggal) return "Tanggal wajib diisi.";
    if (!kategoriId) return "Kategori wajib dipilih.";
    if (alokasiUnitIds.length === 0) return "Pilih minimal satu Unit Biaya.";
    if (dVal <= 0 && kVal <= 0)
      return "Isi minimal salah satu nilai Debit atau Kredit.";
    if (!hasMapping)
      return "Kategori ini belum terhubung ke akun debit/kredit. Lengkapi di Kategori Biaya.";
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setOkMsg("");

    // auto-balance satu baris
    let debitFinal = dVal;
    let kreditFinal = kVal;
    if (dVal > 0 && kVal === 0) kreditFinal = dVal;
    if (kVal > 0 && dVal === 0) debitFinal = kVal;

    const v = validate();
    if (v) return setErr(v);

    const payload = {
      tanggal,
      ref: ref || null,
      uraian,
      kategoriId: Number(kategoriId),
      debit: round2(debitFinal),
      kredit: round2(kreditFinal),
      alokasi: alokasiUnitIds.map((id) => ({ unitBiayaId: id })),
    };

    try {
      setSubmitting(true);
      const r = await fetch("/api/akuntansi/jurnal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        let msg = "Gagal menyimpan jurnal.";
        try {
          const j = await r.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      setOkMsg("Entri jurnal berhasil disimpan.");
      setRef("");
      setUraian("");
      setDebit("0");
      setKredit("0");
      setAlokasiUnitIds([]);
      setTimeout(() => router.push("/akuntansi/jurnal"), 600);
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan jurnal.");
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

  /* ===== Preview GL (2 baris) ===== */
  const previewLines =
    hasMapping && (dVal > 0 || kVal > 0)
      ? [
          {
            akun:
              selectedKategori?.debitAkun?.kode +
                " — " +
                (selectedKategori?.debitAkun?.nama ?? "") || "—",
            debit: dVal > 0 ? (kVal === 0 ? dVal : dVal) : kVal, // ketika user isi salah satu, kita seimbangkan
            kredit: 0,
          },
          {
            akun:
              selectedKategori?.kreditAkun?.kode +
                " — " +
                (selectedKategori?.kreditAkun?.nama ?? "") || "—",
            debit: 0,
            kredit: kVal > 0 ? (dVal === 0 ? kVal : kVal) : dVal,
          },
        ]
      : [];

  const readyToPost =
    hasMapping &&
    ((dVal > 0 && (kVal === 0 || kVal === dVal)) ||
      (kVal > 0 && (dVal === 0 || dVal === kVal)));

  return (
    <main className="min-h-screen bg-gray-50 antialiased">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NotebookPen size={22} className="text-blue-600" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
              Tambah Jurnal
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reloadMeta}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm"
            >
              <RefreshCw size={16} /> Muat ulang data
            </button>
            <Link
              href="/akuntansi/jurnal"
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
              <div className="text-sm">{err}</div>
            </div>
          </div>
        )}
        {okMsg && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-semibold">Berhasil</div>
              <div className="text-sm">{okMsg}</div>
            </div>
          </div>
        )}

        {/* Info kategori & mapping akun */}
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-900">
          <div className="flex items-start gap-2">
            <Info size={18} className="mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold">
                Entri satu baris — sistem akan otomatis membuat dua baris GL
              </div>
              <div>
                Isi salah satu (Debit/Kredit), klik{" "}
                <b>Samakan</b> untuk menyeimbangkan nominal lawan. Mapping akun
                diambil dari <b>Kategori Biaya</b>.
              </div>
              {selectedKategori ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 border border-blue-200 px-2 py-0.5">
                    <span className="text-xs font-semibold">Tipe:</span>{" "}
                    <span className="text-xs">
                      {selectedKategori.tipe ?? "BIAYA"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 border border-blue-200 px-2 py-0.5">
                    <span className="text-xs font-semibold">Debit →</span>{" "}
                    <span className="text-xs">
                      {selectedKategori.debitAkun
                        ? `${selectedKategori.debitAkun.kode} — ${selectedKategori.debitAkun.nama}`
                        : "Belum diatur"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 border border-blue-200 px-2 py-0.5">
                    <span className="text-xs font-semibold">Kredit →</span>{" "}
                    <span className="text-xs">
                      {selectedKategori.kreditAkun
                        ? `${selectedKategori.kreditAkun.kode} — ${selectedKategori.kreditAkun.nama}`
                        : "Belum diatur"}
                    </span>
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-xs">
                  Pilih kategori untuk melihat mapping akunnya.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Empty-state hints */}
        {!loadingMeta && (kategoris.length === 0 || units.length === 0) && (
          <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-4">
            <div className="font-semibold mb-1">Referensi belum lengkap</div>
            <div className="text-sm">
              {kategoris.length === 0 && (
                <>
                  • Tambahkan <b>Kategori Biaya</b> dulu di menu{" "}
                  <b>Akuntansi → Kategori Biaya</b>.{" "}
                </>
              )}
              {units.length === 0 && (
                <>
                  • Tambahkan <b>Unit Biaya</b> di menu{" "}
                  <b>Akuntansi → Unit Biaya</b>.
                </>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Link
                href="/akuntansi/kategori-biaya"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm"
              >
                <PlusCircle size={16} /> Tambah Kategori
              </Link>
              <Link
                href="/akuntansi/unit-biaya"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm"
              >
                <PlusCircle size={16} /> Tambah Unit
              </Link>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Tanggal
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Ref (opsional)
              </label>
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="No. bukti / referensi"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Uraian / Deskripsi
              </label>
              <input
                value={uraian}
                onChange={(e) => setUraian(e.target.value)}
                placeholder="Ringkas tapi jelas…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Kategori
              </label>
              <select
                value={kategoriId}
                onChange={(e) => setKategoriId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-400"
                disabled={loadingMeta || kategoris.length === 0}
                required
              >
                <option value="" disabled>
                  {loadingMeta ? "Memuat…" : "Pilih kategori"}
                </option>
                {kategoris.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Unit Biaya (alokasi)
              </label>
              <div className="border border-gray-300 rounded-lg p-2 h-[134px] overflow-auto">
                {loadingMeta ? (
                  <div className="text-gray-500 text-sm px-2 py-1">
                    Memuat unit biaya…
                  </div>
                ) : units.length ? (
                  <ul className="space-y-1">
                    {units.map((u) => {
                      const checked = alokasiUnitIds.includes(u.id);
                      return (
                        <li key={u.id} className="flex items-center gap-2">
                          <input
                            id={`u-${u.id}`}
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUnit(u.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                          />
                          <label htmlFor={`u-${u.id}`} className="text-sm">
                            {u.nama}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="text-gray-500 text-sm px-2 py-1">
                    Belum ada unit biaya.
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimal pilih satu unit.</p>
            </div>

            {/* Input uang */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Debit
                </label>
                <button
                  type="button"
                  onClick={equalize}
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800"
                  title="Samakan nominal lawan"
                >
                  <Scale size={14} /> Samakan
                </button>
              </div>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.,-]*"
                placeholder="cth: 23.730.468,75"
                value={debit}
                onChange={(e) => setDebit(sanitizeMoneyInput(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400"
              />
              <div className="text-xs text-gray-500 mt-1">{toIDR(dVal)}</div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Kredit
                </label>
                <button
                  type="button"
                  onClick={equalize}
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800"
                  title="Samakan nominal lawan"
                >
                  <Scale size={14} /> Samakan
                </button>
              </div>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.,-]*"
                placeholder="cth: 23.730.468,75"
                value={kredit}
                onChange={(e) => setKredit(sanitizeMoneyInput(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400"
              />
              <div className="text-xs text-gray-500 mt-1">{toIDR(kVal)}</div>
            </div>

            {dVal > 0 && kVal > 0 && dVal !== kVal && (
              <div className="md:col-span-2 text-xs text-amber-600">
                Debit dan Kredit terisi namun belum sama. Klik{" "}
                <b>Samakan</b> agar seimbang.
              </div>
            )}
          </div>

          {/* Preview ringkas */}
          <div className="px-5 pb-5">
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-900 text-white text-sm flex items-center justify-between">
                <span className="font-semibold">Preview GL</span>
                <span
                  className={cls(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                    readyToPost
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  )}
                >
                  <Sparkles size={14} />
                  {readyToPost ? "Siap diposting" : "Lengkapi nominal / mapping"}
                </span>
              </div>

              <div className="p-4 overflow-x-auto bg-white">
                {previewLines.length ? (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-gray-900">
                        <th className="px-3 py-2 text-left">Akun</th>
                        <th className="px-3 py-2 text-left">Debit</th>
                        <th className="px-3 py-2 text-left">Kredit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewLines.map((ln, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{ln.akun}</td>
                          <td className="px-3 py-2">{toIDR(ln.debit)}</td>
                          <td className="px-3 py-2">{toIDR(ln.kredit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2">
                          {toIDR(
                            previewLines.reduce((s, x) => s + (x.debit || 0), 0)
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {toIDR(
                            previewLines.reduce((s, x) => s + (x.kredit || 0), 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="text-sm text-gray-600">
                    Isi nominal dan pilih kategori untuk melihat preview.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
            <Link
              href="/akuntansi/jurnal"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Batal & Kembali
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={16} /> {submitting ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
