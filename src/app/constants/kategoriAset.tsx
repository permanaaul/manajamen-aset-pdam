// src/constants/kategoriAset.ts
export const KATEGORI_ASET = [
    'KONSTRUKSI_SIPIL',
    'PIPA',
    'SUMUR_BOR',
    'POMPA',
    'KATUP',
    'MOTOR_LISTRIK',
    'KELISTRIKAN',
    'KONTROL',
    'BANGUNAN',
    'TANAH',
  ] as const;
  
  export type KategoriAset = typeof KATEGORI_ASET[number];
  