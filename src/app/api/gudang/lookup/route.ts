// app/api/gudang/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "").toLowerCase();
    const q = (url.searchParams.get("q") || "").trim();

    if (type === "item") {
      // @ts-ignore
      const rows = await prisma.item.findMany({
        where: q
          ? {
              OR: [
                { kode: { contains: q, mode: "insensitive" } },
                { nama: { contains: q, mode: "insensitive" } },
              ],
            }
          : undefined,
        orderBy: [{ kode: "asc" }],
        take: 50,
        select: { id: true, kode: true, nama: true, satuan: true },
      });
      return NextResponse.json({ rows });
    }

    if (type === "gudang") {
      // @ts-ignore
      const rows = await prisma.gudang.findMany({
        where: q
          ? {
              OR: [
                { kode: { contains: q, mode: "insensitive" } },
                { nama: { contains: q, mode: "insensitive" } },
              ],
            }
          : undefined,
        orderBy: [{ kode: "asc" }, { id: "asc" }],
        take: 50,
        select: { id: true, kode: true, nama: true },
      });
      return NextResponse.json({ rows });
    }

    // Fallback (hanya satuan; aman untuk schema sekarang)
    // @ts-ignore
    const satuan = await prisma.itemSatuan.findMany({
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, simbol: true },
    });
    return NextResponse.json({ satuan });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
