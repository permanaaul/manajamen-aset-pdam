"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AkShell, { glass } from "@/components/AkShell";
import {
  Save,
  ArrowLeft,
  Landmark,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Loader2,
  Check,
} from "lucide-react";

type Tipe = "CASH" | "BANK";

/* ====== Types untuk hasil /api/akuntansi/coa ====== */
type CoaRow = {
  id: number;
  kode: string;
  nama: string;
  pos: "DEBIT" | "KREDIT";
  tipe: "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";
  isPosting: boolean;
  isActive: boolean;
};

export default function PageTambahAkunKasBank() {
  const r = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const [kode, setKode] = React.useState("");
  const [nama, setNama] = React.useState("");
  const [tipe, setTipe] = React.useState<Tipe>("CASH");

  // 🔽 state untuk Akun GL (kita simpan kode + id opsional jika dipilih dari dropdown)
  const [akunKode, setAkunKode] = React.useState("");
  const [akunId, setAkunId] = React.useState<number | null>(null);

  const [bankNama, setBankNama] = React.useState("");
  const [bankNo, setBankNo] = React.useState("");
  const [bankCabang, setBankCabang] = React.useState("");
  const [saldoAwal, setSaldoAwal] = React.useState("");
  const [aktif, setAktif] = React.useState(true);

  const idrParse = (s: string) => Number(String(s).replaceAll(".", "").replace(",", ".")) || 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);

    if (!kode.trim() || !nama.trim() || !akunKode.trim()) {
      setToast({ kind: "err", msg: "Kode, Nama, dan Akun GL wajib diisi." });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/kasbank/akun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode: kode.trim(),
          nama: nama.trim(),
          tipe,
          // kirim dua-duanya; API akan pakai akunId kalau ada, fallback ke akunKode
          akunId,
          akunKode: akunKode.trim(),
          bankNama: bankNama.trim() || null,
          bankNo: bankNo.trim() || null,
          bankCabang: bankCabang.trim() || null,
          saldoAwal: idrParse(saldoAwal),
          aktif,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Gagal menyimpan");
      setToast({ kind: "ok", msg: "Akun kas/bank berhasil dibuat." });
      setTimeout(() => r.push("/kas-bank?tab=akun"), 600);
    } catch (err) {
      setToast({ kind: "err", msg: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AkShell title="Kas & Bank" subtitle="Tambah akun kas/bank baru">
      <section className={`${glass} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Tambah Akun</h2>
          <Link
            href="/kas-bank?tab=akun"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
        </div>

        {toast && (
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              toast.kind === "ok"
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                : "border-rose-400/30 bg-rose-500/15 text-rose-100"
            }`}
          >
            {toast.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {toast.msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Kiri */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-300">Kode*</label>
              <input
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm outline-none"
                placeholder="KAS-01 / BRI-01"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">Nama*</label>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm outline-none"
                placeholder="Kas Kecil / Bank BRI Operasional"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">Jenis*</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipe("CASH")}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    tipe === "CASH"
                      ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <Landmark className="h-4 w-4" /> CASH
                </button>
                <button
                  type="button"
                  onClick={() => setTipe("BANK")}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    tipe === "BANK"
                      ? "border-sky-300/30 bg-sky-500/20 text-sky-100"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <Building2 className="h-4 w-4" /> BANK
                </button>
              </div>
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-slate-200">Aktif</span>
            </label>
          </div>

          {/* Kanan */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                Akun GL (Kode CoA)*{" "}
                <Link href="/akuntansi/coa" className="text-sky-300 underline">
                  lihat CoA
                </Link>
              </label>

              {/* 🔽 Akun GL Picker */}
              <AkunGlPicker
                valueKode={akunKode}
                onChangeKode={(kodeBaru) => {
                  setAkunKode(kodeBaru);
                  // kalau user mengetik manual, kosongkan id
                  setAkunId(null);
                }}
                onPick={(row) => {
                  setAkunKode(row.kode);
                  setAkunId(row.id);
                }}
              />
            </div>

            {/* detail bank opsional */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-300">Nama Bank</label>
                <input
                  value={bankNama}
                  onChange={(e) => setBankNama(e.target.value)}
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm outline-none"
                  placeholder="BRI / BNI / Mandiri"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">No. Rekening</label>
                <input
                  value={bankNo}
                  onChange={(e) => setBankNo(e.target.value)}
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm outline-none"
                  placeholder="1234 5678 90"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-300">Cabang</label>
                <input
                  value={bankCabang}
                  onChange={(e) => setBankCabang(e.target.value)}
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">Saldo Awal (Rp)</label>
              <input
                inputMode="numeric"
                value={saldoAwal}
                onChange={(e) => setSaldoAwal(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-2 pt-2">
            <button
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Menyimpan…" : "Simpan"}
            </button>
            <Link
              href="/kas-bank?tab=akun"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Batal
            </Link>
          </div>
        </form>
      </section>
    </AkShell>
  );
}

/* ============================================================
   Akun GL Picker (async dropdown)
   - Sumber data: /api/akuntansi/coa?q=...&page=1&size=20
   - Filter client: tipe === "ASET" && isPosting && isActive
   ============================================================ */
function AkunGlPicker({
  valueKode,
  onChangeKode,
  onPick,
}: {
  valueKode: string;
  onChangeKode: (v: string) => void;
  onPick: (row: CoaRow) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<CoaRow[]>([]);
  const [q, setQ] = React.useState(valueKode);
  const boxRef = React.useRef<HTMLDivElement>(null);

  // sync input luar
  React.useEffect(() => setQ(valueKode), [valueKode]);

  // click-outside untuk menutup dropdown
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // fetch dengan debounce
  React.useEffect(() => {
    const t = setTimeout(async () => {
      if (!open) return;
      setLoading(true);
      try {
        const url = `/api/akuntansi/coa?q=${encodeURIComponent(q)}&page=1&size=20`;
        const res = await fetch(url);
        const j = await res.json();
        const rows: CoaRow[] = (j?.rows || []) as CoaRow[];
        // filter: hanya ASET + posting + aktif
        const filtered = rows.filter(r => r.isPosting && r.isActive);
        setItems(filtered);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onChangeKode(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="h-10 w-full rounded-l-lg border border-white/10 bg-white/10 px-3 text-sm outline-none"
          placeholder="1101 (Kas) / 1102 (Bank)"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-10 rounded-r-lg border border-l-0 border-white/10 bg-white/10 px-2"
          title="Tampilkan daftar"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-white/10 bg-slate-900/90 p-1 shadow-lg backdrop-blur">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat…
            </div>
          ) : items.length === 0 ? (
            <div className="px-2 py-2 text-sm text-slate-400">Tidak ada hasil.</div>
          ) : (
            items.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onPick(r);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-white/10"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-xs text-slate-200">{r.kode}</span>
                  <span className="truncate text-slate-100">{r.nama}</span>
                </span>
                <span className="ml-2 rounded border border-white/10 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                  {r.tipe}
                </span>
              </button>
            ))
          )}
          {/* hint pilih manual */}
          <div className="mt-1 border-t border-white/10 px-2 py-1 text-[11px] text-slate-400">
            Bisa juga ketik manual kode CoA lalu Enter.
          </div>
        </div>
      )}
    </div>
  );
}
