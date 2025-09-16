"use client";

import React from "react";
import { useRouter } from "next/navigation";
import AkShell, { glass } from "@/components/AkShell";
import { Plus, Trash2, Check, RotateCcw } from "lucide-react";
import useToast from "@/components/Toast";

/* =========================================================
   Helpers
========================================================= */
type Pos = "DEBIT" | "KREDIT";
type TipeAkun = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";

const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const num = (v: string | number) => {
  const n = typeof v === "number" ? v : Number(String(v).replaceAll(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// kecil & reusable
function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState<T>(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* =========================================================
   AccountPicker (autocomplete akun)
========================================================= */
type AccountOption = {
  id: number;
  kode: string;
  nama: string;
  pos: Pos;
  tipe: TipeAkun;
  isPosting: boolean;
  isActive: boolean;
};

function AccountPicker({
  value,
  onPick,
  placeholder = "cth: 1101 / kas",
  width = 320,
}: {
  value: string;
  onPick: (opt: AccountOption) => void;
  placeholder?: string;
  width?: number;
}) {
  const [q, setQ] = React.useState<string>(value || "");
  const [open, setOpen] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [opts, setOpts] = React.useState<AccountOption[]>([]);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const dq = useDebounced(q, 250);

  React.useEffect(() => {
    let abort = false;
    const run = async () => {
      if (!dq || dq.trim().length < 1) {
        setOpts([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/akuntansi/coa?q=${encodeURIComponent(dq)}&size=20`);
        const j = await res.json();
        const rows: AccountOption[] = (j?.rows || j || []).filter(
          (r: AccountOption) => r.isPosting && r.isActive
        );
        if (!abort) setOpts(rows);
      } catch {
        if (!abort) setOpts([]);
      } finally {
        if (!abort) setLoading(false);
      }
    };
    run();
    return () => {
      abort = true;
    };
  }, [dq]);

  // close on outside click
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-white/12 bg-slate-900/40 px-2 text-sm outline-none"
      />
      {open && (
        <div
          className="absolute z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-white/10 bg-slate-900/95 p-1 shadow-xl"
          style={{ width }}
        >
          {loading ? (
            <div className="p-3 text-sm text-slate-300/70">Mencari…</div>
          ) : opts.length === 0 ? (
            <div className="p-3 text-xs text-slate-300/70">
              Tidak ada hasil.
              <span className="mt-1 block">
                Tips: ketik kode (<b>1101</b>) atau nama (<b>kas</b>, <b>piutang</b>). Hanya akun{" "}
                <b>Detail (Posting)</b> yang bisa dipilih.
              </span>
            </div>
          ) : (
            <ul className="text-sm">
              {opts.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(o);
                      setQ(o.kode);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-white/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-[12px] font-semibold">{o.kode}</span>
                      <span className="truncate text-slate-200">{o.nama}</span>
                    </div>
                    <div className="shrink-0 text-[11px] text-slate-300/80">
                      <span className="mr-2">{o.tipe}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5">{o.pos}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Page: Tambah Jurnal Manual
========================================================= */
type Line = {
  akunKode: string;
  uraian: string;
  debit: string | number;
  kredit: string | number;
};

export default function PageTambahJurnal() {
  const router = useRouter();
  const { push, View } = useToast();

  const [tanggal, setTanggal] = React.useState<string>(todayISO());
  const [memo, setMemo] = React.useState<string>("");
  const [saving, setSaving] = React.useState<boolean>(false);

  const [lines, setLines] = React.useState<Line[]>([
    { akunKode: "", uraian: "", debit: "", kredit: "" },
    { akunKode: "", uraian: "", debit: "", kredit: "" },
  ]);

  const setRow = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRow = () =>
    setLines((prev) => [...prev, { akunKode: "", uraian: "", debit: "", kredit: "" }]);
  const delRow = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));
  const resetForm = () => {
    setTanggal(todayISO());
    setMemo("");
    setLines([
      { akunKode: "", uraian: "", debit: "", kredit: "" },
      { akunKode: "", uraian: "", debit: "", kredit: "" },
    ]);
  };

  const totalDebit = lines.reduce((s, r) => s + num(r.debit), 0);
  const totalKredit = lines.reduce((s, r) => s + num(r.kredit), 0);
  const balanced = Math.round((totalDebit - totalKredit) * 100) === 0;

  const submit = async () => {
    // validasi sederhana
    if (lines.length < 2) {
      push("❌ Minimal 2 baris.", "err");
      return;
    }
    if (totalDebit <= 0 || totalKredit <= 0 || !balanced) {
      push("❌ Debit & Kredit harus > 0 dan seimbang.", "err");
      return;
    }
    if (lines.some((l) => !l.akunKode.trim())) {
      push("❌ Kode akun wajib di semua baris.", "err");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tanggal,
        memo: memo.trim() || undefined,
        sumber: "MANUAL" as const,
        lines: lines.map((l) => ({
          akunKode: l.akunKode.trim(),
          uraian: l.uraian.trim() || undefined,
          debit: num(l.debit),
          kredit: num(l.kredit),
        })),
      };

      const r = await fetch("/api/akuntansi/jurnal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal menyimpan jurnal");

      push(`✅ Jurnal ${j.nomor} dibuat`, "ok");
      router.push("/akuntansi/jurnal");
    } catch (e: unknown) {
      push(`❌ ${(e as Error).message}`, "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AkShell title="Tambah Jurnal" subtitle="Input jurnal manual" full>
      {/* Renderer untuk toast */}
      <View />

      <section className={`${glass} p-4`}>
        {/* Header form: tanggal + memo + aksi */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/10 px-2 py-1 text-xs">
            Manual
          </span>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-300/80">Tanggal</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-9 rounded-md border border-white/12 bg-slate-900/40 px-2 text-sm outline-none"
              />
            </div>

            <div className="flex grow items-center gap-2 md:min-w-[360px]">
              <label className="text-xs text-slate-300/80">Memo</label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Catatan…"
                className="h-9 w-full rounded-md border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
              title="Reset"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
              title="Simpan"
            >
              <Check className="h-4 w-4" />
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>

        {/* Tabel lines */}
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-slate-200">
              <tr>
                <th className="px-3 py-2 text-left w-[22rem]">Kode Akun</th>
                <th className="px-3 py-2 text-left">Uraian</th>
                <th className="px-3 py-2 text-right w-40">Debit</th>
                <th className="px-3 py-2 text-right w-40">Kredit</th>
                <th className="px-3 py-2 text-right w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {lines.map((r, i) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="px-3 py-2 align-top">
                    <AccountPicker
                      value={r.akunKode}
                      onPick={(opt) =>
                        setRow(i, {
                          akunKode: opt.kode,
                          uraian: r.uraian || opt.nama,
                        })
                      }
                      width={440}
                    />
                    <div className="mt-1 text-[11px] text-slate-400">
                      Ketik kode/nama lalu pilih. Hanya akun detail (posting) yang muncul.
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      value={r.uraian}
                      onChange={(e) => setRow(i, { uraian: e.target.value })}
                      placeholder="Uraian baris…"
                      className="h-9 w-full rounded-md border border-white/12 bg-slate-900/40 px-3 text-sm outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      inputMode="decimal"
                      value={r.debit}
                      onChange={(e) => setRow(i, { debit: e.target.value, kredit: "" })}
                      placeholder="0"
                      className="h-9 w-full rounded-md border border-white/12 bg-slate-900/40 px-3 text-right text-sm outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      inputMode="decimal"
                      value={r.kredit}
                      onChange={(e) => setRow(i, { kredit: e.target.value, debit: "" })}
                      placeholder="0"
                      className="h-9 w-full rounded-md border border-white/12 bg-slate-900/40 px-3 text-right text-sm outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      onClick={() => delRow(i)}
                      className="rounded-md border border-white/10 bg-white/5 p-2 hover:bg-white/10"
                      title="Hapus baris"
                    >
                      <Trash2 className="h-4 w-4 text-rose-300" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-white/10">
                <td className="px-3 py-2" colSpan={5}>
                  <button
                    onClick={addRow}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Baris
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-white/[0.03]">
              <tr>
                <td className="px-3 py-2 font-medium text-slate-300">Total</td>
                <td />
                <td className="px-3 py-2 text-right font-semibold">
                  {totalDebit.toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {totalKredit.toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={`rounded-md px-2 py-1 text-xs ${
                      balanced
                        ? "bg-emerald-400/15 text-emerald-200"
                        : "bg-rose-400/15 text-rose-200"
                    }`}
                  >
                    {balanced ? "Seimbang" : "Tidak seimbang"}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </AkShell>
  );
}
