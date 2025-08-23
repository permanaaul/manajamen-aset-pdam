-- AlterTable
ALTER TABLE `aset` ADD COLUMN `akunAkumulasiId` INTEGER NULL,
    ADD COLUMN `akunAsetId` INTEGER NULL;

-- AlterTable
ALTER TABLE `biayakategori` ADD COLUMN `debitAkunId` INTEGER NULL,
    ADD COLUMN `kreditAkunId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Akun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `tipe` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'CONTRA_ASSET', 'CONTRA_REVENUE') NOT NULL,
    `normal` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `parentId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Akun_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JurnalUmum` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tanggal` DATETIME(3) NOT NULL,
    `ref` VARCHAR(191) NULL,
    `uraian` VARCHAR(191) NULL,
    `sumber` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JurnalUmum_tanggal_idx`(`tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JurnalUmumLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `headerId` INTEGER NOT NULL,
    `akunId` INTEGER NOT NULL,
    `unitBiayaId` INTEGER NULL,
    `asetId` INTEGER NULL,
    `jurnalBiayaId` INTEGER NULL,
    `penyusutanId` INTEGER NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `kredit` DECIMAL(15, 2) NOT NULL DEFAULT 0,

    INDEX `JurnalUmumLine_headerId_idx`(`headerId`),
    INDEX `JurnalUmumLine_akunId_idx`(`akunId`),
    INDEX `JurnalUmumLine_unitBiayaId_idx`(`unitBiayaId`),
    INDEX `JurnalUmumLine_asetId_idx`(`asetId`),
    INDEX `JurnalUmumLine_jurnalBiayaId_idx`(`jurnalBiayaId`),
    INDEX `JurnalUmumLine_penyusutanId_idx`(`penyusutanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Aset` ADD CONSTRAINT `Aset_akunAsetId_fkey` FOREIGN KEY (`akunAsetId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Aset` ADD CONSTRAINT `Aset_akunAkumulasiId_fkey` FOREIGN KEY (`akunAkumulasiId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BiayaKategori` ADD CONSTRAINT `BiayaKategori_debitAkunId_fkey` FOREIGN KEY (`debitAkunId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BiayaKategori` ADD CONSTRAINT `BiayaKategori_kreditAkunId_fkey` FOREIGN KEY (`kreditAkunId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Akun` ADD CONSTRAINT `Akun_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalUmum` ADD CONSTRAINT `JurnalUmum_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalUmumLine` ADD CONSTRAINT `JurnalUmumLine_headerId_fkey` FOREIGN KEY (`headerId`) REFERENCES `JurnalUmum`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalUmumLine` ADD CONSTRAINT `JurnalUmumLine_akunId_fkey` FOREIGN KEY (`akunId`) REFERENCES `Akun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalUmumLine` ADD CONSTRAINT `JurnalUmumLine_unitBiayaId_fkey` FOREIGN KEY (`unitBiayaId`) REFERENCES `UnitBiaya`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalUmumLine` ADD CONSTRAINT `JurnalUmumLine_asetId_fkey` FOREIGN KEY (`asetId`) REFERENCES `Aset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalUmumLine` ADD CONSTRAINT `JurnalUmumLine_jurnalBiayaId_fkey` FOREIGN KEY (`jurnalBiayaId`) REFERENCES `JurnalBiaya`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalUmumLine` ADD CONSTRAINT `JurnalUmumLine_penyusutanId_fkey` FOREIGN KEY (`penyusutanId`) REFERENCES `Penyusutan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
