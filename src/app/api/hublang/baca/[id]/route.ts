// app/api/hublang/baca/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { flagAnomali, hitungPakaiDenganRollover } from '@/lib/hublang/utils';
import type { Prisma } from '@prisma/client';

// Robust normalizer: terima "", null, "YYYY-MM-DDTHH:MM", "YYYY-MM-DDTHH:MM:SS", atau "dd/mm/yyyy hh:mm"
function parseTanggalInput(input: unknown): Date | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;

  // "dd/mm/yyyy hh:mm" -> "yyyy-mm-ddThh:mm"
  const mDmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mDmy) {
    const [, dd, mm, yyyy, HH, MM, SS] = mDmy;
    s = `${yyyy}-${mm}-${dd}T${HH}:${MM}${SS ? `:${SS}` : ''}`;
  } else {
    // ganti spasi jadi 'T' bila user memasukkan "YYYY-MM-DD HH:MM"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) s = s.replace(' ', 'T');
  }

  // Tambah detik jika hanya "YYYY-MM-DDTHH:MM"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) s = `${s}:00`;

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: 'id invalid' }, { status: 400 });

  const payload = await req.json();
  const angkaKini = Number(payload?.angkaKini);
  const catatan = payload?.catatan ?? null;

  if (!Number.isFinite(angkaKini) || angkaKini < 0) {
    return NextResponse.json({ error: 'angkaKini >= 0' }, { status: 400 });
  }

  // Normalisasi tanggalBaca -> Date | null
  const tanggalBaca: Date | null = parseTanggalInput(payload?.tanggalBaca);

  try {
    // Ambil bacaan + info meter (digitMaks)
    // @ts-ignore
    const baca = await prisma.hblBaca.findUnique({
      where: { id },
      include: {
        sambungan: {
          include: {
            meter: { where: { aktif: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!baca) {
      return NextResponse.json({ error: 'Bacaan tidak ditemukan' }, { status: 404 });
    }

    const digitMaks = baca.sambungan.meter[0]?.digitMaks ?? 6;

    // Kebijakan global
    // @ts-ignore
    const kebijakan = await prisma.hblKebijakan.findFirst({ where: { id: 1 } });
    const threshold = kebijakan?.anomaliThresholdPersen ?? 200;
    const minM3 = kebijakan?.anomaliMinM3 ?? 5;
    const rolloverDiizinkan = kebijakan?.rolloverDiizinkan ?? true;

    // Hitung pakai (handle rollover)
    const pakai = hitungPakaiDenganRollover(
      baca.angkaLalu,
      angkaKini,
      digitMaks,
      rolloverDiizinkan
    );

    // Rata-rata 3 bulan terakhir
    // @ts-ignore
    const last3 = (await prisma.hblBaca.findMany({
      where: {
        sambunganId: baca.sambunganId,
        OR: [
          { periodeTahun: baca.periodeTahun, periodeBulan: { lt: baca.periodeBulan } },
          { periodeTahun: { lt: baca.periodeTahun } },
        ],
      },
      orderBy: [{ periodeTahun: 'desc' }, { periodeBulan: 'desc' }],
      take: 3,
      select: { pakaiM3: true },
    })) as Array<Prisma.HblBacaGetPayload<{ select: { pakaiM3: true } }>>;

    const avg3 =
      last3.length > 0
        ? last3.reduce((s: number, x: { pakaiM3: number | null }) => s + (x.pakaiM3 ?? 0), 0) /
          last3.length
        : 0;

    const anomali = flagAnomali(pakai, avg3, threshold, minM3);

    // Update
    // @ts-ignore
    const updated = await prisma.hblBaca.update({
      where: { id },
      data: {
        angkaKini,
        pakaiM3: pakai,
        anomali,
        tanggalBaca, // sudah Date | null
        catatan,
        status: baca.status, // biarkan apa adanya; verifikasi lewat endpoint lain
      },
    });

    return NextResponse.json({
      id: updated.id,
      pakaiM3: updated.pakaiM3,
      anomali: updated.anomali,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
