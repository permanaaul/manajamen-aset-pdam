import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { KATEGORI_ASET, type KategoriAset } from "@/app/constants/kategoriAset";
import { regeneratePenyusutanForAset } from "@/lib/penyusutan";

type Params = { params: { nia: string } };

// GET detail aset
export async function GET(_req: Request, { params }: Params) {
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

// PUT update (partial update)
export async function PUT(req: Request, { params }: Params) {
  try {
    const body = await req.json();

    // Konstruksi data partial hanya dari field yang dikirim
    const data: Prisma.AsetUpdateInput = {};

    if (body.nama !== undefined) data.nama = String(body.nama);

    if (body.kategori !== undefined) {
      const kat = String(body.kategori) as KategoriAset;
      if (!KATEGORI_ASET.includes(kat)) {
        return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });
      }
      data.kategori = kat as any;
    }

    if (body.lokasi !== undefined) data.lokasi = String(body.lokasi);

    if (body.tahun !== undefined) {
      const tahunNum = Number(body.tahun);
      if (!Number.isInteger(tahunNum)) {
        return NextResponse.json({ error: "Tahun harus bilangan bulat" }, { status: 400 });
      }
      data.tahun = tahunNum;
    }

    if (body.nilai !== undefined) {
      const nilaiStr = String(body.nilai);
      if (!/^\d+(\.\d{1,2})?$/.test(nilaiStr)) {
        return NextResponse.json({ error: "Nilai harus desimal (maks 2 digit di belakang koma)" }, { status: 400 });
      }
      data.nilai = new Prisma.Decimal(nilaiStr);
    }

    if (body.kondisi !== undefined) data.kondisi = String(body.kondisi);
    if (body.catatan !== undefined) data.catatan = body.catatan ?? null;

    // --- opsi penyusutan (opsional) ---
    if (body.tanggalOperasi !== undefined) {
      data.tanggalOperasi = body.tanggalOperasi ? new Date(body.tanggalOperasi) : null;
    }
    if (body.umurManfaatTahun !== undefined) {
      data.umurManfaatTahun =
        body.umurManfaatTahun != null ? Number(body.umurManfaatTahun) : null;
    }
    if (body.nilaiResidu !== undefined) {
      data.nilaiResidu =
        body.nilaiResidu != null ? new Prisma.Decimal(String(body.nilaiResidu)) : null;
    }
    if (body.metodePenyusutan !== undefined) {
      const m = String(body.metodePenyusutan);
      data.metodePenyusutan =
        m === "GARIS_LURUS" || m === "SALDO_MENURUN" ? (m as any) : null;
    }
    if (body.golonganDepresiasi !== undefined) {
      const g = String(body.golonganDepresiasi);
      data.golonganDepresiasi =
        [
          "GOL_I",
          "GOL_II",
          "GOL_III",
          "GOL_IV",
          "BANGUNAN_PERMANEN",
          "BANGUNAN_NON_PERMANEN",
        ].includes(g)
          ? (g as any)
          : null;
    }
    if (body.mulaiPenyusutan !== undefined) {
      data.mulaiPenyusutan = body.mulaiPenyusutan ? new Date(body.mulaiPenyusutan) : null;
    }
    // @ts-ignore
    const asetUpdate = await prisma.aset.update({
      where: { nia: params.nia },
      data,
    });

    // Regenerasi jadwal penyusutan setelah update
    await regeneratePenyusutanForAset(asetUpdate.id);

    return NextResponse.json(asetUpdate);
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });
    }
    console.error("Error PUT aset:", error);
    return NextResponse.json({ error: "Gagal mengupdate aset" }, { status: 500 });
  }
}

// DELETE hapus aset
export async function DELETE(_req: Request, { params }: Params) {
  try {
    // @ts-ignore
    await prisma.aset.delete({ where: { nia: params.nia } });
    // Jadwal penyusutan terhapus otomatis (onDelete: Cascade pada model Penyusutan)
    return NextResponse.json({ message: "Aset berhasil dihapus" });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });
    }
    console.error("Error DELETE aset:", error);
    return NextResponse.json({ error: "Gagal menghapus aset" }, { status: 500 });
  }
}
