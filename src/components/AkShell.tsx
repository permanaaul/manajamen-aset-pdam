"use client";
import React from "react";

export default function AkShell({
  title,
  subtitle,
  children,
  full = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  full?: boolean; // <— tambahkan
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      <div className={full ? "w-full px-6 py-6" : "mx-auto max-w-7xl px-6 py-6"}>
        <header className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-300/80">{subtitle}</p>}
        </header>
        <main className="space-y-4">{children}</main>
      </div>
    </div>
  );
}

export const glass =
  "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md ring-1 ring-white/10 shadow-sm";
export const pill =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1";
