import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id || 0);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    // @ts-ignore
    const r = await prisma.kasBankTransaksi.findUnique({
      where: { id },
      select: {
        id: true,
        nomor: true,
        tanggal: true,
        tipe: true,
        status: true,
        akunId: true,
        asalId: true,
        tujuanId: true,
        lawanAkunId: true,
        amount: true,
        biaya: true,
        memo: true,
        referensi: true,
        jurnalId: true,
        akun: { select: { id: true, kode: true, nama: true, akunGLId: true } },
        asal: { select: { id: true, kode: true, nama: true, akunGLId: true } },
        tujuan: { select: { id: true, kode: true, nama: true, akunGLId: true } },
        lawanAkun: { select: { id: true, kode: true, nama: true } },
        jurnal: { select: { id: true, nomor: true } },
      },
    });

    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      row: {
        ...r,
        tanggal: r.tanggal.toISOString(),
        amount: toNum(r.amount),
        biaya: r.biaya == null ? null : toNum(r.biaya),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
