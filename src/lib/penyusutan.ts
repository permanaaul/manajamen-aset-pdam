// src/lib/penyusutan.ts
import prisma from "@/lib/prisma";
import {
  UMUR_DEFAULT,
  METODE_DEFAULT,
  TARIF_SALDO,
} from "@/app/constants/penyusutan";
import type { MetodePenyusutan, GolonganDepresiasi, KategoriAset } from "@prisma/client";

type Metode = Extract<MetodePenyusutan, "GARIS_LURUS" | "SALDO_MENURUN">;
type Golongan = keyof typeof TARIF_SALDO;

/**
 * Regenerasi jadwal penyusutan untuk satu aset.
 * Panggil ini setelah create/update aset.
 */
export async function regeneratePenyusutanForAset(asetId: number) {
    // @ts-ignore
  const aset = await prisma.aset.findUnique({ where: { id: asetId } });
  if (!aset) return;

  // TANAH tidak disusutkan => kosongkan jadwal kalau ada
  if (aset.kategori === "TANAH") {
    // @ts-ignore
    await prisma.penyusutan.deleteMany({ where: { asetId } });
    return;
  }

  const nilaiPerolehan = Number(aset.nilai);
  const nilaiResidu = aset.nilaiResidu ? Number(aset.nilaiResidu) : 0;

  const umurDefault = UMUR_DEFAULT[aset.kategori as KategoriAset] ?? 0;
  const umur = aset.umurManfaatTahun ?? umurDefault;

  const metodeDefault = METODE_DEFAULT[aset.kategori as KategoriAset];
  const metode: Metode =
    (aset.metodePenyusutan as Metode) ?? (metodeDefault ?? "GARIS_LURUS");

  if (!umur || umur <= 0 || nilaiPerolehan <= 0) {
    // @ts-ignore
    await prisma.penyusutan.deleteMany({ where: { asetId } });
    return;
  }

  const startYear =
    aset.mulaiPenyusutan
      ? new Date(aset.mulaiPenyusutan).getFullYear()
      : aset.tanggalOperasi
        ? new Date(aset.tanggalOperasi).getFullYear()
        : aset.tahun || new Date().getFullYear();

  const golongan = aset.golonganDepresiasi as GolonganDepresiasi | null;
  const tarifSaldo = golongan ? TARIF_SALDO[golongan as Golongan] : undefined;

  const rows = hitungJadwal({
    nilaiPerolehan,
    nilaiResidu,
    metode,
    umur,
    startYear,
    tarifSaldo,
  });

  await simpanJadwal(asetId, rows);
}

/** Hitung deret penyusutan tahunan */
function hitungJadwal(opts: {
  nilaiPerolehan: number;
  nilaiResidu: number;
  metode: Metode;
  umur: number;
  startYear: number;
  tarifSaldo?: number;
}) {
  const { nilaiPerolehan, nilaiResidu, metode, umur, startYear, tarifSaldo } = opts;

  type Row = {
    periode: Date;
    metode: Metode;
    tarif: number;
    nilaiAwal: number;
    beban: number;
    akumulasi: number;
    nilaiAkhir: number;
  };

  const rows: Row[] = [];

  let nilaiBuku = nilaiPerolehan;
  let akum = 0;

  for (let i = 0; i < umur; i++) {
    const tahun = startYear + i;
    const periode = new Date(Date.UTC(tahun, 0, 1));

    let tarif = 0;
    let beban = 0;

    if (metode === "GARIS_LURUS") {
      tarif = 1 / umur;
      const dasar = Math.max(0, nilaiPerolehan - nilaiResidu);
      beban = dasar / umur;
      if (nilaiBuku - beban < nilaiResidu) beban = Math.max(0, nilaiBuku - nilaiResidu);
    } else {
      tarif = typeof tarifSaldo === "number" ? tarifSaldo : 0.25; // fallback aman
      beban = nilaiBuku * tarif;
      if (nilaiBuku - beban < nilaiResidu) beban = Math.max(0, nilaiBuku - nilaiResidu);
    }

    const nilaiAwal = nilaiBuku;
    nilaiBuku = Math.max(nilaiResidu, nilaiBuku - beban);
    akum += beban;

    rows.push({
      periode,
      metode,
      tarif,
      nilaiAwal,
      beban,
      akumulasi: akum,
      nilaiAkhir: nilaiBuku,
    });

    if (Math.abs(nilaiBuku - nilaiResidu) < 1e-6) break; // stop saat sudah residu
  }

  return rows;
}

/** Simpan jadwal (hapus-insert supaya konsisten) */
async function simpanJadwal(asetId: number, rows: ReturnType<typeof hitungJadwal>) {
    // @ts-ignore
  await prisma.penyusutan.deleteMany({ where: { asetId } });
  if (rows.length === 0) return;
    // @ts-ignore
  await prisma.penyusutan.createMany({
    data: rows.map((r) => ({
      asetId,
      periode: r.periode,
      metode: r.metode,
      tarif: r.tarif,
      nilaiAwal: r.nilaiAwal,
      beban: r.beban,
      akumulasi: r.akumulasi,
      nilaiAkhir: r.nilaiAkhir,
    })),
    skipDuplicates: true,
  });
}
