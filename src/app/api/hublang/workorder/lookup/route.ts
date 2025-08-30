import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const take = Math.min(500, Math.max(1, parseInt(url.searchParams.get("take") || "200", 10)));

    // @ts-ignore
    const list = await prisma.hblPelanggan.findMany({
      where: { aktif: true },
      orderBy: { nama: "asc" },
      take,
      select: {
        id: true, kode: true, nama: true,
        sambungan: {
          take: 1,
          orderBy: { id: "asc" },
          select: {
            id: true, noSambungan: true,
          }
        }
      }
    });

    type Opt = {
      id: number; kode: string; nama: string;
      sambunganId: number | null; noSambungan: string | null;
    };
    const options: Opt[] = list.map((p: any) => {
      const s = p.sambungan?.[0] ?? null;
      return {
        id: p.id,
        kode: p.kode,
        nama: p.nama,
        sambunganId: s?.id ?? null,
        noSambungan: s?.noSambungan ?? null,
      };
    });

    return NextResponse.json({ options });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
