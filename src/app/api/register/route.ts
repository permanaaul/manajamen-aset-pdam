import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const { nama, email, password, role } = await req.json();

    if (!nama || !email || !password) {
      return NextResponse.json(
        { error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }
    // @ts-ignore
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // @ts-ignore
    const user = await prisma.user.create({
      data: {
        nama,
        email,
        password: hashedPassword,
        role: (role as Role) || "PETUGAS",
      },
    });

    return NextResponse.json(
      { message: "Registrasi berhasil", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Gagal register" }, { status: 500 });
  }
}
