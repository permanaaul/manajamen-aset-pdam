import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

type Params = { params: { id: string } };

// GET detail
export async function GET(_: Request, { params }: Params) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    // @ts-ignore
    const row = await prisma.akun.findUnique({
      where: { id },
      include: { parent: true, children: true },
    });
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// PATCH update
export async function PATCH(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    const body = await req.json();

    const data: any = {};
    if (typeof body.kode === "string") data.kode = body.kode.trim();
    if (typeof body.nama === "string") data.nama = body.nama.trim();
    if (typeof body.tipe === "string") {
      const t = body.tipe.toUpperCase();
      if (["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE","CONTRA_ASSET","CONTRA_REVENUE"].includes(t)) data.tipe = t;
    }
    if (typeof body.normal === "string") {
      const n = body.normal.toUpperCase();
      if (["DEBIT","CREDIT"].includes(n)) data.normal = n;
    }
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    if (Object.prototype.hasOwnProperty.call(body, "parentId")) {
      const raw = body.parentId;
      const n = Number(raw);
      const parentId =
        Number.isFinite(n) && n > 0 ? n : null;

      if (parentId === id) {
        return NextResponse.json({ error: "Akun tidak boleh menjadi induk dirinya sendiri." }, { status: 400 });
      }
      if (parentId) {
        // @ts-ignore
        const parent = await prisma.akun.findUnique({ where: { id: parentId } });
        if (!parent) return NextResponse.json({ error: "Akun induk tidak ditemukan." }, { status: 400 });
      }
      data.parentId = parentId;
    }

    // @ts-ignore
    const updated = await prisma.akun.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    if (err.code === "P2002") return NextResponse.json({ error: "Kode akun sudah digunakan.", code: err.code }, { status: 409 });
    return NextResponse.json({ error: err.message || "Server error", code: (err as any)?.code }, { status: 500 });
  }
}

// DELETE
export async function DELETE(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    // @ts-ignore
    await prisma.akun.delete({ where: { id } }); // children akan otomatis SetNull
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    return NextResponse.json({ error: err.message || "Server error", code: (err as any)?.code }, { status: 500 });
  }
}
