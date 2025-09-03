// app/api/pemeliharaan/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** Helper angka → number aman */
const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);

/** Tipe minimal untuk baris item pemeliharaan dari SELECT */
type QItem = {
  id: number;
  qty: unknown;        // DECIMAL/string/number → akan dinormalisasi
  hargaRp: unknown;    // idem
  item: {
    id: number;
    kode: string;
    nama: string;
    satuan?: { simbol: string | null; nama: string | null } | null; // relasi ItemSatuan (opsional)
  };
};

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    //@ts-ignore
    const row = await prisma.pemeliharaan.findUnique({
      where: { id },
      select: {
        id: true,
        asetId: true,
        tanggal: true,
        jenis: true,
        pelaksana: true,
        status: true,
        biaya: true,
        catatan: true,
        jenisPekerjaan: true,
        strategi: true,
        downtimeJam: true,
        aset: { select: { id: true, nia: true, nama: true, lokasi: true } },
        items: {
          select: {
            id: true,
            qty: true,
            hargaRp: true,
            item: {
              select: {
                id: true,
                kode: true,
                nama: true,
                // Ambil simbol/nama dari master satuan (kalau ada)
                satuan: { select: { simbol: true, nama: true } },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Normalisasi items → angka number & satuan string
    const items = (row.items as QItem[]).map((it: QItem) => {
      const qty = toNum(it.qty);
      const harga = toNum(it.hargaRp);
      const satuanStr =
        it.item?.satuan?.simbol ??
        it.item?.satuan?.nama ??
        null;

      return {
        id: it.id,
        item: {
          id: it.item.id,
          kode: it.item.kode,
          nama: it.item.nama,
          satuan: satuanStr, // string | null
        },
        qty,
        hargaRp: harga,
        totalRp: qty * harga,
      };
    });

    const totalQty = items.reduce((s: number, r: { qty: number }) => s + r.qty, 0);
    const totalRp  = items.reduce((s: number, r: { totalRp: number }) => s + r.totalRp, 0);

    return NextResponse.json({
      id: row.id,
      no: `PM-${String(row.id).padStart(5, "0")}`,
      tanggal: row.tanggal ? row.tanggal.toISOString() : null,
      jenis: row.jenis,
      pelaksana: row.pelaksana,
      status: row.status,
      biaya: toNum(row.biaya),
      catatan: row.catatan ?? null,
      jenisPekerjaan: row.jenisPekerjaan ?? null,
      strategi: row.strategi ?? null,
      downtimeJam: row.downtimeJam != null ? Number(row.downtimeJam) : null,
      aset: row.aset
        ? { id: row.aset.id, nia: row.aset.nia, nama: row.aset.nama, lokasi: row.aset.lokasi }
        : null,
      items,
      summary: { totalQty, totalRp },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    const b = await req.json();
    //@ts-ignore
    const updated = await prisma.pemeliharaan.update({
      where: { id },
      data: {
        tanggal: b?.tanggal ? new Date(b.tanggal) : undefined,
        jenis: b?.jenis,
        pelaksana: b?.pelaksana,
        status: b?.status,
        biaya: b?.biaya != null ? Number(b.biaya) : undefined,
        catatan: b?.catatan,
        jenisPekerjaan: b?.jenisPekerjaan ?? undefined,
        strategi: b?.strategi ?? undefined,
        downtimeJam: b?.downtimeJam != null ? Number(b.downtimeJam) : undefined,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: updated.id, ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
