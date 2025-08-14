import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, JenisPekerjaanPemeliharaan, StrategiPerlakuan } from "@prisma/client";

// Helper: normalisasi enum dari string (bebas -> UPPER_SNAKE) + validasi
function normalizeEnum<T extends string>(raw: any, allowed: readonly T[]): T | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const norm = raw.trim().toUpperCase().replace(/\s+/g, "_");
  return (allowed as readonly string[]).includes(norm) ? (norm as T) : undefined;
}

// Helper: Decimal dari input (number/string) aman-null
const D = (v: any) =>
  v === null || v === undefined || v === ""
    ? undefined
    : new Prisma.Decimal(String(v));

export async function GET() {
  try {
    // @ts-ignore
    const data = await prisma.pemeliharaan.findMany({
      include: { aset: { select: { id: true, nia: true, nama: true } } },
      orderBy: { tanggal: "desc" },
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error GET pemeliharaan:", error);
    return NextResponse.json({ error: "Gagal mengambil data pemeliharaan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      asetId,
      tanggal,
      jenis,
      biaya,            // legacy total (opsional)
      pelaksana,
      catatan,
      status,

      // --- detail teknis (opsional) ---
      jenisPekerjaan,   // enum
      strategi,         // enum
      downtimeJam,      // desimal jam, contoh 1.5
      biayaMaterial,    // desimal
      biayaJasa,        // desimal
      sukuCadang,       // JSON (array item {nama, qty, satuan, harga})
    } = body ?? {};

    // Validasi wajib
    if (!asetId || !tanggal || !jenis || !pelaksana || !status) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    // Pastikan aset ada
    // @ts-ignore
    const aset = await prisma.aset.findUnique({ where: { id: Number(asetId) } });
    if (!aset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });

    // Normalisasi enum
    const jenisPek = normalizeEnum<JenisPekerjaanPemeliharaan>(
      jenisPekerjaan,
      Object.values(JenisPekerjaanPemeliharaan)
    );
    const strategiOK = normalizeEnum<StrategiPerlakuan>(
      strategi,
      Object.values(StrategiPerlakuan)
    );

    // Siapkan payload
    const dataCreate: Prisma.PemeliharaanCreateInput = {
      aset: { connect: { id: Number(asetId) } },
      tanggal: new Date(tanggal),
      jenis: String(jenis).trim(),
      pelaksana: String(pelaksana).trim(),
      status: String(status),
      catatan: catatan ? String(catatan).trim() : null,

      // legacy total biaya (boleh kosong)
      biaya: D(biaya),

      // detail teknis opsional
      jenisPekerjaan: jenisPek,            // undefined -> tidak diset
      strategi: strategiOK,
      downtimeJam: D(downtimeJam),
      biayaMaterial: D(biayaMaterial),
      biayaJasa: D(biayaJasa),
      // simpan sukuCadang hanya kalau array/objek
      sukuCadang:
        sukuCadang && (Array.isArray(sukuCadang) || typeof sukuCadang === "object")
          ? sukuCadang
          : undefined,
    };

    // @ts-ignore
    const created = await prisma.pemeliharaan.create({
      data: dataCreate,
      include: { aset: { select: { id: true, nia: true, nama: true } } },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error POST pemeliharaan:", error);
    return NextResponse.json({ error: "Gagal menambah pemeliharaan" }, { status: 500 });
  }
}
