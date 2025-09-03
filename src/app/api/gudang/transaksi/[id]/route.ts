// app/api/gudang/transaksi/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** map enum tipe DB -> jenis untuk UI */
function mapTipeToJenis(t?: string | null): "IN" | "OUT" | "ADJ" | null {
  if (!t) return null;
  const s = String(t).toUpperCase();
  if (s === "RECEIPT") return "IN";
  if (s === "ISSUE") return "OUT";
  if (s === "ADJUSTMENT") return "ADJ";
  return null;
}

/** DETAIL */
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    // @ts-ignore
    const row = await prisma.stokTransaksi.findUnique({
      where: { id },
      select: {
        id: true,
        nomor: true,        // -> noTransaksi
        tanggal: true,
        tipe: true,         // -> jenis
        status: true,
        referensi: true,
        catatan: true,      // -> keterangan
        gudangAsal:   { select: { id: true, kode: true, nama: true } },
        gudangTujuan: { select: { id: true, kode: true, nama: true } },
        lines: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            itemId: true,
            qty: true,
            hargaRp: true,
            asetId: true,
            pemeliharaanId: true,
            catatan: true,
            // relasi aset (mengetahui apakah baris sudah dijadikan aset)
            aset: { select: { id: true, nia: true, nama: true } },
            // relasi item + satuan (skema baru pakai tabel ItemSatuan)
            item: {
              select: {
                id: true,
                kode: true,
                nama: true,
                satuan: { select: { id: true, nama: true, simbol: true } },
              },
            },
          },
        },
      },
    });

    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    // bentuk payload sesuai yang diharapkan UI
    const out = {
      id: row.id,
      noTransaksi: row.nomor,
      tanggal: row.tanggal ? row.tanggal.toISOString() : null,
      jenis: mapTipeToJenis(row.tipe),                 // "IN" | "OUT" | "ADJ"
      referensi: row.referensi,
      keterangan: row.catatan,                         // alias catatan -> keterangan
      // ikutkan info gudang jika nanti mau ditampilkan
      gudangAsal: row.gudangAsal,
      gudangTujuan: row.gudangTujuan,
      lines: row.lines.map((l: any) => ({
        id: l.id,
        itemId: l.itemId,
        qty: l.qty != null ? Number(l.qty) : 0,
        hargaRp: l.hargaRp != null ? Number(l.hargaRp) : null,
        asetId: l.asetId,
        pemeliharaanId: l.pemeliharaanId,
        catatan: l.catatan,
        // objek aset (kalau sudah dikonversi)
        aset: l.aset ? { id: l.aset.id, nia: l.aset.nia, nama: l.aset.nama } : null,
        // objek item + satuan (UI mengharapkan { satuan: { simbol } | null })
        item: l.item
          ? {
              id: l.item.id,
              kode: l.item.kode,
              nama: l.item.nama,
              satuan: l.item.satuan ? { simbol: l.item.satuan.simbol || l.item.satuan.nama } : null,
            }
          : null,
      })),
    };

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/** DELETE */
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      await tx.stokTransaksiLine.deleteMany({ where: { headerId: id } });
      await tx.stokTransaksi.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
