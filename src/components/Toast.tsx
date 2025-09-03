"use client";

import React from "react";

/** ===== Types ===== */
type ToastKind = "ok" | "err" | "info";
type ToastItem = { id: string; kind: ToastKind; msg: string; timeout?: number };

/** ===== Global store (singleton) ===== */
let toasts: ToastItem[] = [];
let subs: Array<(arr: ToastItem[]) => void> = [];

function notify() {
  for (const s of subs) s(toasts);
}

function addToast(t: ToastItem) {
  toasts = [t, ...toasts];
  notify();
  const ttl = Number.isFinite(t.timeout as number) ? (t.timeout as number) : 3000;
  if (ttl > 0) setTimeout(() => removeToast(t.id), ttl);
}

function removeToast(id: string) {
  const before = toasts.length;
  toasts = toasts.filter((x) => x.id !== id);
  if (toasts.length !== before) notify();
}

/** ===== Hook API ===== */
export default function useToast() {
  const push = React.useCallback((msg: string, kind: ToastKind = "info", timeout?: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addToast({ id, kind, msg, timeout });
  }, []);

  const View = React.useCallback(() => <ToastView />, []);
  return { push, View };
}

/** ===== UI View ===== */
function ToastView() {
  const [list, setList] = React.useState<ToastItem[]>(toasts);

  React.useEffect(() => {
    const sub = (arr: ToastItem[]) => setList(arr);
    subs.push(sub);
    return () => {
      subs = subs.filter((s) => s !== sub);
    };
  }, []);

  if (list.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed z-[9999] top-4 right-4 flex flex-col gap-2 w-[min(92vw,360px)]"
    >
      {list.map((t) => (
        <ToastCard key={t.id} item={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose(): void }) {
  const { kind, msg } = item;

  const tone =
    kind === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : kind === "err"
      ? "border-rose-300 bg-rose-50 text-rose-900"
      : "border-indigo-300 bg-indigo-50 text-indigo-900";

  const icon =
    kind === "ok" ? (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
      </svg>
    ) : kind === "err" ? (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11 15h2v2h-2zm0-8h2v6h-2z" />
        <path d="M1 21h22L12 2 1 21z" />
      </svg>
    ) : (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 22a10 10 0 1 1 10-10 10.011 10.011 0 0 1-10 10zm1-5v-2h-2v2zm0-4V6h-2v7z" />
      </svg>
    );

  return (
    <div className={`flex items-start gap-3 border rounded-lg shadow-sm px-3 py-2 ${tone}`}>
      <div className="mt-0.5">{icon}</div>
      <div className="text-sm leading-snug whitespace-pre-wrap flex-1">{msg}</div>
      <button onClick={onClose} aria-label="Tutup notifikasi" className="ml-2 rounded p-1/2 hover:opacity-70">
        <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}
