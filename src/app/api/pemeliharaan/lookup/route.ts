// app/api/pemeliharaan/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toNum = (v: unknown) => (v == null ? null : Number(v) || 0);

// Tipe ringan untuk hasil SELECT aset
type AsetRow = {
  id: number;
  nia: string;
  nama: string;
  kategori: string;
  lokasi: string | null;
  tahun: number | null;
  nilai: unknown; // DECIMAL bisa string/Prisma.Decimal -> normalisasi pakai toNum
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "").toLowerCase();
    const q = (url.searchParams.get("q") || "").trim();
    const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") || 20)));

    if (type === "aset") {
      const where = q
        ? {
            OR: [
              { nia: { contains: q, mode: "insensitive" } },
              { nama: { contains: q, mode: "insensitive" } },
              { kategori: { contains: q, mode: "insensitive" } },
              { lokasi: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined;

      // @ts-ignore – biarkan Prisma tipe otomatis; kita normalkan manual di bawah
      const rows = (await prisma.aset.findMany({
        where,
        orderBy: [{ nama: "asc" }, { id: "asc" }],
        take,
        select: {
          id: true,
          nia: true,
          nama: true,
          kategori: true,
          lokasi: true,
          tahun: true,
          nilai: true,
        },
      })) as unknown as AsetRow[];

      const out = rows.map((r: AsetRow) => ({
        id: r.id,
        nia: r.nia,
        nama: r.nama,
        kategori: r.kategori,
        lokasi: r.lokasi,
        tahun: r.tahun,
        nilai: toNum(r.nilai),
      }));

      return NextResponse.json({ rows: out });
    }

    // tipe lain tidak dipakai di layar ini
    return NextResponse.json({ rows: [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
