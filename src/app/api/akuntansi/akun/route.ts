import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// GET: daftar akun (opsional q)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    // @ts-ignore
    const rows = await prisma.akun.findMany({
      where: q
        ? {
            OR: [
              { kode: { contains: q } },
              { nama: { contains: q } },
            ],
          }
        : undefined,
      orderBy: [{ kode: "asc" }],
      include: { parent: { select: { id: true, kode: true, nama: true } } },
      take: 500,
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// POST: buat akun baru
export async function POST(req: Request) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const kode = String(body.kode || "").trim();
    const nama = String(body.nama || "").trim();
    const tipe = String(body.tipe || "").toUpperCase();      // AkunType
    const normal = String(body.normal || "").toUpperCase();  // NormalBalance
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

    // parentId bisa "", null, number
    const parentIdRaw = body.parentId;
    const parentIdNum = Number(parentIdRaw);
    const parentId =
      Number.isFinite(parentIdNum) && parentIdNum > 0 ? parentIdNum : null;

    if (!kode) return NextResponse.json({ error: "Kode wajib diisi." }, { status: 400 });
    if (!nama) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });
    if (!["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE","CONTRA_ASSET","CONTRA_REVENUE"].includes(tipe)) {
      return NextResponse.json({ error: "Tipe akun tidak valid." }, { status: 400 });
    }
    if (!["DEBIT","CREDIT"].includes(normal)) {
      return NextResponse.json({ error: "Normal balance tidak valid." }, { status: 400 });
    }

    // validasi parent jika ada
    if (parentId) {
      // @ts-ignore
      const parent = await prisma.akun.findUnique({ where: { id: parentId } });
      if (!parent) {
        return NextResponse.json({ error: "Akun induk tidak ditemukan." }, { status: 400 });
      }
    }

    // @ts-ignore
    const created = await prisma.akun.create({
      data: {
        kode, nama,
        // @ts-ignore
        tipe, normal,
        parentId, isActive,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Kode akun sudah digunakan.", code: err.code }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || "Server error", code: (err as any)?.code }, { status: 500 });
  }
}
