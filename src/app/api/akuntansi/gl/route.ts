// src/app/api/akuntansi/gl/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

function toDate(d?: string | null) {
  if (!d) return null;
  return new Date(`${d}T00:00:00`);
}

type SourceFilter = "" | "jurnal" | "penyusutan";

export async function GET(req: Request) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = toDate(searchParams.get("from"));
  const to = toDate(searchParams.get("to"));
  const q = (searchParams.get("q") || "").trim();
  const source = (searchParams.get("source") || "") as SourceFilter;

  const where: any = {};
  if (from || to) {
    where.tanggal = {};
    if (from) where.tanggal.gte = from;
    if (to) where.tanggal.lte = to;
  }
  if (q) {
    where.OR = [
      { ref: { contains: q } },
      { uraian: { contains: q } },
      { sumber: { contains: q } },
    ];
  }
  if (source === "jurnal") where.sumber = { startsWith: "JURNAL:" };
  if (source === "penyusutan") where.sumber = { startsWith: "PENYUSUTAN:" };

  // @ts-ignore
  const rows = (await prisma.jurnalUmum.findMany({
    where,
    orderBy: [{ tanggal: "desc" }, { id: "desc" }],
    take: 300,
    include: { _count: { select: { lines: true } } },
  })) as Array<{
    id: number;
    tanggal: Date;
    ref: string | null;
    uraian: string | null;
    sumber: string | null;
    createdAt: Date;
    _count?: { lines?: number };
  }>;

  // parse sumber -> sourceType + sourceId
  const items = rows.map((h) => {
    let sourceType: "JURNAL" | "PENYUSUTAN" | null = null;
    let sourceId: number | null = null;
    if (typeof h.sumber === "string") {
      const [t, v] = h.sumber.split(":");
      if (t === "JURNAL") sourceType = "JURNAL";
      if (t === "PENYUSUTAN") sourceType = "PENYUSUTAN";
      if (v && !Number.isNaN(Number(v))) sourceId = Number(v);
    }
    return {
      id: h.id,
      tanggal: h.tanggal,
      ref: h.ref,
      uraian: h.uraian,
      sumber: h.sumber,
      sourceType,
      sourceId,
      linesCount: h._count?.lines ?? 0,
      createdAt: h.createdAt,
    };
  });

  return NextResponse.json(items);
}
