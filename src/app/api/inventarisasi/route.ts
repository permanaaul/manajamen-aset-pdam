import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET semua aset
export async function GET() {
  try {
    // @ts-ignore
    const aset = await prisma.aset.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(aset);
  } catch (error) {
    console.error("Error GET aset:", error);
    return NextResponse.json({ error: "Gagal mengambil data aset" }, { status: 500 });
  }
}

// POST tambah aset baru
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nia, nama, kategori, lokasi, tahun, nilai, kondisi, catatan } = body;

    if (!nia || !nama || !kategori || !lokasi || !tahun || !nilai || !kondisi) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }
    // @ts-ignore
    const asetBaru = await prisma.aset.create({
      data: {
        nia,
        nama,
        kategori,
        lokasi,
        tahun: parseInt(tahun),
        nilai: parseFloat(nilai),
        kondisi,
        catatan,
      },
    });

    return NextResponse.json(asetBaru, { status: 201 });
  } catch (error) {
    console.error("Error POST aset:", error);
    return NextResponse.json({ error: "Gagal menambahkan aset" }, { status: 500 });
  }
}
