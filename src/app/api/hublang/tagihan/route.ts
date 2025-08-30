// app/api/hublang/tagihan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parsePeriode } from '@/lib/hublang/utils';
import type { Prisma } from '@prisma/client';

// ---- Tambah: type hasil query dengan relasi yang kita include ----
type TagihanWithRel = Prisma.HblTagihanGetPayload<{
  include: {
    pelanggan: { select: { id: true; nama: true } };
    sambungan: { select: { id: true; noSambungan: true } };
  };
}>;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periode = searchParams.get('periode');
  const pelangganId = searchParams.get('pelangganId');
  const status = searchParams.get('status') as 'DRAFT' | 'FINAL' | 'POSTED' | null;
  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)));

  if (!periode) return NextResponse.json({ error: 'periode wajib' }, { status: 400 });
  const p = parsePeriode(periode);

  const where: any = {
    periodeTahun: p.tahun,
    periodeBulan: p.bulan,
    ...(pelangganId ? { pelangganId: Number(pelangganId) } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { pelanggan: { nama: { contains: q } } },
            { pelanggan: { kode: { contains: q } } },
            { sambungan: { noSambungan: { contains: q } } },
          ],
        }
      : {}),
  };

  try {
    const [total, data] = await Promise.all([
      // @ts-ignore
      prisma.hblTagihan.count({ where }),
      // @ts-ignore
      prisma.hblTagihan.findMany({
        where,
        orderBy: [{ id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          pelanggan: { select: { id: true, nama: true } },
          sambungan: { select: { id: true, noSambungan: true } },
        },
      }),
    ]);

    // ---- Perbaikan: beri tipe eksplisit di parameter map ----
    const mapped = (data as TagihanWithRel[]).map((t: TagihanWithRel) => ({
      id: t.id,
      noTagihan: t.noTagihan,
      periode: `${t.periodeTahun}-${String(t.periodeBulan).padStart(2, '0')}`,
      pelanggan: t.pelanggan,
      sambungan: t.sambungan,
      pakaiM3: t.pakaiM3,
      rincian: {
        air: t.jumlahAirRp,
        admin: t.biayaAdminRp,
        pajak: t.pajakRp,
        denda: t.dendaRp,
      },
      total: t.totalRp,
      status: t.status,
    }));

    return NextResponse.json({ data: mapped, paging: { page, pageSize, total } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
