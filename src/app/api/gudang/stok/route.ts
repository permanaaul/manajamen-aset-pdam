// app/api/gudang/stok/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** Hitung saldo stok dari transaksi:
 *   IN  -> +qty
 *   OUT -> -qty
 *   ADJ -> +qty (boleh negatif dari input qty kalau ingin koreksi minus)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const itemId = url.searchParams.get("itemId");
    const q = (url.searchParams.get("q") || "").trim();

    // Ambil semua lines + jenis header, lalu agregasi di JS (praktis & aman)
    //@ts-ignore
    const lines = await prisma.stokTransaksiLine.findMany({
      where: itemId ? { itemId: Number(itemId) } : undefined,
      select: {
        itemId: true,
        qty: true,
        header: { select: { jenis: true } },
        item: q
          ? { select: { id: true, kode: true, nama: true, satuan: { select: { simbol: true } } } }
          : undefined,
      },
    });

    const map = new Map<
      number,
      { itemId: number; saldo: number; kode?: string; nama?: string; satuan?: string }
    >();

    for (const l of lines) {
      const sign = l.header.jenis === "IN" ? 1 : l.header.jenis === "OUT" ? -1 : 1;
      const curr = map.get(l.itemId) ?? { itemId: l.itemId, saldo: 0 };
      curr.saldo += sign * Number(l.qty || 0);

      if (l.item) {
        //@ts-ignore
        curr.kode = l.item.kode;
        //@ts-ignore
        curr.nama = l.item.nama;
        //@ts-ignore
        curr.satuan = l.item.satuan?.simbol ?? "";
      }
      map.set(l.itemId, curr);
    }

    const rows = Array.from(map.values()).sort((a, b) =>
      (a.nama || "").localeCompare(b.nama || "")
    );

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
