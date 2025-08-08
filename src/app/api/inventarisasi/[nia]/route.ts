import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET detail aset
export async function GET(req: Request, { params }: { params: { nia: string } }) {
  try {
    // @ts-ignore
    const aset = await prisma.aset.findUnique({ where: { nia: params.nia } });
    if (!aset) {
      return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(aset);
  } catch (error) {
    console.error("Error GET detail aset:", error);
    return NextResponse.json({ error: "Gagal mengambil detail aset" }, { status: 500 });
  }
}

// PUT update aset
export async function PUT(req: Request, { params }: { params: { nia: string } }) {
  try {
    const body = await req.json();
    const { nama, kategori, lokasi, tahun, nilai, kondisi, catatan } = body;
    // @ts-ignore
    const asetUpdate = await prisma.aset.update({
      where: { nia: params.nia },
      data: {
        nama,
        kategori,
        lokasi,
        tahun: parseInt(tahun),
        nilai: parseFloat(nilai),
        kondisi,
        catatan,
      },
    });

    return NextResponse.json(asetUpdate);
  } catch (error) {
    console.error("Error PUT aset:", error);
    return NextResponse.json({ error: "Gagal mengupdate aset" }, { status: 500 });
  }
}

// DELETE hapus aset
export async function DELETE(req: Request, { params }: { params: { nia: string } }) {
  try {
    // @ts-ignore
    await prisma.aset.delete({ where: { nia: params.nia } });
    return NextResponse.json({ message: "Aset berhasil dihapus" });
  } catch (error) {
    console.error("Error DELETE aset:", error);
    return NextResponse.json({ error: "Gagal menghapus aset" }, { status: 500 });
  }
}
