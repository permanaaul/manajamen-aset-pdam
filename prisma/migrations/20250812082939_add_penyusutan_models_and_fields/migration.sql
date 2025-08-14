-- AlterTable
ALTER TABLE `aset` ADD COLUMN `golonganDepresiasi` ENUM('GOL_I', 'GOL_II', 'GOL_III', 'GOL_IV', 'BANGUNAN_PERMANEN', 'BANGUNAN_NON_PERMANEN') NULL,
    ADD COLUMN `metodePenyusutan` ENUM('GARIS_LURUS', 'SALDO_MENURUN') NULL,
    ADD COLUMN `mulaiPenyusutan` DATETIME(3) NULL,
    ADD COLUMN `nilaiResidu` DECIMAL(15, 2) NULL,
    ADD COLUMN `tanggalOperasi` DATETIME(3) NULL,
    ADD COLUMN `umurManfaatTahun` INTEGER NULL;

-- CreateTable
CREATE TABLE `Penyusutan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asetId` INTEGER NOT NULL,
    `periode` DATETIME(3) NOT NULL,
    `metode` ENUM('GARIS_LURUS', 'SALDO_MENURUN') NOT NULL,
    `tarif` DECIMAL(6, 3) NOT NULL,
    `nilaiAwal` DECIMAL(15, 2) NOT NULL,
    `beban` DECIMAL(15, 2) NOT NULL,
    `akumulasi` DECIMAL(15, 2) NOT NULL,
    `nilaiAkhir` DECIMAL(15, 2) NOT NULL,
    `dibuatPada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Penyusutan_periode_idx`(`periode`),
    UNIQUE INDEX `Penyusutan_asetId_periode_key`(`asetId`, `periode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Penyusutan` ADD CONSTRAINT `Penyusutan_asetId_fkey` FOREIGN KEY (`asetId`) REFERENCES `Aset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
