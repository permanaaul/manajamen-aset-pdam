/*
  Warnings:

  - You are about to drop the column `biayaJasa` on the `pemeliharaan` table. All the data in the column will be lost.
  - You are about to drop the column `biayaMaterial` on the `pemeliharaan` table. All the data in the column will be lost.
  - You are about to drop the column `sukuCadang` on the `pemeliharaan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `pemeliharaan` DROP COLUMN `biayaJasa`,
    DROP COLUMN `biayaMaterial`,
    DROP COLUMN `sukuCadang`;

-- CreateTable
CREATE TABLE `PemeliharaanItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pemeliharaanId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `qty` DECIMAL(18, 3) NOT NULL,
    `hargaRp` DECIMAL(18, 2) NULL,
    `stokLineId` INTEGER NULL,

    INDEX `PemeliharaanItem_pemeliharaanId_idx`(`pemeliharaanId`),
    INDEX `PemeliharaanItem_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Gudang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `lokasi` VARCHAR(191) NULL,
    `tipe` VARCHAR(191) NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Gudang_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `jenis` ENUM('SPAREPART', 'MATERIAL', 'BHP', 'JASA', 'LAINNYA') NOT NULL DEFAULT 'SPAREPART',
    `satuan` ENUM('PCS', 'UNIT', 'SET', 'METER', 'LITER', 'KILOGRAM', 'BOX', 'ROLL') NOT NULL DEFAULT 'PCS',
    `minQty` DECIMAL(15, 3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Item_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StokSaldo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `gudangId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `qty` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `reservedQty` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `lastMoveAt` DATETIME(3) NULL,

    INDEX `StokSaldo_itemId_idx`(`itemId`),
    INDEX `StokSaldo_gudangId_idx`(`gudangId`),
    UNIQUE INDEX `StokSaldo_gudangId_itemId_key`(`gudangId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StokTransaksi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nomor` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipe` ENUM('RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'RETURN') NOT NULL,
    `status` ENUM('DRAFT', 'POSTED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `gudangAsalId` INTEGER NULL,
    `gudangTujuanId` INTEGER NULL,
    `referensi` VARCHAR(191) NULL,
    `catatan` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `postedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StokTransaksi_nomor_key`(`nomor`),
    INDEX `StokTransaksi_tanggal_idx`(`tanggal`),
    INDEX `StokTransaksi_tipe_status_idx`(`tipe`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StokTransaksiLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `headerId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `qty` DECIMAL(18, 3) NOT NULL,
    `hargaRp` DECIMAL(18, 2) NULL,
    `asetId` INTEGER NULL,
    `pemeliharaanId` INTEGER NULL,
    `catatan` VARCHAR(191) NULL,

    INDEX `StokTransaksiLine_headerId_idx`(`headerId`),
    INDEX `StokTransaksiLine_itemId_idx`(`itemId`),
    INDEX `StokTransaksiLine_pemeliharaanId_idx`(`pemeliharaanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SequenceCounter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `SequenceCounter_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PemeliharaanItem` ADD CONSTRAINT `PemeliharaanItem_pemeliharaanId_fkey` FOREIGN KEY (`pemeliharaanId`) REFERENCES `Pemeliharaan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PemeliharaanItem` ADD CONSTRAINT `PemeliharaanItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PemeliharaanItem` ADD CONSTRAINT `PemeliharaanItem_stokLineId_fkey` FOREIGN KEY (`stokLineId`) REFERENCES `StokTransaksiLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokSaldo` ADD CONSTRAINT `StokSaldo_gudangId_fkey` FOREIGN KEY (`gudangId`) REFERENCES `Gudang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokSaldo` ADD CONSTRAINT `StokSaldo_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokTransaksi` ADD CONSTRAINT `StokTransaksi_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokTransaksi` ADD CONSTRAINT `StokTransaksi_gudangAsalId_fkey` FOREIGN KEY (`gudangAsalId`) REFERENCES `Gudang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokTransaksi` ADD CONSTRAINT `StokTransaksi_gudangTujuanId_fkey` FOREIGN KEY (`gudangTujuanId`) REFERENCES `Gudang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokTransaksiLine` ADD CONSTRAINT `StokTransaksiLine_headerId_fkey` FOREIGN KEY (`headerId`) REFERENCES `StokTransaksi`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokTransaksiLine` ADD CONSTRAINT `StokTransaksiLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokTransaksiLine` ADD CONSTRAINT `StokTransaksiLine_asetId_fkey` FOREIGN KEY (`asetId`) REFERENCES `Aset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokTransaksiLine` ADD CONSTRAINT `StokTransaksiLine_pemeliharaanId_fkey` FOREIGN KEY (`pemeliharaanId`) REFERENCES `Pemeliharaan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
