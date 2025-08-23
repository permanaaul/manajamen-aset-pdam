// src/lib/num.ts
export const num = (v: unknown) => Number(v ?? 0);

export const toDate = (s?: string | null) =>
  s ? new Date(s) : undefined;
