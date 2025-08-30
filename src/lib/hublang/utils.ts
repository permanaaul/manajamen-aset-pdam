// lib/hublang/utils.ts
import { Prisma } from '@prisma/client';

export type Periode = { tahun: number; bulan: number };

export function parsePeriode(str: string): Periode {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(str);
  if (!m) throw new Error('Periode harus format YYYY-MM');
  return { tahun: Number(m[1]), bulan: Number(m[2]) };
}

export function prevPeriode({ tahun, bulan }: Periode): Periode {
  if (bulan === 1) return { tahun: tahun - 1, bulan: 12 };
  return { tahun, bulan: bulan - 1 };
}

export function denomRound(n: number, denom: number): number {
  if (!denom || denom <= 1) return Math.round(n);
  return Math.round(n / denom) * denom;
}

export function toDecimal(n: number | string): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

/**
 * Hitung biaya air berbasis blok.
 * - Jika minChargeM3 terisi → hitung dengan m3 = max(pakai, minChargeM3)
 * - Jika minChargeRp terisi → hasil Rp minimal minChargeRp
 * - Jika dua-duanya null → pakai m3 sebenarnya
 */
export function hitungAirRp(
  pakaiM3: number,
  blok: { urutan: number; dariM3: number | null; sampaiM3: number | null; tarifPerM3: Prisma.Decimal }[],
  minChargeM3: number | null,
  minChargeRp: Prisma.Decimal | null
): Prisma.Decimal {
  const m3 = Math.max(pakaiM3, minChargeM3 ?? 0);
  let sisa = m3;
  let total = new Prisma.Decimal(0);

  // Sort blok by urutan
  const blocks = [...blok].sort((a, b) => a.urutan - b.urutan);

  for (const b of blocks) {
    if (sisa <= 0) break;
    const lower = b.dariM3 ?? 0;
    const upper = b.sampaiM3 ?? Number.POSITIVE_INFINITY;
    const span = Math.max(0, Math.min(sisa, upper - lower + (isFinite(upper) ? 1 : 0)));
    if (span > 0) {
      total = total.plus(new Prisma.Decimal(span).times(b.tarifPerM3));
      sisa -= span;
    }
  }

  if (minChargeRp && total.lessThan(minChargeRp)) {
    total = new Prisma.Decimal(minChargeRp);
  }
  if (total.lessThan(0)) total = new Prisma.Decimal(0);
  return total;
}

/** Pajak = persen * (air + admin). */
export function hitungPajakRp(
  airRp: Prisma.Decimal,
  adminRp: Prisma.Decimal,
  pajakAktif?: boolean | null,
  pajakPersen?: Prisma.Decimal | null
): Prisma.Decimal {
  if (!pajakAktif || !pajakPersen) return new Prisma.Decimal(0);
  const base = airRp.plus(adminRp);
  return base.times(pajakPersen).div(100);
}

/** Hitung pakaiM3 dengan rollover digitMaks (contoh: 6 digit → 999999 roll ke 000000). */
export function hitungPakaiDenganRollover(
  angkaLalu: number,
  angkaKini: number,
  digitMaks: number,
  rolloverDiizinkan: boolean
): number {
  if (angkaKini >= angkaLalu) return angkaKini - angkaLalu;
  if (!rolloverDiizinkan) return Math.max(0, angkaKini - angkaLalu);
  const max = Math.pow(10, digitMaks) - 1; // contoh 999999
  return (max - angkaLalu) + angkaKini + 1;
}

/** Deteksi anomali: pakai > max(AnomaliMinM3, avg3 * (threshold%)) */
export function flagAnomali(pakai: number, avg3: number, thresholdPersen: number, minM3: number): boolean {
  if (pakai < Math.max(1, minM3)) return false;
  if (avg3 <= 0) return false;
  const batas = avg3 * (thresholdPersen / 100);
  return pakai > batas;
}
