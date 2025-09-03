// app/api/gudang/items/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id) || 0;
    if (!id) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

    const body = await req.json();
    const {
      kode, nama, jenis, satuanId, minQty, isActive,
    } = body ?? {};

    let unitId: number | null | undefined = undefined;
    if (satuanId !== undefined) {
      if (satuanId === null || satuanId === "") {
        unitId = null;
      } else {
        const idNum = Number(satuanId) || 0;
        if (!idNum) return NextResponse.json({ error: "Satuan tidak valid" }, { status: 400 });
        // @ts-ignore
        const ok = await prisma.itemSatuan.findUnique({ where: { id: idNum }, select: { id: true } });
        if (!ok) return NextResponse.json({ error: "Satuan tidak ditemukan" }, { status: 400 });
        unitId = idNum;
      }
    }

    // @ts-ignore
    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...(kode !== undefined ? { kode } : {}),
        ...(nama !== undefined ? { nama } : {}),
        ...(jenis !== undefined ? { jenis: String(jenis).toUpperCase() } : {}),
        ...(unitId !== undefined ? { satuanId: unitId } : {}),
        ...(minQty !== undefined ? { minQty: Number(minQty) || 0 } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
      select: { id: true },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id) || 0;
    if (!id) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

    // @ts-ignore
    await prisma.item.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
