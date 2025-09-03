// app/api/gudang/items/lookup/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const takeParam = Number(url.searchParams.get("take") || 50);
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 50;
  //@ts-ignore
  const data = await prisma.item.findMany({
    where: q
      ? { isActive: true, OR: [{ kode: { contains: q } }, { nama: { contains: q } }] }
      : { isActive: true },
    orderBy: { kode: "asc" },
    take,
    select: { id: true, kode: true, nama: true },
  });

  return NextResponse.json({ data });
}
