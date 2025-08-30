"use client";
import React from "react";

type T = { id: number; msg: string; tone?: "ok" | "err" | "info" };

export default function useToast() {
  const [list, setList] = React.useState<T[]>([]);
  const push = React.useCallback((msg: string, tone: T["tone"] = "info") => {
    const id = Date.now();
    setList((l) => [...l, { id, msg, tone }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3500);
  }, []);
  const View = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {list.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2 rounded-lg shadow border text-sm ${
            t.tone === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : t.tone === "err"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
  return { push, View };
}
