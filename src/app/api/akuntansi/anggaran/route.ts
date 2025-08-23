// app/api/akuntansi/anggaran/route.ts
import { NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { toDate } from "@/lib/num";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tahun = searchParams.get("tahun");
  const kategoriId = searchParams.get("kategoriId");
  const unitId = searchParams.get("unitId");
    // @ts-ignore
  const rows = await prisma.anggaranBiaya.findMany({
    where: {
      tahun: tahun ? Number(tahun) : undefined,
      kategoriId: kategoriId ? Number(kategoriId) : undefined,
      unitBiayaId: unitId ? Number(unitId) : undefined,
    },
    include: { kategori: true, unit: true },
    orderBy: [{ tahun: "desc" }, { kategoriId: "asc" }],
  });

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  assertRole(req, ["ADMIN", "PIMPINAN"]);
  const body = await req.json();
  // bisa terima {tahun, kategoriId, unitBiayaId, jumlahTahunan, jan,feb,...}
  // @ts-ignore
  const row = await prisma.anggaranBiaya.create({
    data: {
      tahun: Number(body.tahun),
      kategoriId: Number(body.kategoriId),
      unitBiayaId: body.unitBiayaId ? Number(body.unitBiayaId) : null,
      jumlahTahunan: body.jumlahTahunan != null ? String(body.jumlahTahunan) : "0",
      jan: body.jan != null ? String(body.jan) : "0",
      feb: body.feb != null ? String(body.feb) : "0",
      mar: body.mar != null ? String(body.mar) : "0",
      apr: body.apr != null ? String(body.apr) : "0",
      mei: body.mei != null ? String(body.mei) : "0",
      jun: body.jun != null ? String(body.jun) : "0",
      jul: body.jul != null ? String(body.jul) : "0",
      agu: body.agu != null ? String(body.agu) : "0",
      sep: body.sep != null ? String(body.sep) : "0",
      okt: body.okt != null ? String(body.okt) : "0",
      nov: body.nov != null ? String(body.nov) : "0",
      des: body.des != null ? String(body.des) : "0",
    },
  });
  return NextResponse.json(row, { status: 201 });
}
