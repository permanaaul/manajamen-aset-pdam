import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { StatusJurnal, StatusPeriode } from "@prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    // Ambil header
    // @ts-ignore
    const hdr = await prisma.jurnal.findUnique({
      where: { id },
      select: { id: true, nomor: true, status: true, periodeId: true, tanggal: true },
    });
    if (!hdr) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (hdr.status !== StatusJurnal.POSTED) {
      return NextResponse.json({ error: "Hanya POSTED yang bisa di-unpost" }, { status: 400 });
    }

    // Cek periode: harus TERBUKA untuk unpost
    if (hdr.periodeId) {
      // @ts-ignore
      const p = await prisma.periodeAkuntansi.findUnique({
        where: { id: hdr.periodeId },
        select: { status: true },
      });
      if (p && p.status !== StatusPeriode.TERBUKA) {
        return NextResponse.json({ error: "Periode terkunci, tidak bisa unpost" }, { status: 400 });
      }
    }

    // Unpost
    // @ts-ignore
    const updated = await prisma.jurnal.update({
      where: { id },
      data: {
        status: StatusJurnal.DRAFT,
        postedAt: null,
      },
      select: { id: true, nomor: true, status: true, postedAt: true },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
