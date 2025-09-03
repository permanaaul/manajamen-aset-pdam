import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** PATCH /api/gudang/satuan/:id
 * body: { nama?, simbol? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const data: any = {};
    if (body?.nama != null)   data.nama   = String(body.nama).trim();
    if (body?.simbol != null) data.simbol = String(body.simbol).trim() || null;
    //@ts-ignore
    const updated = await prisma.itemSatuan.update({
      where: { id },
      data,
      select: { id: true, nama: true, simbol: true },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Nama satuan sudah dipakai" }, { status: 409 });
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Satuan tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/** DELETE /api/gudang/satuan/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

    // Cek dipakai di Item?
    //@ts-ignore
    const dipakai = await prisma.item.count({ where: { satuanId: id } });
    if (dipakai > 0) {
      return NextResponse.json(
        { error: "Tidak bisa dihapus. Satuan sedang dipakai di master item." },
        { status: 409 }
      );
    }
    //@ts-ignore
    await prisma.itemSatuan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Satuan tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
