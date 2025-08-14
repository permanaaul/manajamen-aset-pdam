import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { KATEGORI_ASET, type KategoriAset } from "@/app/constants/kategoriAset";
import { regeneratePenyusutanForAset } from "@/lib/penyusutan";

// GET semua aset (opsional: ?q=search)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    // @ts-ignore
    const aset = await prisma.aset.findMany({
      where: q
        ? {
            OR: [
              { nia: { contains: q } },
              { nama: { contains: q } },
              { lokasi: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(aset);
  } catch (error) {
    console.error("Error GET aset:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data aset" },
      { status: 500 }
    );
  }
}

// POST tambah aset baru
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      nia,
      nama,
      kategori,
      lokasi,
      tahun,
      nilai,
      kondisi,
      catatan,

      // ---- Opsi setup penyusutan (opsional) ----
      tanggalOperasi,
      umurManfaatTahun,
      nilaiResidu,
      metodePenyusutan,       // "GARIS_LURUS" | "SALDO_MENURUN"
      golonganDepresiasi,     // "GOL_I" | "GOL_II" | "GOL_III" | "GOL_IV" | "BANGUNAN_PERMANEN" | "BANGUNAN_NON_PERMANEN"
      mulaiPenyusutan,
    } = body ?? {};

    // Validasi wajib
    if (
      !nia ||
      !nama ||
      !kategori ||
      !lokasi ||
      tahun == null ||
      nilai == null ||
      !kondisi
    ) {
      return NextResponse.json(
        { error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    // Validasi kategori
    if (!KATEGORI_ASET.includes(kategori as KategoriAset)) {
      return NextResponse.json(
        { error: "Kategori tidak valid" },
        { status: 400 }
      );
    }

    // Validasi tahun
    const tahunNum = Number(tahun);
    if (!Number.isInteger(tahunNum)) {
      return NextResponse.json(
        { error: "Tahun harus bilangan bulat" },
        { status: 400 }
      );
    }

    // Validasi nilai perolehan
    const nilaiStr = String(nilai);
    if (!/^\d+(\.\d{1,2})?$/.test(nilaiStr)) {
      return NextResponse.json(
        { error: "Nilai harus desimal (maks 2 digit di belakang koma)" },
        { status: 400 }
      );
    }

    // Siapkan payload create
    const dataCreate: Prisma.AsetCreateInput = {
      nia,
      nama,
      kategori: kategori as any,
      lokasi,
      tahun: tahunNum,
      nilai: new Prisma.Decimal(nilaiStr),
      kondisi,
      catatan: catatan ?? null,
      // --- opsi penyusutan (optional fields) ---
      tanggalOperasi: tanggalOperasi ? new Date(tanggalOperasi) : undefined,
      umurManfaatTahun:
        umurManfaatTahun != null ? Number(umurManfaatTahun) : undefined,
      nilaiResidu:
        nilaiResidu != null ? new Prisma.Decimal(String(nilaiResidu)) : undefined,
      metodePenyusutan:
        metodePenyusutan === "GARIS_LURUS" || metodePenyusutan === "SALDO_MENURUN"
          ? metodePenyusutan
          : undefined,
      golonganDepresiasi:
        [
          "GOL_I",
          "GOL_II",
          "GOL_III",
          "GOL_IV",
          "BANGUNAN_PERMANEN",
          "BANGUNAN_NON_PERMANEN",
        ].includes(golonganDepresiasi)
          ? golonganDepresiasi
          : undefined,
      mulaiPenyusutan: mulaiPenyusutan ? new Date(mulaiPenyusutan) : undefined,
    };
    // @ts-ignore
    const asetBaru = await prisma.aset.create({ data: dataCreate });

    // Regenerasi jadwal penyusutan setelah create
    await regeneratePenyusutanForAset(asetBaru.id);

    return NextResponse.json(asetBaru, { status: 201 });
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "NIA sudah digunakan" },
        { status: 409 }
      );
    }
    console.error("Error POST aset:", error);
    return NextResponse.json(
      { error: "Gagal menambahkan aset" },
      { status: 500 }
    );
  }
}
