// src/app/api/akuntansi/gl/unpost/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

type SourceType = "jurnal" | "penyusutan";

export async function DELETE(req: Request) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "").toLowerCase() as SourceType;
  const id = Number(searchParams.get("id") || "");

  if (!["jurnal", "penyusutan"].includes(type)) {
    return NextResponse.json({ error: "Param 'type' invalid." }, { status: 400 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Param 'id' invalid." }, { status: 400 });
  }

  // Cari header yang terkait ke sumber tsb
  type LineHeader = { headerId: number };
  // @ts-ignore
  const lines: LineHeader[] = await prisma.jurnalUmumLine.findMany({
    where: type === "jurnal" ? { jurnalBiayaId: id } : { penyusutanId: id },
    select: { headerId: true },
  });

  if (lines.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  const headerIds = Array.from(new Set(lines.map((l: LineHeader) => l.headerId)));
  // @ts-ignore
  const removed = await prisma.$transaction(async (tx) => {
    // Hapus header -> cascade ke lines (schema: onDelete: Cascade)
    const del = await tx.jurnalUmum.deleteMany({ where: { id: { in: headerIds } } });
    return del.count;
  });

  return NextResponse.json({ ok: true, removed });
}
