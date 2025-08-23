// src/app/api/akuntansi/neraca/lookup/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

type LookupItem = { id: number; label: string };
type UnitRow = { id: number; nama: string; kode: string | null };
type AsetRow = { id: number; nama: string; nia: string | null };

export async function GET(req: Request) {
  try { await assertRole(req, ["ADMIN", "PIMPINAN"]); }
  catch { return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "").toLowerCase(); // "unit" | "aset"
  const q = (searchParams.get("q") || "").trim();

  // >>> Jika type kosong / tak valid: balas array kosong (200) agar UI tidak error
  if (!type || (type !== "unit" && type !== "aset")) {
    return NextResponse.json([] as LookupItem[]);
  }

  if (type === "unit") {
    // @ts-ignore
    const rows = (await prisma.unitBiaya.findMany({
      where: q ? { nama: { contains: q } } : undefined,
      select: { id: true, nama: true, kode: true },
      orderBy: [{ nama: "asc" }],
      take: 50,
    })) as UnitRow[];
    return NextResponse.json(
      rows.map((u): LookupItem => ({ id: u.id, label: `${u.kode ?? "-"} — ${u.nama}` }))
    );
  }

  // type === 'aset'
  // @ts-ignore
  const rows = (await prisma.aset.findMany({
    where: q ? { nama: { contains: q } } : undefined,
    select: { id: true, nama: true, nia: true },
    orderBy: [{ nama: "asc" }],
    take: 50,
  })) as AsetRow[];
  return NextResponse.json(
    rows.map((a): LookupItem => ({ id: a.id, label: `${a.nia ?? "-"} ${a.nama}`.trim() }))
  );
}
