import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { StatusDokumen, StatusPeriode } from "@prisma/client";

async function getPeriodeStatus(d: Date) {
  const tahun = d.getFullYear();
  const bulan = d.getMonth() + 1;
  // @ts-ignore
  const p = await prisma.periodeAkuntansi.findUnique({
    where: { tahun_bulan: { tahun, bulan } },
    select: { id: true, status: true },
  });
  return p;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id || 0);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    // @ts-ignore
    const trx = await prisma.kasBankTransaksi.findUnique({
      where: { id },
      select: { id: true, tanggal: true, status: true, jurnalId: true },
    });
    if (!trx) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    if (trx.status !== StatusDokumen.POSTED || !trx.jurnalId) {
      return NextResponse.json({ error: "Hanya yang POSTED yang bisa di-unpost" }, { status: 400 });
    }

    const p = await getPeriodeStatus(new Date(trx.tanggal));
    if (!p || p.status !== StatusPeriode.TERBUKA) {
      return NextResponse.json({ error: "Periode akuntansi tidak terbuka" }, { status: 400 });
    }

    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      // hapus lines dulu untuk aman dari constraint
      await tx.jurnalLine.deleteMany({ where: { jurnalId: trx.jurnalId! } });
      await tx.jurnal.delete({ where: { id: trx.jurnalId! } });
      await tx.kasBankTransaksi.update({
        where: { id: trx.id },
        data: { status: StatusDokumen.DRAFT, jurnalId: null, postedAt: null },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
