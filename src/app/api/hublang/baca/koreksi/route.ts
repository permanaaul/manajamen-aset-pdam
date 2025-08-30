import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hitungPakaiDenganRollover } from "@/lib/hublang/utils";

// Pastikan util ini tersedia (sesuai yg Anda pakai)
const toInt = (v: any) => (v == null || v === "" ? undefined : Number(v));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bacaId = Number(body?.bacaId || 0);
    const angkaKiniBaru = toInt(body?.angkaKini);
    const alasan = body?.alasan || null;
    const userId = toInt(body?.userId); // isi dari session kalau ada

    if (!bacaId) return NextResponse.json({ error: "bacaId wajib" }, { status: 400 });
    if (angkaKiniBaru == null || angkaKiniBaru < 0)
      return NextResponse.json({ error: "angkaKini >= 0" }, { status: 400 });
    //@ts-ignore
    const baca = await prisma.hblBaca.findUnique({
      where: { id: bacaId },
      include: {
        sambungan: {
          include: {
            meter: { where: { aktif: true }, orderBy: { updatedAt: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!baca) return NextResponse.json({ error: "Bacaan tidak ditemukan" }, { status: 404 });

    const digitMaks = baca.sambungan.meter[0]?.digitMaks ?? 6;
    //@ts-ignore
    const kebijakan = await prisma.hblKebijakan.findFirst({ where: { id: 1 } });
    const rollover = kebijakan?.rolloverDiizinkan ?? true;

    const pakaiBaru = hitungPakaiDenganRollover(baca.angkaLalu, angkaKiniBaru, digitMaks, rollover);

    // simpan jejak koreksi + update HblBaca dalam 1 transaksi
    //@ts-ignore
    const result = await prisma.$transaction(async (tx) => {
      await tx.hblKoreksiBaca.create({
        data: {
          bacaId: baca.id,
          alasan,
          createdById: userId || null,
          angkaKiniSebelum: baca.angkaKini ?? null,
          angkaKiniSesudah: angkaKiniBaru,
          pakaiSebelum: baca.pakaiM3 ?? null,
          pakaiSesudah: pakaiBaru,
        },
      });

      const updated = await tx.hblBaca.update({
        where: { id: baca.id },
        data: {
          angkaKini: angkaKiniBaru,
          pakaiM3: pakaiBaru,
          // jangan sentuh status/ tanggal baca di endpoint koreksi
        },
        select: { id: true, angkaKini: true, pakaiM3: true },
      });

      return updated;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
