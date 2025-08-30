import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  try {
    const body = await req.json();
    const data: any = {};
    ["ringkas", "detail", "kanal", "status"].forEach((k) => {
      if (k in body) data[k] = body[k] ?? null;
    });
    ["pelangganId", "sambunganId", "workOrderId"].forEach((k) => {
      if (k in body) data[k] = body[k] || null;
    });
    //@ts-ignore
    const updated = await prisma.hblKeluhan.update({
      where: { id },
      data,
      select: { id: true, status: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
