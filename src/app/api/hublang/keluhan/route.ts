//app/api/hublang/keluhan/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toInt = (v: any) => (v == null || v === "" ? undefined : Number(v));

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status") || undefined;
    const kanal = searchParams.get("kanal") || undefined;
    const pelangganId = toInt(searchParams.get("pelangganId"));
    const sambunganId = toInt(searchParams.get("sambunganId"));
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const size = Math.min(100, Math.max(5, Number(searchParams.get("size") || "20")));

    const where: any = {
      ...(status ? { status } : {}),
      ...(kanal ? { kanal } : {}),
      ...(pelangganId ? { pelangganId } : {}),
      ...(sambunganId ? { sambunganId } : {}),
      ...(q
        ? {
            OR: [
              { ringkas: { contains: q } },
              { detail: { contains: q } },
              { pelanggan: { nama: { contains: q } } },
              { sambungan: { noSambungan: { contains: q } } },
            ],
          }
        : {}),
    };

    const [count, rows] = await Promise.all([
        //@ts-ignore
      prisma.hblKeluhan.count({ where }),
      //@ts-ignore
      prisma.hblKeluhan.findMany({
        where,
        orderBy: [{ tanggal: "desc" }, { id: "desc" }],
        skip: (page - 1) * size,
        take: size,
        select: {
          id: true,
          tanggal: true,
          kanal: true,
          ringkas: true,
          status: true,
          pelanggan: { select: { id: true, nama: true } },
          sambungan: { select: { id: true, noSambungan: true } },
          workOrder: { select: { id: true, noWo: true, status: true } },
        },
      }),
    ]);

    return NextResponse.json({ count, rows, page, size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ringkas, detail, kanal = "WALKIN", pelangganId, sambunganId, workOrderId } = body || {};
    if (!ringkas || !String(ringkas).trim())
      return NextResponse.json({ error: "Ringkasan wajib diisi" }, { status: 400 });
    //@ts-ignore
    const created = await prisma.hblKeluhan.create({
      data: {
        ringkas,
        detail: detail || null,
        kanal,
        pelangganId: pelangganId || null,
        sambunganId: sambunganId || null,
        workOrderId: workOrderId || null,
      },
      select: { id: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
