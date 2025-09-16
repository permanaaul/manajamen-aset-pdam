// app/api/kasbank/transaksi/[id]/post/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  StatusDokumen,
  StatusJurnal,
  StatusPeriode,
  SumberJurnal,
  TipeKasBankTransaksi,
} from "@prisma/client";

/* helpers */
const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const pad2 = (n: number) => String(n).padStart(2, "0");

async function ensurePeriode(d: Date) {
  const tahun = d.getFullYear();
  const bulan = d.getMonth() + 1;
  const mulai = new Date(tahun, bulan - 1, 1, 0, 0, 0, 0);
  const akhir = new Date(tahun, bulan, 0, 23, 59, 59, 999);
  // @ts-ignore
  return prisma.periodeAkuntansi.upsert({
    where: { tahun_bulan: { tahun, bulan } },
    create: { tahun, bulan, mulai, akhir, status: StatusPeriode.TERBUKA },
    update: {},
    select: { id: true, status: true },
  });
}

async function nextJurnalNumber(d: Date) {
  const key = `JRN-${d.getFullYear()}${pad2(d.getMonth() + 1)}`;
  // @ts-ignore
  const row = await prisma.sequenceCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return `${key}-${String(row.value).padStart(4, "0")}`;
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
      select: {
        id: true, nomor: true, tanggal: true, tipe: true, status: true,
        akunId: true, asalId: true, tujuanId: true,
        lawanAkunId: true, amount: true, biaya: true, memo: true, referensi: true,
        jurnalId: true,
        akun: { select: { id: true, akunGLId: true, nama: true } },
        asal: { select: { id: true, akunGLId: true, nama: true } },
        tujuan: { select: { id: true, akunGLId: true, nama: true } },
        lawanAkun: { select: { id: true } },
      },
    });

    if (!trx) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    if (trx.status !== StatusDokumen.DRAFT) {
      return NextResponse.json({ error: "Hanya DRAFT yang bisa diposting" }, { status: 400 });
    }
    if (trx.jurnalId) {
      return NextResponse.json({ error: "Sudah terposting ke GL" }, { status: 409 });
    }

    const tgl = new Date(trx.tanggal);
    const periode = await ensurePeriode(tgl);
    if (periode.status !== StatusPeriode.TERBUKA) {
      return NextResponse.json({ error: "Periode akuntansi tidak terbuka" }, { status: 400 });
    }

    // tentukan skema jurnal lines
    type JL = { akunId: number; debit: number; kredit: number; uraian: string | null };
    const lines: JL[] = [];
    const amt = toNum(trx.amount);
    const biaya = toNum(trx.biaya);

    const memo = trx.memo || `${trx.tipe} ${trx.nomor}`;

    if (trx.tipe === TipeKasBankTransaksi.IN) {
      if (!trx.akun?.akunGLId || !trx.lawanAkunId) {
        return NextResponse.json({ error: "akun kas/bank & lawanAkun wajib (IN)" }, { status: 400 });
      }
      // Debit Kas/Bank, Kredit Lawan
      lines.push({ akunId: trx.akun.akunGLId, debit: amt, kredit: 0, uraian: memo });
      lines.push({ akunId: trx.lawanAkunId!, debit: 0, kredit: amt, uraian: memo });
    } else if (trx.tipe === TipeKasBankTransaksi.OUT) {
      if (!trx.akun?.akunGLId || !trx.lawanAkunId) {
        return NextResponse.json({ error: "akun kas/bank & lawanAkun wajib (OUT)" }, { status: 400 });
      }
      // Debit Lawan, Kredit Kas/Bank
      lines.push({ akunId: trx.lawanAkunId!, debit: amt, kredit: 0, uraian: memo });
      lines.push({ akunId: trx.akun.akunGLId, debit: 0, kredit: amt, uraian: memo });
    } else if (trx.tipe === TipeKasBankTransaksi.TRF) {
      if (!trx.asal?.akunGLId || !trx.tujuan?.akunGLId) {
        return NextResponse.json({ error: "asal & tujuan wajib (TRF)" }, { status: 400 });
      }
      // Debit Kas/Bank Tujuan, Kredit Kas/Bank Asal
      lines.push({ akunId: trx.tujuan.akunGLId, debit: amt, kredit: 0, uraian: memo });
      lines.push({ akunId: trx.asal.akunGLId, debit: 0, kredit: amt, uraian: memo });
    } else {
      return NextResponse.json({ error: "Tipe tidak dikenal" }, { status: 400 });
    }

    const nomor = await nextJurnalNumber(tgl);

    // @ts-ignore
    const created = await prisma.$transaction(async (tx) => {
      // buat jurnal
      const jurnal = await tx.jurnal.create({
        data: {
          nomor,
          tanggal: tgl,
          periodeId: periode.id,
          status: StatusJurnal.POSTED,
          postedAt: new Date(),
          sumber: SumberJurnal.KAS_BANK,
          memo,
          lines: { createMany: { data: lines } },
        },
        select: { id: true, nomor: true },
      });

      // update transaksi
      await tx.kasBankTransaksi.update({
        where: { id: trx.id },
        data: { status: StatusDokumen.POSTED, postedAt: new Date(), jurnalId: jurnal.id },
      });

      return jurnal;
    });

    return NextResponse.json({ ok: true, jurnal: created, lines: lines.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
