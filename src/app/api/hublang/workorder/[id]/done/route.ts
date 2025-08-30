import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Tandai selesai: status DONE + selesaiTanggal now (+ opsi hasil & biaya)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const body = await req.json().catch(() => ({}));
    const data: any = {
      status: "DONE",
      selesaiTanggal: new Date(),
    };
    if ("hasilPekerjaan" in body) data.hasilPekerjaan = body.hasilPekerjaan ?? null;
    if ("biayaMaterialRp" in body) data.biayaMaterialRp = body.biayaMaterialRp ?? null;
    if ("biayaJasaRp" in body) data.biayaJasaRp = body.biayaJasaRp ?? null;

    // @ts-ignore
    const updated = await prisma.hblWorkOrder.update({
      where: { id },
      data,
      select: { id: true, status: true, selesaiTanggal: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
