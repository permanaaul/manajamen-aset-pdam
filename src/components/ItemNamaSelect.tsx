// components/ItemNamaSelect.tsx
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check } from "lucide-react";

type ItemLite = { id: number; kode: string; nama: string };

export default function ItemNamaSelect({
  placeholder = "Ketik untuk pilih item…",
  valueId,
  onSelect,
  disabled,
}: {
  placeholder?: string;
  valueId?: number;
  onSelect: (it: ItemLite) => void;
  disabled?: boolean;
}) {
  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef  = React.useRef<HTMLDivElement | null>(null);
  const headerRef = React.useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const [label, setLabel] = React.useState("");
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<ItemLite[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hi, setHi] = React.useState(0);

  // posisi panel (untuk <body> portal)
  const [pos, setPos] = React.useState({
    left: 0,
    top: 0,
    width: 0,
    maxH: 360,
    openUp: false,
  });
  const [headH, setHeadH] = React.useState(44);

  React.useEffect(() => setMounted(true), []);

  // preload label jika ada valueId (mode edit)
  React.useEffect(() => {
    let ignore = false;
    (async () => {
      if (!valueId) return;
      const r = await fetch(`/api/gudang/items/lookup?q=${valueId}&take=1`);
      const j = await r.json();
      const it: ItemLite | undefined = (j.data as ItemLite[]).find((x) => x.id === valueId);
      if (!ignore && it) setLabel(`${it.kode} — ${it.nama}`);
    })();
    return () => { ignore = true; };
  }, [valueId]);

  // hitung posisi: gunakan getBoundingClientRect() saja (karena panel fixed)
  const computePos = React.useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;

    const margin = 8;
    const maxH = openUp
      ? Math.max(220, Math.min(spaceAbove - margin, 520))
      : Math.max(220, Math.min(spaceBelow - margin, 520));

    setPos({
      left: Math.round(r.left),
      top: Math.round(openUp ? r.top - 8 : r.bottom + 8),
      width: Math.round(r.width),
      maxH,
      openUp,
    });
  }, []);

  // saat panel buka: ukur header + pasang listener
  React.useEffect(() => {
    if (!open) return;
    computePos();
    setTimeout(() => {
      const hh = headerRef.current?.getBoundingClientRect().height ?? 44;
      setHeadH(hh);
    }, 0);

    const onScroll = () => computePos();
    const onResize = () => computePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize, { passive: true } as any);

    // klik di luar: abaikan klik di anchor maupun di panel
    const onDoc = (e: MouseEvent) => {
      const a = anchorRef.current;
      const p = panelRef.current;
      const t = e.target as Node;
      if (a?.contains(t) || p?.contains(t)) return;
      setOpen(false);
      setQ("");
    };
    document.addEventListener("mousedown", onDoc);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize as any);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, computePos]);

  // fetch saat q berubah (debounce)
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await fetch(`/api/gudang/items/lookup?q=${encodeURIComponent(q)}&take=200`);
      const j = await r.json();
      setItems(j.data ?? []);
      setLoading(false);
      setHi(0);
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  const pick = (it: ItemLite) => {
    onSelect(it);
    setLabel(`${it.kode} — ${it.nama}`);
    setOpen(false);
    setQ("");
  };

  const listMaxH = Math.max(160, pos.maxH - headH);

  return (
    <div ref={anchorRef} className="relative">
      {/* Trigger (ada panah) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-left outline-none ring-1 ring-transparent transition ${
          disabled ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-500"
                   : "border-gray-300 hover:bg-gray-50 focus:ring-indigo-200"
        }`}
        title={label || placeholder}
      >
        <span className={label ? "text-gray-900" : "text-gray-500"}>
          {label || placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
      </button>

      {/* Panel via portal — tidak kepotong & posisi tepat pada baris yg dibuka */}
      {mounted && open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[99999] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
        >
          {/* Search bar (kontras) */}
          <div
            ref={headerRef}
            className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white px-3 py-2"
          >
            <Search className="h-4 w-4 text-gray-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kode atau nama…"
              className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-gray-400"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, items.length - 1)); }
                if (e.key === "ArrowUp")   { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
                if (e.key === "Enter" && items[hi]) { e.preventDefault(); pick(items[hi]); }
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>

          {/* Daftar (scrollable) */}
          <div className="overflow-y-auto" style={{ maxHeight: listMaxH }}>
            {loading && <div className="px-3 py-2 text-sm text-gray-600">Mencari…</div>}
            {!loading && items.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Tidak ada hasil</div>
            )}
            <ul className="py-1">
              {items.map((it, idx) => (
                <li key={it.id}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); pick(it); }}
                    onMouseEnter={() => setHi(idx)}
                    className={`grid w-full grid-cols-[6.5rem_1fr_auto] items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 ${
                      idx === hi ? "bg-gray-50" : ""
                    }`}
                  >
                    <span className="tabular-nums font-semibold text-gray-900 tracking-wide">
                      {it.kode}
                    </span>
                    <span className="text-gray-800">{it.nama}</span>
                    {label.startsWith(it.kode) && <Check className="h-4 w-4 text-indigo-600" />}
                  </button>
                </li>
              ))}
              <li aria-hidden className="h-1" />
            </ul>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
