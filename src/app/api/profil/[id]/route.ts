import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 🔹 GET: Ambil data user berdasarkan ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  try {
    // @ts-ignore
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nama: true,
        email: true,
        hp: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET profil error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// 🔹 PUT: Update data user berdasarkan ID
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  try {
    const body = await req.json();
    // @ts-ignore
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        nama: body.nama,
        email: body.email,
        hp: body.hp,
      },
      select: {
        id: true,
        nama: true,
        email: true,
        hp: true,
        role: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error("PUT profil error:", error);
    return NextResponse.json(
      { error: error?.message || "Gagal memperbarui profil" },
      { status: 500 }
    );
  }
}
