// app/kas-bank/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  Banknote,
  Building2,
  CreditCard,
  Download,
  FolderOpen,
  ListFilter,
  Loader2,
  MoveRight,
  Plus,
  RefreshCcw,
  Search,
  Wallet,
  X,
  ChevronDown,
} from "lucide-react";
import AkShell, { glass } from "@/components/AkShell";

/* =========================
 * Types (sinkron dgn API)
 * ========================= */
type JenisKasBank = "KAS" | "BANK";
type StatusDok = "DRAFT" | "POSTED" | "CANCELED";
type KBType = "IN" | "OUT" | "TRF";

type GLBrief = { id: number; kode: string; nama: string };
type KBAkun = {
  id: number;
  kode: string;
  nama: string;
  jenis: JenisKasBank;
  bank: string | null;
  noRek: string | null;
  pemilik: string | null;
  aktif: boolean;
  akunGLId: number | null;
  akunGL: GLBrief | null;
  saldoAwal: number;
};

type KBRow = {
  id: number;
  nomor: string;
  tanggal: string;
  tipe: KBType;
  status: StatusDok;
  akunId: number | null;
  asalId: number | null;
  tujuanId: number | null;
  lawanAkunId: number | null;
  amount: number;
  biaya: number | null;
  memo: string | null;
  referensi: string | null;
  jurnalId: number | null;
  akun: GLBrief | null; // IN/OUT → nama rekening kas/bank
  asal: GLBrief | null; // TRF
  tujuan: GLBrief | null; // TRF
  lawanAkun: GLBrief | null; // akun GL lawan (IN/OUT)
};

const idr = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("id-ID");

/* =======================
 * Reusable Dark Select
 * ======================= */
type Option = { value: string | number; label: string; disabled?: boolean };

function DarkSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih…",
  className = "",
  buttonClassName = "",
  disabled = false,
  widthClass = "w-56",
}: {
  value: string | number | "";
  onChange: (v: string | number | "") => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  widthClass?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [focusIdx, setFocusIdx] = React.useState<number>(-1);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);

  const label =
    options.find((o) => String(o.value) === String(value))?.label || "";

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !popRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      options.findIndex((o) => String(o.value) === String(value))
    );
    setFocusIdx(idx === -1 ? 0 : idx);
  }, [open, options, value]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[focusIdx];
      if (opt && !opt.disabled) {
        onChange(opt.value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={`relative ${widthClass} ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        onKeyDown={onKeyDown}
        className={`h-10 w-full rounded-lg border border-white/10 bg-white/10 px-2 text-left text-sm outline-none hover:bg-white/15 disabled:opacity-50 inline-flex items-center justify-between ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={label ? "text-slate-100" : "text-slate-300/60"}>
          {label || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open && (
        <div
          ref={popRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/10 bg-slate-900/95 p-1 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-slate-900/80"
        >
          {options.length === 0 ? (
            <div className="px-2 py-2 text-sm text-slate-400">Tidak ada opsi.</div>
          ) : (
            options.map((o, i) => {
              const active = i === focusIdx;
              const selected = String(o.value) === String(value);
              return (
                <div
                  key={`${o.value}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setFocusIdx(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`cursor-pointer rounded-md px-2 py-2 text-sm ${
                    o.disabled
                      ? "text-slate-500/60"
                      : active
                      ? "bg-white/10 text-slate-100"
                      : "text-slate-200 hover:bg-white/5"
                  } ${selected ? "ring-1 ring-emerald-300/30" : ""}`}
                >
                  {o.label}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* =======================
 * CoA Picker (search)
 * ======================= */
type CoaRow = { id: number; kode: string; nama: string; isPosting?: boolean };

function CoaPicker({
  value,
  onSelect,
  placeholder = "Cari kode/nama CoA…",
}: {
  value: CoaRow | null;
  onSelect: (row: CoaRow) => void;
  placeholder?: string;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<CoaRow[]>([]);
  const cRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function close(e: MouseEvent) {
      if (!cRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      if (!open || q.trim() === "") return setRows([]);
      const p = new URLSearchParams({ q, size: "30" });
      const r = await fetch("/api/akuntansi/coa?" + p.toString());
      const j = await r.json();
      if (r.ok) {
        const arr: CoaRow[] = (j.rows || []).map((a: any) => ({
          id: a.id,
          kode: a.kode,
          nama: a.nama,
          isPosting: a.isPosting,
        }));
        setRows(arr);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div ref={cRef} className="relative w-full">
      <div className="flex gap-2">
        <input
          value={value ? `${value.kode} — ${value.nama}` : q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm outline-none placeholder:text-slate-300/60"
        />
        <Link
          href="/akuntansi/coa"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 text-sm hover:bg-white/15"
          title="Lihat CoA"
        >
          <Building2 className="h-4 w-4" />
        </Link>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-white/10 bg-slate-900/95 p-1 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-slate-900/80">
          {rows.length === 0 ? (
            <div className="px-2 py-2 text-sm text-slate-400">Tidak ada hasil.</div>
          ) : (
            rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onSelect(r);
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
              >
                <span className="font-mono text-xs text-slate-300">{r.kode}</span>
                <span className="flex-1 truncate">{r.nama}</span>
                {!r.isPosting && (
                  <span className="rounded bg-amber-500/20 px-1.5 text-[10px] text-amber-200">
                    Group
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ===================================
 * Main: Kas & Bank Hub (Akun + Transaksi)
 * =================================== */
export default function KasBankPage() {
  const [tab, setTab] = React.useState<"trx" | "akun">("trx");

  // baca query ?tab=akun agar bisa deep-link dari halaman lain
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      const t = u.searchParams.get("tab");
      if (t === "akun") setTab("akun");
    }
  }, []);

  return (
    <AkShell title="Kas & Bank" subtitle="Kelola rekening kas/bank dan transaksi" full>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setTab("trx")}
          className={`rounded-lg px-3 py-1.5 text-sm border ${
            tab === "trx"
              ? "bg-white/15 border-white/20"
              : "bg-white/5 border-white/10 hover:bg-white/10"
          }`}
        >
          Transaksi
        </button>
        <button
          onClick={() => setTab("akun")}
          className={`rounded-lg px-3 py-1.5 text-sm border ${
            tab === "akun"
              ? "bg-white/15 border-white/20"
              : "bg-white/5 border-white/10 hover:bg-white/10"
          }`}
        >
          Akun
        </button>
      </div>

      {tab === "trx" ? <TransaksiSection /> : <AkunSection />}
    </AkShell>
  );
}

/* =========================
 * Section: Transaksi
 * ========================= */
function TransaksiSection() {
  const [rows, setRows] = React.useState<KBRow[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // filter
  const [q, setQ] = React.useState("");
  const [tipe, setTipe] = React.useState<"" | KBType>("");
  const [akunId, setAkunId] = React.useState<number | "">("");
  const [asalId, setAsalId] = React.useState<number | "">("");
  const [tujuanId, setTujuanId] = React.useState<number | "">("");
  const [dari, setDari] = React.useState<string>("");
  const [sampai, setSampai] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const size = 20;

  const [akunList, setAkunList] = React.useState<KBAkun[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);

  const loadAkun = React.useCallback(async () => {
    const r = await fetch(`/api/kasbank/akun?aktif=true&size=200`);
    const j = await r.json();
    if (r.ok) setAkunList(j.rows || []);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tipe) p.set("tipe", tipe);
    if (akunId) p.set("akunId", String(akunId));
    if (asalId) p.set("asalId", String(asalId));
    if (tujuanId) p.set("tujuanId", String(tujuanId));
    if (dari) p.set("dari", dari);
    if (sampai) p.set("sampai", sampai);
    p.set("page", String(page));
    p.set("size", String(size));

    const r = await fetch(`/api/kasbank/transaksi?` + p.toString());
    const j = await r.json();
    if (!r.ok) {
      console.error(j?.error);
      setRows([]);
      setCount(0);
    } else {
      setRows(j.rows || []);
      setCount(j.count || 0);
    }
    setLoading(false);
  }, [q, tipe, akunId, asalId, tujuanId, dari, sampai, page]);

  React.useEffect(() => {
    loadAkun();
  }, [loadAkun]);

  React.useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / size));

  // options
  const tipeOptions: Option[] = [
    { value: "", label: "Semua Tipe" },
    { value: "IN", label: "IN (Penerimaan)" },
    { value: "OUT", label: "OUT (Pengeluaran)" },
    { value: "TRF", label: "TRF (Transfer)" },
  ];
  const akunOptions: Option[] = [
    { value: "", label: "Akun (IN/OUT)" },
    ...akunList.map((a) => ({ value: a.id, label: `${a.kode} — ${a.nama}` })),
  ];
  const asalOptions: Option[] = [
    { value: "", label: "Asal (TRF)" },
    ...akunList.map((a) => ({ value: a.id, label: `${a.kode} — ${a.nama}` })),
  ];
  const tujuanOptions: Option[] = [
    { value: "", label: "Tujuan (TRF)" },
    ...akunList.map((a) => ({ value: a.id, label: `${a.kode} — ${a.nama}` })),
  ];

  return (
    <section className={`${glass} p-4`}>
      {/* Toolbar & filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300/70" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nomor/memo/referensi…"
            className="h-10 w-72 rounded-lg border border-white/10 bg-white/10 pl-9 pr-3 text-sm placeholder:text-slate-300/60 outline-none"
          />
        </div>

        <DarkSelect
          value={tipe}
          onChange={(v) => setTipe((v as "" | KBType) || "")}
          options={tipeOptions}
          widthClass="w-40"
        />

        <DarkSelect
          value={akunId}
          onChange={(v) => setAkunId(v === "" ? "" : Number(v))}
          options={akunOptions}
          widthClass="w-64"
        />

        <DarkSelect
          value={asalId}
          onChange={(v) => setAsalId(v === "" ? "" : Number(v))}
          options={asalOptions}
          widthClass="w-64"
        />

        <MoveRight className="opacity-60" />

        <DarkSelect
          value={tujuanId}
          onChange={(v) => setTujuanId(v === "" ? "" : Number(v))}
          options={tujuanOptions}
          widthClass="w-64"
        />

        {/* tanggal */}
        <input
          type="date"
          value={dari}
          onChange={(e) => setDari(e.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-white/10 px-2 text-sm outline-none"
        />
        <input
          type="date"
          value={sampai}
          onChange={(e) => setSampai(e.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-white/10 px-2 text-sm outline-none"
        />

        <button
          onClick={() => {
            setPage(1);
            load();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          title="Terapkan"
        >
          <ListFilter className="h-4 w-4" />
          Terapkan
        </button>

        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          title="Muat ulang"
        >
          <RefreshCcw className="h-4 w-4" />
          Muat Ulang
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30"
          >
            <Plus className="h-4 w-4" />
            Transaksi Baru
          </button>
          <button
            onClick={() => alert("Export CSV belum diimplementasi.")}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabel */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        {loading ? (
          <div className="grid h-28 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-300/80">Tidak ada data.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-slate-200">
              <tr>
                <th className="px-3 py-2 text-left">Tanggal</th>
                <th className="px-3 py-2 text-left">Nomor</th>
                <th className="px-3 py-2 text-left">Tipe</th>
                <th className="px-3 py-2 text-left">Akun / Asal → Tujuan</th>
                <th className="px-3 py-2 text-left">Lawan Akun</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {rows.map((r) => {
                const tgl = new Date(r.tanggal).toLocaleDateString("id-ID", {
                  dateStyle: "medium",
                });
                return (
                  <tr
                    key={r.id}
                    className="border-t border-white/10 hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2">{tgl}</td>
                    <td className="px-3 py-2 font-medium">{r.nomor}</td>
                    <td className="px-3 py-2">
                      {r.tipe === "IN" && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                          <Wallet className="h-3.5 w-3.5" /> IN
                        </span>
                      )}
                      {r.tipe === "OUT" && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-rose-200">
                          <CreditCard className="h-3.5 w-3.5" /> OUT
                        </span>
                      )}
                      {r.tipe === "TRF" && (
                        <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2 py-0.5 text-sky-200">
                          <Banknote className="h-3.5 w-3.5" /> TRF
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.tipe === "TRF" ? (
                        <div className="text-slate-200">
                          <span className="font-mono">{r.asal?.kode}</span> →{" "}
                          <span className="font-mono">{r.tujuan?.kode}</span>
                        </div>
                      ) : (
                        <div className="text-slate-200">
                          <span className="font-mono">{r.akun?.kode}</span>{" "}
                          <span className="text-slate-400">— {r.akun?.nama}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.tipe === "TRF" ? (
                        // === FIX: untuk TRF tampilkan akun TUJUAN sebagai 'lawan' ===
                        <div className="text-slate-200">
                          <span className="font-mono">{r.tujuan?.kode || "-"}</span>{" "}
                          <span className="text-slate-400">— {r.tujuan?.nama || ""}</span>
                        </div>
                      ) : (
                        // IN / OUT tetap seperti sebelumnya
                        <div className="text-slate-200">
                          <span className="font-mono">{r.lawanAkun?.kode || "-"}</span>{" "}
                          <span className="text-slate-400">{r.lawanAkun?.nama || ""}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">Rp {idr(r.amount)}</td>
                    <td className="px-3 py-2">
                      {r.status === "DRAFT" && (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-200">
                          DRAFT
                        </span>
                      )}
                      {r.status === "POSTED" && (
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                          POSTED
                        </span>
                      )}
                      {r.status === "CANCELED" && (
                        <span className="rounded bg-rose-500/15 px-2 py-0.5 text-rose-200">
                          CANCELED
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/kas-bank/${r.id}`}
                        className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
                        title="Detail"
                      >
                        <FolderOpen className="h-4 w-4" />
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* pagination */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-slate-300/80">
          Menampilkan {rows.length} dari {count}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-white/10 bg-white/10 px-2 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-white/10 bg-white/10 px-2 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* create modal */}
      {showCreate && (
        <CreateTransactionModal
          akunList={akunList}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </section>
  );
}

/* =========================
 * Section: Akun
 * ========================= */
function AkunSection() {
  const [rows, setRows] = React.useState<KBAkun[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const [q, setQ] = React.useState("");
  const [aktif, setAktif] = React.useState<"" | "true" | "false">("");

  const load = React.useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (aktif) p.set("aktif", aktif);
    p.set("size", "200");

    const r = await fetch(`/api/kasbank/akun?` + p.toString());
    const j = await r.json();
    if (!r.ok) {
      console.error(j?.error);
      setRows([]);
      setCount(0);
    } else {
      setRows(j.rows || []);
      setCount(j.count || 0);
    }
    setLoading(false);
  }, [q, aktif]);

  React.useEffect(() => {
    load();
  }, [load]);

  const aktifOptions: Option[] = [
    { value: "", label: "Semua" },
    { value: "true", label: "Aktif" },
    { value: "false", label: "Nonaktif" },
  ];

  return (
    <section className={`${glass} p-4`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300/70" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kode/nama/bank…"
            className="h-10 w-72 rounded-lg border border-white/10 bg-white/10 pl-9 pr-3 text-sm placeholder:text-slate-300/60 outline-none"
          />
        </div>

        <DarkSelect
          value={aktif}
          onChange={(v) => setAktif(String(v) as "" | "true" | "false")}
          options={aktifOptions}
          widthClass="w-36"
        />

        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
        >
          <RefreshCcw className="h-4 w-4" />
          Muat Ulang
        </button>

        <Link
          href="/kas-bank/akun/tambah"
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30"
          title="Tambah Akun Kas/Bank"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Tambah Akun
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/akuntansi/coa"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            <Building2 className="h-4 w-4" />
            Lihat CoA
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        {loading ? (
          <div className="grid h-28 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-300/80">Tidak ada data.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-slate-200">
              <tr>
                <th className="px-3 py-2 text-left">Kode</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Jenis</th>
                <th className="px-3 py-2 text-left">Bank / No.Rek</th>
                <th className="px-3 py-2 text-left">Akun GL</th>
                <th className="px-3 py-2 text-right">Saldo Awal</th>
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-white/10 hover:bg-white/[0.03]"
                >
                  <td className="px-3 py-2 font-medium">{r.kode}</td>
                  <td className="px-3 py-2">{r.nama}</td>
                  <td className="px-3 py-2">{r.jenis}</td>
                  <td className="px-3 py-2">
                    {r.bank ? (
                      <>
                        <div>{r.bank}</div>
                        <div className="text-slate-400">{r.noRek || "-"}</div>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.akunGL ? (
                      <>
                        <div className="font-mono text-xs">{r.akunGL.kode}</div>
                        <div className="text-slate-300">{r.akunGL.nama}</div>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">Rp {idr(r.saldoAwal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 text-sm text-slate-300/80">Total akun: {count}</div>
    </section>
  );
}

/* =========================
 * Modal: Create Transaction
 * ========================= */
function CreateTransactionModal({
  akunList,
  onClose,
  onCreated,
}: {
  akunList: KBAkun[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tipe, setTipe] = React.useState<KBType>("IN");
  const [tanggal, setTanggal] = React.useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [akunId, setAkunId] = React.useState<number | "">("");
  const [asalId, setAsalId] = React.useState<number | "">("");
  const [tujuanId, setTujuanId] = React.useState<number | "">("");
  const [coa, setCoa] = React.useState<CoaRow | null>(null);
  const [amount, setAmount] = React.useState<string>("");
  const [biaya, setBiaya] = React.useState<string>("");
  const [memo, setMemo] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");

  const tipeOptions: Option[] = [
    { value: "IN", label: "IN (Penerimaan)" },
    { value: "OUT", label: "OUT (Pengeluaran)" },
    { value: "TRF", label: "TRF (Transfer)" },
  ];
  const akunOptions: Option[] = [
    { value: "", label: "Pilih Akun…" },
    ...akunList.map((a) => ({ value: a.id, label: `${a.kode} — ${a.nama}` })),
  ];

  async function submit() {
    try {
      setSaving(true);
      setErr("");

      const body: any = {
        tipe,
        tanggal,
        amount: Number(amount || 0),
        biaya: biaya ? Number(biaya) : null,
        memo: memo || null,
        referensi: ref || null,
      };

      if (tipe === "IN" || tipe === "OUT") {
        if (!akunId) throw new Error("Pilih Akun (IN/OUT).");
        if (!coa?.id) throw new Error("Pilih Lawan Akun (CoA).");
        body.akunId = Number(akunId);
        body.lawanAkunId = Number(coa.id);
      } else {
        if (!asalId || !tujuanId || asalId === tujuanId)
          throw new Error("Pilih Asal dan Tujuan (berbeda).");
        body.asalId = Number(asalId);
        body.tujuanId = Number(tujuanId);
      }

      const r = await fetch("/api/kasbank/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal membuat transaksi.");
      onCreated();
    } catch (e: any) {
      setErr(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* card */}
      <div className="relative w-full max-w-2xl rounded-xl border border-white/10 bg-slate-900 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Transaksi Baru</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Tipe</label>
            <DarkSelect
              value={tipe}
              onChange={(v) => setTipe(v as KBType)}
              options={tipeOptions}
              widthClass="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/10 px-2 text-sm outline-none"
            />
          </div>

          {/* IN/OUT */}
          {tipe !== "TRF" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Akun Kas/Bank</label>
                <DarkSelect
                  value={akunId}
                  onChange={(v) => setAkunId(v === "" ? "" : Number(v))}
                  options={akunOptions}
                  widthClass="w-full"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Lawan Akun (CoA)</label>
                <CoaPicker value={coa} onSelect={setCoa} />
                {coa && (
                  <div className="mt-1 text-xs text-slate-400">
                    Dipilih: <span className="font-mono">{coa.kode}</span> — {coa.nama}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TRF */}
          {tipe === "TRF" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Asal</label>
                <DarkSelect
                  value={asalId}
                  onChange={(v) => setAsalId(v === "" ? "" : Number(v))}
                  options={akunOptions}
                  widthClass="w-full"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Tujuan</label>
                <DarkSelect
                  value={tujuanId}
                  onChange={(v) => setTujuanId(v === "" ? "" : Number(v))}
                  options={akunOptions}
                  widthClass="w-full"
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Amount (Rp)</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/10 px-2 text-sm outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Biaya (opsional)</label>
            <input
              inputMode="decimal"
              value={biaya}
              onChange={(e) => setBiaya(e.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/10 px-2 text-sm outline-none"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs text-slate-400">Memo</label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/10 px-2 text-sm outline-none"
              placeholder="Keterangan singkat…"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs text-slate-400">Referensi (opsional)</label>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/10 px-2 text-sm outline-none"
              placeholder="No dokumen, dsb."
            />
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/10 p-2 text-sm text-rose-100">
            {err}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
