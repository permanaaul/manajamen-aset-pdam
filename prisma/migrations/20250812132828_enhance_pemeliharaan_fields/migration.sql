-- AlterTable
ALTER TABLE `pemeliharaan` ADD COLUMN `biayaJasa` DECIMAL(15, 2) NULL,
    ADD COLUMN `biayaMaterial` DECIMAL(15, 2) NULL,
    ADD COLUMN `downtimeJam` DECIMAL(10, 2) NULL,
    ADD COLUMN `jenisPekerjaan` ENUM('INSPEKSI', 'PELUMASAN', 'KALIBRASI', 'GANTI_SPAREPART', 'PERBAIKAN_RINGAN', 'PERBAIKAN_BESAR', 'OVERHAUL', 'TESTING') NULL,
    ADD COLUMN `strategi` ENUM('PREVENTIF', 'KOREKTIF', 'PREDIKTIF') NULL,
    ADD COLUMN `sukuCadang` JSON NULL;

-- CreateIndex
CREATE INDEX `Pemeliharaan_asetId_tanggal_idx` ON `Pemeliharaan`(`asetId`, `tanggal`);
