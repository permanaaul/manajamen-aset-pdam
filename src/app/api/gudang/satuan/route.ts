import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** GET /api/gudang/satuan?q=&page=&size=&order=&dir= */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "15", 10)));
    const skip = (page - 1) * size;

    const orderParam = (url.searchParams.get("order") || "nama").toLowerCase();
    const dirParam = (url.searchParams.get("dir") || "asc").toLowerCase() as "asc" | "desc";
    const allowed = new Set(["nama", "simbol", "createdat", "updatedat"]);
    const sortField = allowed.has(orderParam) ? orderParam : "nama";
    const orderBy: any =
      sortField === "createdat" ? { createdAt: dirParam } :
      sortField === "updatedat" ? { updatedAt: dirParam } :
      { [sortField]: dirParam };

    const where: any = {};
    if (q) {
      // MySQL: tidak pakai mode: "insensitive"
      where.OR = [
        { nama:   { contains: q } },
        { simbol: { contains: q } },
      ];
    }

    const [count, rows] = await Promise.all([
      // ✅ cara benar untuk count
      //@ts-ignore
      prisma.itemSatuan.count({ where }),
      //@ts-ignore
      prisma.itemSatuan.findMany({
        where, orderBy, skip, take: size,
        select: { id: true, nama: true, simbol: true, createdAt: true, updatedAt: true },
      }),
    ]);

    return NextResponse.json({ rows, count, page, size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/** POST /api/gudang/satuan
 * body: { nama, simbol? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const nama = String(body?.nama || "").trim();
    const simbol = body?.simbol != null ? String(body.simbol).trim() : null;

    if (!nama) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    //@ts-ignore
    const created = await prisma.itemSatuan.create({
      data: { nama, simbol: simbol || null },
      select: { id: true, nama: true, simbol: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Nama satuan sudah dipakai" }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
