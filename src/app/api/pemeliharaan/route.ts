import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET semua data pemeliharaan
export async function GET() {
  try {
    // @ts-ignore
    const data = await prisma.pemeliharaan.findMany({
      include: { aset: true },
      orderBy: { tanggal: "desc" },
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error GET pemeliharaan:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data pemeliharaan" },
      { status: 500 }
    );
  }
}

// POST tambah data pemeliharaan
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { asetId, tanggal, jenis, biaya, pelaksana, catatan, status } = body;

    // Validasi wajib isi
    if (!asetId || !tanggal || !jenis || !pelaksana || !status) {
      return NextResponse.json(
        { error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    // Pastikan aset ada
    // @ts-ignore
    const aset = await prisma.aset.findUnique({
      where: { id: Number(asetId) },
    });

    if (!aset) {
      return NextResponse.json(
        { error: "Aset tidak ditemukan" },
        { status: 404 }
      );
    }

    // Simpan data
    // @ts-ignore
    const pemeliharaan = await prisma.pemeliharaan.create({
      data: {
        asetId: Number(asetId),
        tanggal: new Date(tanggal),
        jenis: jenis.trim(),
        biaya: biaya ? Number(biaya) : 0,
        pelaksana: pelaksana.trim(),
        catatan: catatan?.trim() || null,
        status,
      },
      include: { aset: true },
    });

    return NextResponse.json(pemeliharaan, { status: 201 });
  } catch (error) {
    console.error("Error POST pemeliharaan:", error);
    return NextResponse.json(
      { error: "Gagal menambah pemeliharaan" },
      { status: 500 }
    );
  }
}
