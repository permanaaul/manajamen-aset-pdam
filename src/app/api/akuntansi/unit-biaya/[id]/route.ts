import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

type Params = { params: { id: string } };

/** GET /api/akuntansi/unit-biaya/[id] */
export async function GET(_: Request, { params }: Params) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    }
    // @ts-ignore
    const row = await prisma.unitBiaya.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    return NextResponse.json(
      { error: err.message, code: (err as any)?.code, meta: (err as any)?.meta },
      { status: 500 }
    );
  }
}

/** PATCH /api/akuntansi/unit-biaya/[id] */
export async function PATCH(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    }

    const body = await req.json();
    const data: any = {};

    if (typeof body?.kode === "string") data.kode = body.kode.trim().toUpperCase();
    if (typeof body?.nama === "string") data.nama = body.nama.trim();

    if (typeof body?.jenis === "string") {
      const j = body.jenis.trim().toUpperCase();
      // validasi cepat terhadap enum
      const allowed = [
        "PRODUKSI",
        "DISTRIBUSI",
        "PELAYANAN",
        "ADMINISTRASI",
        "UMUM_SDM",
        "LABORATORIUM",
        "LAINNYA",
      ];
      if (!allowed.includes(j)) {
        return NextResponse.json({ error: "Jenis tidak valid." }, { status: 400 });
      }
      data.jenis = j;
    }

    if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
    // fallback kompatibilitas UI lama
    if (typeof body?.aktif === "boolean") data.isActive = body.aktif;

    // kita tetap flat
    data.parentId = null;

    // @ts-ignore
    const updated = await prisma.unitBiaya.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    if ((err as any)?.code === "P2002") {
      return NextResponse.json(
        { error: "Kode unit sudah digunakan.", code: "P2002" },
        { status: 409 }
      );
    }
    if ((err as any)?.code === "P2025") {
      return NextResponse.json(
        { error: "Data tidak ditemukan.", code: "P2025" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: err?.message || "Server error", code: (err as any)?.code, meta: (err as any)?.meta },
      { status: 500 }
    );
  }
}

/** DELETE /api/akuntansi/unit-biaya/[id] */
export async function DELETE(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    }
    // @ts-ignore
    await prisma.unitBiaya.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    if ((err as any)?.code === "P2003") {
      // foreign key constraint (dipakai di alokasi/jurnal/anggaran)
      return NextResponse.json(
        { error: "Unit biaya sedang dipakai, tidak bisa dihapus.", code: "P2003" },
        { status: 409 }
      );
    }
    if ((err as any)?.code === "P2025") {
      return NextResponse.json(
        { error: "Data tidak ditemukan.", code: "P2025" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: err?.message || "Server error", code: (err as any)?.code, meta: (err as any)?.meta },
      { status: 500 }
    );
  }
}

/** (Opsional) PUT -> alias ke PATCH kalau kamu pakai PUT di UI */
export async function PUT(req: Request, ctx: Params) {
  return PATCH(req, ctx);
}
