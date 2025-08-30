// app/api/hublang/billing/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import  prisma  from '@/lib/prisma';
import { parsePeriode, denomRound, hitungAirRp, toDecimal } from '@/lib/hublang/utils';
import { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  const { periode } = await req.json();
  if (!periode) return NextResponse.json({ error: 'periode wajib (YYYY-MM)' }, { status: 400 });

  const p = parsePeriode(periode);

  try {
    // Ambil bacaan terverifikasi + informasi sambungan & tarif
    // @ts-ignore
    const bacaan = await prisma.hblBaca.findMany({
      where: { periodeTahun: p.tahun, periodeBulan: p.bulan, status: 'TERVERIFIKASI' },
      include: {
        sambungan: {
          include: {
            golonganTarif: { include: { blok: true } },
          },
        },
      },
    });

    if (!bacaan.length) {
      return NextResponse.json({ error: 'Tidak ada bacaan terverifikasi untuk periode ini' }, { status: 409 });
    }
    // @ts-ignore
    const kebijakan = await prisma.hblKebijakan.findFirst({ where: { id: 1 } });
    const defaultDenom = kebijakan?.pembulatanDenom ?? 1;

    let made = 0;

    for (const b of bacaan) {
      const g = b.sambungan.golonganTarif;
      if (!g) throw new Error(`Sambungan ${b.sambunganId} belum punya golongan tarif`);

      const air = hitungAirRp(
        b.pakaiM3,
        g.blok.map((bl: { 
          urutan: number; 
          dariM3: number | null; 
          sampaiM3: number | null; 
          tarifPerM3: Prisma.Decimal;
        }) => ({
          urutan: bl.urutan,
          dariM3: bl.dariM3 ?? null,
          sampaiM3: bl.sampaiM3 ?? null,
          tarifPerM3: new Prisma.Decimal(bl.tarifPerM3),
        })),
        g.minChargeM3 ?? null,
        g.minChargeRp ? new Prisma.Decimal(g.minChargeRp) : null
      );
      

      const admin = new Prisma.Decimal(g.biayaAdminRp ?? 0);
      const pajak = g.pajakAktif ? air.plus(admin).times(new Prisma.Decimal(g.pajakPersen ?? 0)).div(100) : new Prisma.Decimal(0);

      const denom = g.pembulatanDenom ?? defaultDenom;
      const totalRaw = air.plus(admin).plus(pajak);
      const totalRounded = new Prisma.Decimal(denomRound(Number(totalRaw), denom));
      const roundingDiff = totalRounded.minus(totalRaw);

      // Upsert Tagihan + Items
      // @ts-ignore
      await prisma.$transaction(async (tx) => {
        const pelangganId = await tx.hblSambungan.findUnique({ where: { id: b.sambunganId }, select: { pelangganId: true } });

        // HblTagihan.unique([sambunganId, tahun, bulan]) → pakai upsert via composite unique
        const tagihan = await tx.hblTagihan.upsert({
          where: {
            sambunganId_periodeTahun_periodeBulan: {
              sambunganId: b.sambunganId,
              periodeTahun: b.periodeTahun,
              periodeBulan: b.periodeBulan,
            },
          },
          update: {
            pelangganId: pelangganId?.pelangganId!,
            pakaiM3: b.pakaiM3,
            jumlahAirRp: air,
            biayaAdminRp: admin,
            pajakRp: pajak,
            dendaRp: toDecimal(0),
            totalRp: totalRounded,
            status: 'FINAL',
            tanggalFinal: new Date(),
          },
          create: {
            noTagihan: `BILL/${b.periodeTahun}/${String(b.periodeBulan).padStart(2, '0')}/${b.sambunganId}`,
            pelangganId: pelangganId?.pelangganId!,
            sambunganId: b.sambunganId,
            periodeTahun: b.periodeTahun,
            periodeBulan: b.periodeBulan,
            pakaiM3: b.pakaiM3,
            jumlahAirRp: air,
            biayaAdminRp: admin,
            pajakRp: pajak,
            dendaRp: toDecimal(0),
            totalRp: totalRounded,
            status: 'FINAL',
            tanggalFinal: new Date(),
          },
        });

        // Reset items lama → tulis ulang
        await tx.hblTagihanItem.deleteMany({ where: { tagihanId: tagihan.id } });

        await tx.hblTagihanItem.createMany({
          data: [
            { tagihanId: tagihan.id, jenisItem: 'WATER', jumlahRp: air },
            ...(admin.gt(0) ? [{ tagihanId: tagihan.id, jenisItem: 'ADMIN', jumlahRp: admin }] : []),
            ...(pajak.gt(0) ? [{ tagihanId: tagihan.id, jenisItem: 'TAX', jumlahRp: pajak }] : []),
            ...(roundingDiff.abs().gt(0)
              ? [{ tagihanId: tagihan.id, jenisItem: 'OTHER', jumlahRp: roundingDiff, catatan: 'Pembulatan' }]
              : []),
          ],
        });
      });

      made++;
    }

    return NextResponse.json({ generated: made }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
