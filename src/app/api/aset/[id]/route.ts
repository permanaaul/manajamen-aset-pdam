// app/api/aset/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);

/** DETAIL ASET + RINGKASAN PEMAKAIAN */
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    // @ts-ignore
    const aset = await prisma.aset.findUnique({
      where: { id },
      select: {
        id: true,
        nia: true,
        nama: true,
        kategori: true,
        lokasi: true,
        tahun: true,
        nilai: true,
        kondisi: true,
        catatan: true,
        // field penyusutan (opsional)
        tanggalOperasi: true,
        umurManfaatTahun: true,
        nilaiResidu: true,
        metodePenyusutan: true,
        golonganDepresiasi: true,
        mulaiPenyusutan: true,

        createdAt: true,
        updatedAt: true,
      },
    });
    if (!aset) return NextResponse.json({ error: "not found" }, { status: 404 });

    // ringkasan pemakaian
    // @ts-ignore
    const lines = await prisma.stokTransaksiLine.findMany({
      where: { asetId: id },
      select: { qty: true, hargaRp: true },
    });

    let totalQty = 0;
    let totalRp = 0;
    for (const l of lines) {
      const q = toNum(l.qty);
      const h = toNum(l.hargaRp);
      totalQty += q;
      totalRp += q * h;
    }

    const out = {
      ...aset,
      nilai: toNum(aset.nilai),
      nilaiResidu: aset.nilaiResidu == null ? null : toNum(aset.nilaiResidu),
      summary: { totalQty, totalRp },
    };
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/** UPDATE ASET (partial update / PATCH-style) */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    const body = await req.json();

    const {
      nama,
      kategori,
      lokasi,
      tahun,
      nilai,
      kondisi,
      catatan,

      // penyusutan (opsional)
      tanggalOperasi,
      umurManfaatTahun,
      nilaiResidu,
      metodePenyusutan,
      golonganDepresiasi,
      mulaiPenyusutan,
    } = body ?? {};

    const data: any = {};

    if (nama !== undefined) data.nama = String(nama).trim();
    if (kategori !== undefined && kategori !== "") data.kategori = String(kategori).toUpperCase();
    if (lokasi !== undefined) data.lokasi = lokasi === "" ? null : String(lokasi);
    if (tahun !== undefined)  data.tahun  = tahun === "" || tahun == null ? null : Number(tahun) || null;
    if (nilai !== undefined)  data.nilai  = nilai === "" || nilai == null ? null : Number(nilai);
    if (kondisi !== undefined) data.kondisi = kondisi === "" ? null : String(kondisi);
    if (catatan !== undefined) data.catatan = catatan === "" ? null : String(catatan);

    // penyusutan
    if (tanggalOperasi !== undefined)
      data.tanggalOperasi = tanggalOperasi ? new Date(tanggalOperasi) : null;

    if (umurManfaatTahun !== undefined)
      data.umurManfaatTahun =
        umurManfaatTahun === "" || umurManfaatTahun == null ? null : Number(umurManfaatTahun) || null;

    if (nilaiResidu !== undefined)
      data.nilaiResidu = nilaiResidu === "" || nilaiResidu == null ? null : Number(nilaiResidu);

    if (metodePenyusutan !== undefined)
      data.metodePenyusutan =
        metodePenyusutan ? String(metodePenyusutan).toUpperCase() : null;

    if (golonganDepresiasi !== undefined)
      data.golonganDepresiasi =
        golonganDepresiasi ? String(golonganDepresiasi).toUpperCase() : null;

    if (mulaiPenyusutan !== undefined)
      data.mulaiPenyusutan = mulaiPenyusutan ? new Date(mulaiPenyusutan) : null;

    // @ts-ignore
    const updated = await prisma.aset.update({
      where: { id },
      data,
      select: { id: true },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Duplikat data unik" }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
