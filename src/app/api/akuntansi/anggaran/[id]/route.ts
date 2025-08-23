// app/api/akuntansi/anggaran/[id]/route.ts
import { NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const id = Number(params.id);
  // @ts-ignore
  const row = await prisma.anggaranBiaya.findUnique({
    where: { id },
    include: { kategori: true, unit: true },
  });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: Params) {
  assertRole(req, ["ADMIN", "PIMPINAN"]);
  const id = Number(params.id);
  const body = await req.json();
    // @ts-ignore
  const row = await prisma.anggaranBiaya.update({
    where: { id },
    data: {
      tahun: body.tahun != null ? Number(body.tahun) : undefined,
      kategoriId: body.kategoriId != null ? Number(body.kategoriId) : undefined,
      unitBiayaId: body.unitBiayaId != null ? Number(body.unitBiayaId) : undefined,
      jumlahTahunan: body.jumlahTahunan != null ? String(body.jumlahTahunan) : undefined,
      jan: body.jan != null ? String(body.jan) : undefined,
      feb: body.feb != null ? String(body.feb) : undefined,
      mar: body.mar != null ? String(body.mar) : undefined,
      apr: body.apr != null ? String(body.apr) : undefined,
      mei: body.mei != null ? String(body.mei) : undefined,
      jun: body.jun != null ? String(body.jun) : undefined,
      jul: body.jul != null ? String(body.jul) : undefined,
      agu: body.agu != null ? String(body.agu) : undefined,
      sep: body.sep != null ? String(body.sep) : undefined,
      okt: body.okt != null ? String(body.okt) : undefined,
      nov: body.nov != null ? String(body.nov) : undefined,
      des: body.des != null ? String(body.des) : undefined,
    },
  });

  return NextResponse.json(row);
}

export async function DELETE(req: Request, { params }: Params) {
  assertRole(req, ["ADMIN"]);
  const id = Number(params.id);
  // @ts-ignore
  await prisma.anggaranBiaya.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
