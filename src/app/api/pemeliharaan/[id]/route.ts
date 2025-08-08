import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET detail pemeliharaan
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    // @ts-ignore
    const pemeliharaan = await prisma.pemeliharaan.findUnique({
      where: { id: Number(params.id) },
      include: { aset: true }, // join aset biar dapet nama aset
    });

    if (!pemeliharaan) {
      return NextResponse.json(
        { error: "Data tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(pemeliharaan);
  } catch (error) {
    console.error("Error GET detail pemeliharaan:", error);
    return NextResponse.json(
      { error: "Gagal mengambil detail pemeliharaan" },
      { status: 500 }
    );
  }
}

// PUT update pemeliharaan
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { asetId, tanggal, jenis, biaya, pelaksana, catatan, status } = body;

    // Validasi
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

    // Update pemeliharaan
    // @ts-ignore
    const updated = await prisma.pemeliharaan.update({
      where: { id: Number(params.id) },
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error PUT pemeliharaan:", error);
    return NextResponse.json(
      { error: "Gagal update pemeliharaan" },
      { status: 500 }
    );
  }
}

// DELETE hapus pemeliharaan
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // @ts-ignore
    await prisma.pemeliharaan.delete({
      where: { id: Number(params.id) },
    });
    return NextResponse.json({ message: "Data berhasil dihapus" });
  } catch (error) {
    console.error("Error DELETE pemeliharaan:", error);
    return NextResponse.json(
      { error: "Gagal menghapus pemeliharaan" },
      { status: 500 }
    );
  }
}
