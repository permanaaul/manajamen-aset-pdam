import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Row = {
  id: number;
  tanggal: string | null;
  nomor: string | null;
  referensi: string | null;
  item: { id: number; kode: string; nama: string; satuan?: { nama: string | null } | null } | null;
  qty: number;
  hpp: number;
  total: number;
  catatan: string | null;
};

const toNum = (v: any) => (v == null ? 0 : Number(v) || 0);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const asetId = Number(params.id);
    if (!asetId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    const url = new URL(req.url);
    const from = url.searchParams.get("from"); // yyyy-mm-dd
    const to   = url.searchParams.get("to");   // yyyy-mm-dd
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "20", 10)));
    const skip = (page - 1) * size;

    const where: any = {
      asetId,
      header: { tipe: "ISSUE" }, // hanya pemakaian
    };
    if (from || to) {
      where.header = where.header || {};
      where.header.tanggal = {};
      if (from) where.header.tanggal.gte = new Date(`${from}T00:00:00`);
      if (to)   where.header.tanggal.lte = new Date(`${to}T23:59:59`);
    }

    // Count & rows
    const [count, rowsRaw] = await Promise.all([
      // @ts-ignore
      prisma.stokTransaksiLine.count({ where }),
      // @ts-ignore
      prisma.stokTransaksiLine.findMany({
        where,
        orderBy: [{ header: { tanggal: "desc" } }, { id: "asc" }],
        skip, take: size,
        select: {
          id: true,
          qty: true,
          hargaRp: true,
          catatan: true,
          header: { select: { tanggal: true, nomor: true, referensi: true } },
          item:   { select: { id: true, kode: true, nama: true, satuan: { select: { nama: true } } } },
        },
      }),
    ]);

    const rows: Row[] = rowsRaw.map((l: any) => {
      const qty = toNum(l.qty);
      const hpp = toNum(l.hargaRp);
      return {
        id: l.id,
        tanggal: l.header?.tanggal ? l.header.tanggal.toISOString() : null,
        nomor: l.header?.nomor ?? null,
        referensi: l.header?.referensi ?? null,
        item: l.item ?? null,
        qty,
        hpp,
        total: qty * hpp,
        catatan: l.catatan ?? null,
      };
    });

    // ringkasan cepat untuk tabel
    const sumQty  = rows.reduce((s, r) => s + r.qty, 0);
    const sumRp   = rows.reduce((s, r) => s + r.total, 0);

    return NextResponse.json({ rows, count, page, size, sumQty, sumRp });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
