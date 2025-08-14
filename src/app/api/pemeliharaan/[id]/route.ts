import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, JenisPekerjaanPemeliharaan, StrategiPerlakuan } from "@prisma/client";

type Params = { params: { id: string } };

function normalizeEnum<T extends string>(raw: any, allowed: readonly T[]): T | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const norm = raw.trim().toUpperCase().replace(/\s+/g, "_");
  return (allowed as readonly string[]).includes(norm) ? (norm as T) : undefined;
}
const D = (v: any) =>
  v === null || v === undefined || v === ""
    ? undefined
    : new Prisma.Decimal(String(v));

export async function GET(_req: Request, { params }: Params) {
  try {
    // @ts-ignore
    const pemeliharaan = await prisma.pemeliharaan.findUnique({
      where: { id: Number(params.id) },
      include: { aset: { select: { id: true, nia: true, nama: true } } },
    });
    if (!pemeliharaan)
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    return NextResponse.json(pemeliharaan);
  } catch (error) {
    console.error("Error GET detail pemeliharaan:", error);
    return NextResponse.json({ error: "Gagal mengambil detail pemeliharaan" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const body = await req.json();

    const {
      asetId,
      tanggal,
      jenis,
      biaya,
      pelaksana,
      catatan,
      status,

      // detail teknis (opsional)
      jenisPekerjaan,
      strategi,
      downtimeJam,
      biayaMaterial,
      biayaJasa,
      sukuCadang,
    } = body ?? {};

    if (!asetId || !tanggal || !jenis || !pelaksana || !status) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    // pastikan aset ada
    // @ts-ignore
    const aset = await prisma.aset.findUnique({ where: { id: Number(asetId) } });
    if (!aset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });

    const jenisPek = normalizeEnum<JenisPekerjaanPemeliharaan>(
      jenisPekerjaan,
      Object.values(JenisPekerjaanPemeliharaan)
    );
    const strategiOK = normalizeEnum<StrategiPerlakuan>(
      strategi,
      Object.values(StrategiPerlakuan)
    );

    // susun data update — hanya set field jika ada nilai (biar tidak “Invalid value”)
    const dataUpdate: Prisma.PemeliharaanUpdateInput = {
      aset: { connect: { id: Number(asetId) } },
      tanggal: new Date(tanggal),
      jenis: String(jenis).trim(),
      pelaksana: String(pelaksana).trim(),
      status: String(status),
      catatan: catatan === undefined ? undefined : (catatan ? String(catatan).trim() : null),

      biaya: biaya === undefined ? undefined : D(biaya),

      jenisPekerjaan: jenisPekerjaan === undefined ? undefined : (jenisPek ?? null),
      strategi: strategi === undefined ? undefined : (strategiOK ?? null),
      downtimeJam: downtimeJam === undefined ? undefined : D(downtimeJam),
      biayaMaterial: biayaMaterial === undefined ? undefined : D(biayaMaterial),
      biayaJasa: biayaJasa === undefined ? undefined : D(biayaJasa),
      sukuCadang:
        sukuCadang === undefined
          ? undefined
          : sukuCadang && (Array.isArray(sukuCadang) || typeof sukuCadang === "object")
          ? sukuCadang
          : null,
    };

    // @ts-ignore
    const updated = await prisma.pemeliharaan.update({
      where: { id: Number(params.id) },
      data: dataUpdate,
      include: { aset: { select: { id: true, nia: true, nama: true } } },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error PUT pemeliharaan:", error);
    return NextResponse.json({ error: "Gagal update pemeliharaan" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    // @ts-ignore
    await prisma.pemeliharaan.delete({ where: { id: Number(params.id) } });
    return NextResponse.json({ message: "Data berhasil dihapus" });
  } catch (error) {
    console.error("Error DELETE pemeliharaan:", error);
    return NextResponse.json({ error: "Gagal menghapus pemeliharaan" }, { status: 500 });
  }
}
