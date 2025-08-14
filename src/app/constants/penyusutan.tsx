// src/app/constants/penyusutan.ts
import {
    KategoriAset,
    GolonganDepresiasi,
    MetodePenyusutan,
  } from "@prisma/client";
  
  // Umur manfaat default per kategori (tahun)
  // Nilai mengacu ke pedoman di dokumen PDAM yang kamu kirim.
  export const UMUR_DEFAULT: Record<KategoriAset, number> = {
    KONSTRUKSI_SIPIL: 75,
    PIPA: 60,
    SUMUR_BOR: 30,
    POMPA: 40,
    KATUP: 30,
    MOTOR_LISTRIK: 35,
    KELISTRIKAN: 35,
    KONTROL: 25,
    BANGUNAN: 60,
    TANAH: 300, // tidak akan dipakai karena TANAH tidak disusutkan (di-handle di code)
  };
  
  // Metode default per kategori
  export const METODE_DEFAULT: Record<
    KategoriAset,
    MetodePenyusutan | null
  > = {
    KONSTRUKSI_SIPIL: "GARIS_LURUS",
    PIPA: "GARIS_LURUS",
    SUMUR_BOR: "GARIS_LURUS",
    POMPA: "GARIS_LURUS",
    KATUP: "GARIS_LURUS",
    MOTOR_LISTRIK: "SALDO_MENURUN",
    KELISTRIKAN: "SALDO_MENURUN",
    KONTROL: "SALDO_MENURUN",
    BANGUNAN: "GARIS_LURUS",
    TANAH: null, // tidak disusutkan
  };
  
  // Tarif efektif untuk SALDO MENURUN
  export const TARIF_SALDO: Record<GolonganDepresiasi, number> = {
    GOL_I: 0.5, // 50%
    GOL_II: 0.25, // 25%
    GOL_III: 0.125, // 12.5%
    GOL_IV: 0.1, // 10%
    BANGUNAN_PERMANEN: 0.05, // 5%
    BANGUNAN_NON_PERMANEN: 0.1, // 10%
  };
  