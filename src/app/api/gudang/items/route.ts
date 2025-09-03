// app/api/gudang/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** GET /api/gudang/items?q=&page=&size=&order=&dir=&gudangId= */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "15", 10)));
    const skip = (page - 1) * size;

    // sorting (hanya field dasar—bukan relasi)
    const orderParam = (url.searchParams.get("order") || "kode").toLowerCase();
    const dirParam = (url.searchParams.get("dir") || "asc").toLowerCase() as "asc" | "desc";
    const allowedFields = new Set(["kode", "nama", "jenis", "createdat", "updatedat"]);
    const sortField = allowedFields.has(orderParam) ? orderParam : "kode";
    const orderBy: any =
      sortField === "createdat" ? { createdAt: dirParam }
      : sortField === "updatedat" ? { updatedAt: dirParam }
      : { [sortField]: dirParam };

    // filter gudang (opsional)
    const gudangIdParam = url.searchParams.get("gudangId");
    const gudangId = gudangIdParam ? Number(gudangIdParam) : null;

    const where: any = {};
    if (q) {
      where.OR = [
        { kode: { contains: q, mode: "insensitive" } },
        { nama: { contains: q, mode: "insensitive" } },
      ];
    }

    // count
    // @ts-ignore
    const count = await prisma.item.count({ where });

    // include stok (dengan filter gudang bila ada)
    const stokInclude: any = { select: { qty: true } };
    if (gudangId) stokInclude.where = { gudangId };

    // ambil data
    // @ts-ignore
    const rowsRaw = await prisma.item.findMany({
      where,
      orderBy,
      skip,
      take: size,
      include: {
        // relasi ke master satuan baru (itemsatuan)
        satuan: { select: { id: true, nama: true, simbol: true } },
        // relasi stok saldo (nama field di schema = "stok")
        stok: stokInclude,
      },
    });

    const rows = (rowsRaw as any[]).map((it) => {
      const stokQty = Array.isArray(it.stok)
        ? it.stok.reduce((s: number, r: any) => s + (Number(r.qty) || 0), 0)
        : 0;

      return {
        id: it.id,
        kode: it.kode,
        nama: it.nama,
        jenis: it.jenis,
        minQty: it.minQty ?? 0,
        isActive: it.isActive,
        createdAt: it.createdAt,
        updatedAt: it.updatedAt,
        satuan: it.satuan ? { id: it.satuan.id, nama: it.satuan.nama, simbol: it.satuan.simbol } : null,
        stokQty,
      };
    });

    return NextResponse.json({ rows, count, page, size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/** POST /api/gudang/items
 * body: { kode, nama, jenis?, satuanId?, minQty?, isActive? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      kode,
      nama,
      jenis = "SPAREPART",
      satuanId = null,
      minQty = 0,
      isActive = true,
    } = body ?? {};

    if (!kode || !nama) {
      return NextResponse.json({ error: "kode & nama wajib" }, { status: 400 });
    }

    // validasi satuanId jika diberikan
    let unitId: number | null = null;
    if (satuanId != null) {
      const idNum = Number(satuanId) || 0;
      if (idNum) {
        // @ts-ignore
        const sat = await prisma.itemSatuan.findUnique({
          where: { id: idNum },
          select: { id: true },
        });
        if (!sat) return NextResponse.json({ error: "Satuan tidak valid" }, { status: 400 });
        unitId = idNum;
      }
    }

    // simpan
    // @ts-ignore
    const created = await prisma.item.create({
      data: {
        kode: String(kode),
        nama: String(nama),
        jenis: String(jenis).toUpperCase(), // Prisma enum JenisItem
        satuanId: unitId,                    // relasi baru (nullable)
        minQty: Number(minQty) || 0,
        isActive: Boolean(isActive),
      },
      select: { id: true, kode: true, nama: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Kode item sudah dipakai" }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
