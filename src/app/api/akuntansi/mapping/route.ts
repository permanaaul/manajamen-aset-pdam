// app/api/akuntansi/mapping/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const KEYS = [
  "INVENTORY_RECEIPT_DR",
  "INVENTORY_RECEIPT_CR",
  "INVENTORY_ISSUE_DR",
  "INVENTORY_ISSUE_CR",
  "INVENTORY_ADJ_GAIN",
  "INVENTORY_ADJ_LOSS",
] as const;

type MapRowDB = {
  kunci: string;
  debitAkunId: number | null;
  kreditAkunId: number | null;
  debitAkun:  { id: number; kode: string; nama: string } | null;
  kreditAkun: { id: number; kode: string; nama: string } | null;
};

export async function GET() {
  try {
    //@ts-ignore
    await prisma.mappingAkunOtomatis.createMany({
      data: KEYS.map((k) => ({ kunci: k })),
      skipDuplicates: true,
    });
    //@ts-ignore
    const rows = (await prisma.mappingAkunOtomatis.findMany({
      orderBy: { kunci: "asc" },
      include: {
        debitAkun:  { select: { id: true, kode: true, nama: true } },
        kreditAkun: { select: { id: true, kode: true, nama: true } },
      },
    })) as MapRowDB[];

    const missing = rows
      .filter((r: MapRowDB) => !r.debitAkunId || !r.kreditAkunId)
      .map((r: MapRowDB) => r.kunci);

    return NextResponse.json({ rows, missing });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

type MappingPutItem = { kunci: string; debitAkunId?: number | null; kreditAkunId?: number | null };

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const items: MappingPutItem[] = Array.isArray(body) ? body : [body];

    for (const it of items) {
      const kunci = String(it.kunci);
      const debitAkunId  = it.debitAkunId  == null ? null : Number(it.debitAkunId);
      const kreditAkunId = it.kreditAkunId == null ? null : Number(it.kreditAkunId);
      //@ts-ignore
      await prisma.mappingAkunOtomatis.upsert({
        where: { kunci },
        update: { debitAkunId, kreditAkunId },
        create: { kunci, debitAkunId, kreditAkunId },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
