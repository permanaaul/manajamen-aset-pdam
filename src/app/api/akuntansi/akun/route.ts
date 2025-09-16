//api/akuntansi/akun/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type AkunRow = { id:number; kode:string; nama:string; pos:"DEBIT"|"KREDIT" };

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const take = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    //@ts-ignore
    const rows = await prisma.akun.findMany({
      where: q ? {
        OR: [
          { kode: { contains: q } },
          { nama: { contains: q } },
        ],
      } : undefined,
      orderBy: [{ kode: "asc" }],
      take,
      select: { id: true, kode: true, nama: true, pos: true },
    });

    return NextResponse.json(rows as AkunRow[]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
