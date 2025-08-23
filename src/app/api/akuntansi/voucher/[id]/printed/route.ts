// src/app/api/akuntansi/voucher/[id]/printed/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  // @ts-ignore
  const r = await prisma.jurnalUmum.update({
    where: { id },
    data: { printCount: { increment: 1 } },
    select: { id: true, printCount: true },
  });
  return NextResponse.json(r);
}
