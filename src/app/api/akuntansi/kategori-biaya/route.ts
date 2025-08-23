import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// tipe yang valid sesuai enum TipeKategori di schema.prisma
type TipeKategori = "BIAYA" | "PENDAPATAN" | "ASET";

type CreateBody = {
  kode?: string;
  nama?: string;
  tipe?: string;
  isActive?: boolean;

  // NEW: mapping COA (opsional)
  debitAkunId?: number | string | null;
  kreditAkunId?: number | string | null;
};

function normalizeTipe(v?: string | null): TipeKategori {
  const raw = String(v || "BIAYA").trim().toUpperCase();
  return (["BIAYA", "PENDAPATAN", "ASET"].includes(raw) ? (raw as TipeKategori) : "BIAYA");
}

function toNumOrNull(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET() {
  try {
    // @ts-ignore
    const rows = await prisma.biayaKategori.findMany({
      orderBy: [{ isActive: "desc" }, { nama: "asc" }, { kode: "asc" }],
      include: {
        debitAkun: { select: { id: true, kode: true, nama: true } },
        kreditAkun: { select: { id: true, kode: true, nama: true } },
      },
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

export async function POST(req: Request) {
  try {
    await assertRole(req, ["ADMIN"]); // proteksi
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as CreateBody;

    const kode = (body.kode || "").trim().toUpperCase();
    const nama = (body.nama || "").trim();
    const tipe = normalizeTipe(body.tipe);
    const isActive = body.isActive ?? true;

    if (!kode) return NextResponse.json({ error: "Kode wajib diisi." }, { status: 400 });
    if (!nama) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });

    // --- validasi mapping akun (opsional) ---
    const debitAkunId = toNumOrNull(body.debitAkunId);
    const kreditAkunId = toNumOrNull(body.kreditAkunId);

    if (debitAkunId !== undefined && debitAkunId !== null) {
      // @ts-ignore
      const exist = await prisma.akun.findUnique({ where: { id: debitAkunId } });
      if (!exist) return NextResponse.json({ error: "debitAkunId tidak ditemukan." }, { status: 400 });
    }
    if (kreditAkunId !== undefined && kreditAkunId !== null) {
      // @ts-ignore
      const exist = await prisma.akun.findUnique({ where: { id: kreditAkunId } });
      if (!exist) return NextResponse.json({ error: "kreditAkunId tidak ditemukan." }, { status: 400 });
    }

    // @ts-ignore
    const created = await prisma.biayaKategori.create({
      data: {
        kode,
        nama,
        tipe,
        isActive,
        // biarkan null jika tak dikirim
        debitAkunId: debitAkunId ?? null,
        kreditAkunId: kreditAkunId ?? null,
      },
      include: {
        debitAkun: { select: { id: true, kode: true, nama: true } },
        kreditAkun: { select: { id: true, kode: true, nama: true } },
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;

    if (err.code === "P2002") {
      return NextResponse.json({ error: "Kode sudah digunakan.", code: err.code }, { status: 409 });
    }
    if (err.code === "P2021") {
      return NextResponse.json({ error: "Tabel tidak ditemukan. Jalankan migrasi.", code: err.code }, { status: 500 });
    }
    return NextResponse.json(
      { error: err.message || "Server error", code: (err as any)?.code, meta: (err as any)?.meta },
      { status: 500 }
    );
  }
}
