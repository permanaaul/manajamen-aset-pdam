import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

type TipeKategori = "BIAYA" | "PENDAPATAN" | "ASET";

type Params = { params: { id: string } };
type PatchBody = {
  kode?: string;
  nama?: string;
  tipe?: string;
  isActive?: boolean;

  // NEW: mapping COA (opsional)
  debitAkunId?: number | string | null;
  kreditAkunId?: number | string | null;
};

function normalizeTipe(v?: string | null): TipeKategori | undefined {
  if (typeof v !== "string") return undefined;
  const raw = v.trim().toUpperCase();
  return (["BIAYA", "PENDAPATAN", "ASET"].includes(raw) ? (raw as TipeKategori) : undefined);
}
function toNumOrNull(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(_: Request, { params }: Params) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    // @ts-ignore
    const row = await prisma.biayaKategori.findUnique({
      where: { id },
      include: {
        debitAkun: { select: { id: true, kode: true, nama: true } },
        kreditAkun: { select: { id: true, kode: true, nama: true } },
      },
    });
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

export async function PATCH(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });

    const body = (await req.json()) as PatchBody;

    const data: any = {};
    if (typeof body.kode === "string") data.kode = body.kode.trim().toUpperCase();
    if (typeof body.nama === "string") data.nama = body.nama.trim();
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const tipe = normalizeTipe(body.tipe);
    if (tipe) data.tipe = tipe;

    // --- mapping COA (opsional) ---
    const hasDebitKey = Object.prototype.hasOwnProperty.call(body, "debitAkunId");
    const hasKreditKey = Object.prototype.hasOwnProperty.call(body, "kreditAkunId");

    const debitAkunId = toNumOrNull(body.debitAkunId);
    const kreditAkunId = toNumOrNull(body.kreditAkunId);

    if (hasDebitKey) {
      if (debitAkunId === null) {
        data.debitAkunId = null; // clear mapping
      } else if (debitAkunId !== undefined) {
        // @ts-ignore
        const exist = await prisma.akun.findUnique({ where: { id: debitAkunId } });
        if (!exist) return NextResponse.json({ error: "debitAkunId tidak ditemukan." }, { status: 400 });
        data.debitAkunId = debitAkunId;
      }
    }

    if (hasKreditKey) {
      if (kreditAkunId === null) {
        data.kreditAkunId = null; // clear mapping
      } else if (kreditAkunId !== undefined) {
        // @ts-ignore
        const exist = await prisma.akun.findUnique({ where: { id: kreditAkunId } });
        if (!exist) return NextResponse.json({ error: "kreditAkunId tidak ditemukan." }, { status: 400 });
        data.kreditAkunId = kreditAkunId;
      }
    }

    // @ts-ignore
    const updated = await prisma.biayaKategori.update({
      where: { id },
      data,
      include: {
        debitAkun: { select: { id: true, kode: true, nama: true } },
        kreditAkun: { select: { id: true, kode: true, nama: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    if (err.code === "P2002") return NextResponse.json({ error: "Kode sudah digunakan.", code: err.code }, { status: 409 });
    if (err.code === "P2025") return NextResponse.json({ error: "Data tidak ditemukan.", code: err.code }, { status: 404 });
    return NextResponse.json(
      { error: err.message || "Server error", code: (err as any)?.code, meta: (err as any)?.meta },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    // @ts-ignore
    await prisma.biayaKategori.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    if (err.code === "P2003") {
      return NextResponse.json(
        { error: "Kategori dipakai di jurnal/anggaran, tidak bisa dihapus.", code: err.code },
        { status: 409 }
      );
    }
    if (err.code === "P2025") return NextResponse.json({ error: "Data tidak ditemukan.", code: err.code }, { status: 404 });
    return NextResponse.json(
      { error: err.message || "Server error", code: (err as any)?.code, meta: (err as any)?.meta },
      { status: 500 }
    );
  }
}
