import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

/** GET /api/akuntansi/unit-biaya */
export async function GET() {
  try {
    // @ts-ignore
    const rows = await prisma.unitBiaya.findMany({
      orderBy: [{ isActive: "desc" }, { nama: "asc" }, { kode: "asc" }],
    });
    return NextResponse.json(rows);
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    return NextResponse.json(
      { error: err.message, code: (err as any)?.code, meta: (err as any)?.meta },
      { status: 500 }
    );
  }
}

/** POST /api/akuntansi/unit-biaya */
export async function POST(req: Request) {
  // proteksi role
  try {
    await assertRole(req, ["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const kode = String(body?.kode ?? "").trim().toUpperCase();
    const nama = String(body?.nama ?? "").trim();
    // enum sesuai schema: PRODUKSI | DISTRIBUSI | PELAYANAN | ADMINISTRASI | UMUM_SDM | LABORATORIUM | LAINNYA
    const jenis = (String(body?.jenis ?? "LAINNYA").trim().toUpperCase()) as
      | "PRODUKSI" | "DISTRIBUSI" | "PELAYANAN" | "ADMINISTRASI" | "UMUM_SDM" | "LABORATORIUM" | "LAINNYA";

    const isActive = typeof body?.isActive === "boolean" ? body.isActive : (body?.aktif ?? true);
    // parentId kita set flat (null). Kalau suatu hari pakai hierarki, bisa di-accept dari body.
    const parentId = null;

    if (!kode) return NextResponse.json({ error: "Kode wajib diisi." }, { status: 400 });
    if (!nama) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });

    // @ts-ignore
    const created = await prisma.unitBiaya.create({
      data: { kode, nama, jenis, isActive, parentId },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    if ((err as any)?.code === "P2002") {
      // unique constraint violation (kode)
      return NextResponse.json(
        { error: "Kode unit sudah digunakan.", code: "P2002" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err?.message || "Server error", code: (err as any)?.code, meta: (err as any)?.meta },
      { status: 500 }
    );
  }
}
