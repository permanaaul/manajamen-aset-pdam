-- AlterTable
ALTER TABLE `aset` ADD COLUMN `akunAkumulasiPenyusutanId` INTEGER NULL,
    ADD COLUMN `akunAsetId` INTEGER NULL,
    ADD COLUMN `akunBebanPenyusutanId` INTEGER NULL;

-- AlterTable
ALTER TABLE `item` ADD COLUMN `akunBebanId` INTEGER NULL,
    ADD COLUMN `akunPersediaanId` INTEGER NULL;

-- AlterTable
ALTER TABLE `penyusutan` ADD COLUMN `jurnalId` INTEGER NULL;

-- AlterTable
ALTER TABLE `stoktransaksi` ADD COLUMN `jurnalId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Akun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `tipe` ENUM('ASET', 'KEWAJIBAN', 'EKUITAS', 'PENDAPATAN', 'BEBAN') NOT NULL,
    `pos` ENUM('DEBIT', 'KREDIT') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isPosting` BOOLEAN NOT NULL DEFAULT true,
    `parentId` INTEGER NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `urutan` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Akun_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PeriodeAkuntansi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tahun` INTEGER NOT NULL,
    `bulan` INTEGER NOT NULL,
    `mulai` DATETIME(3) NOT NULL,
    `akhir` DATETIME(3) NOT NULL,
    `status` ENUM('TERBUKA', 'TERTUTUP', 'TERKUNCI') NOT NULL DEFAULT 'TERBUKA',
    `lockedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,

    INDEX `PeriodeAkuntansi_status_idx`(`status`),
    UNIQUE INDEX `PeriodeAkuntansi_tahun_bulan_key`(`tahun`, `bulan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Jurnal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nomor` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `periodeId` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'POSTED', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `sumber` ENUM('MANUAL', 'GUDANG', 'ASET_PENYUSUTAN', 'PEMELIHARAAN', 'KAS_BANK', 'IMPORT') NOT NULL DEFAULT 'MANUAL',
    `memo` VARCHAR(191) NULL,
    `refTable` VARCHAR(191) NULL,
    `refId` INTEGER NULL,
    `refNo` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `postedById` INTEGER NULL,
    `postedAt` DATETIME(3) NULL,
    `voidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Jurnal_nomor_key`(`nomor`),
    INDEX `Jurnal_tanggal_idx`(`tanggal`),
    INDEX `Jurnal_status_tanggal_idx`(`status`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JurnalLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `headerId` INTEGER NOT NULL,
    `akunId` INTEGER NOT NULL,
    `uraian` VARCHAR(191) NULL,
    `debit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `kredit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `asetId` INTEGER NULL,
    `gudangId` INTEGER NULL,
    `itemId` INTEGER NULL,
    `pemeliharaanId` INTEGER NULL,
    `stokLineId` INTEGER NULL,

    INDEX `JurnalLine_headerId_idx`(`headerId`),
    INDEX `JurnalLine_akunId_idx`(`akunId`),
    INDEX `JurnalLine_asetId_idx`(`asetId`),
    INDEX `JurnalLine_gudangId_idx`(`gudangId`),
    INDEX `JurnalLine_itemId_idx`(`itemId`),
    INDEX `JurnalLine_pemeliharaanId_idx`(`pemeliharaanId`),
    INDEX `JurnalLine_stokLineId_idx`(`stokLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SaldoAkunBulanan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `akunId` INTEGER NOT NULL,
    `tahun` INTEGER NOT NULL,
    `bulan` INTEGER NOT NULL,
    `saldoAwal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `debit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `kredit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `saldoAkhir` DECIMAL(18, 2) NOT NULL DEFAULT 0,

    INDEX `SaldoAkunBulanan_tahun_bulan_idx`(`tahun`, `bulan`),
    UNIQUE INDEX `SaldoAkunBulanan_akunId_tahun_bulan_key`(`akunId`, `tahun`, `bulan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SaldoAwalAkun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `akunId` INTEGER NOT NULL,
    `tahun` INTEGER NOT NULL,
    `saldo` DECIMAL(18, 2) NOT NULL DEFAULT 0,

    UNIQUE INDEX `SaldoAwalAkun_akunId_tahun_key`(`akunId`, `tahun`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MappingAkunOtomatis` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kunci` VARCHAR(191) NOT NULL,
    `debitAkunId` INTEGER NULL,
    `kreditAkunId` INTEGER NULL,
    `keterangan` VARCHAR(191) NULL,

    UNIQUE INDEX `MappingAkunOtomatis_kunci_key`(`kunci`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Penyusutan_jurnalId_idx` ON `Penyusutan`(`jurnalId`);

-- CreateIndex
CREATE INDEX `StokTransaksi_jurnalId_idx` ON `StokTransaksi`(`jurnalId`);

-- AddForeignKey
ALTER TABLE `Aset` ADD CONSTRAINT `Aset_akunAsetId_fkey` FOREIGN KEY (`akunAsetId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Aset` ADD CONSTRAINT `Aset_akunAkumulasiPenyusutanId_fkey` FOREIGN KEY (`akunAkumulasiPenyusutanId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Aset` ADD CONSTRAINT `Aset_akunBebanPenyusutanId_fkey` FOREIGN KEY (`akunBebanPenyusutanId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Penyusutan` ADD CONSTRAINT `Penyusutan_jurnalId_fkey` FOREIGN KEY (`jurnalId`) REFERENCES `Jurnal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_akunPersediaanId_fkey` FOREIGN KEY (`akunPersediaanId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_akunBebanId_fkey` FOREIGN KEY (`akunBebanId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokTransaksi` ADD CONSTRAINT `StokTransaksi_jurnalId_fkey` FOREIGN KEY (`jurnalId`) REFERENCES `Jurnal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Akun` ADD CONSTRAINT `Akun_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jurnal` ADD CONSTRAINT `Jurnal_periodeId_fkey` FOREIGN KEY (`periodeId`) REFERENCES `PeriodeAkuntansi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jurnal` ADD CONSTRAINT `Jurnal_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jurnal` ADD CONSTRAINT `Jurnal_postedById_fkey` FOREIGN KEY (`postedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalLine` ADD CONSTRAINT `JurnalLine_headerId_fkey` FOREIGN KEY (`headerId`) REFERENCES `Jurnal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalLine` ADD CONSTRAINT `JurnalLine_akunId_fkey` FOREIGN KEY (`akunId`) REFERENCES `Akun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalLine` ADD CONSTRAINT `JurnalLine_asetId_fkey` FOREIGN KEY (`asetId`) REFERENCES `Aset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalLine` ADD CONSTRAINT `JurnalLine_gudangId_fkey` FOREIGN KEY (`gudangId`) REFERENCES `Gudang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalLine` ADD CONSTRAINT `JurnalLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalLine` ADD CONSTRAINT `JurnalLine_pemeliharaanId_fkey` FOREIGN KEY (`pemeliharaanId`) REFERENCES `Pemeliharaan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalLine` ADD CONSTRAINT `JurnalLine_stokLineId_fkey` FOREIGN KEY (`stokLineId`) REFERENCES `StokTransaksiLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaldoAkunBulanan` ADD CONSTRAINT `SaldoAkunBulanan_akunId_fkey` FOREIGN KEY (`akunId`) REFERENCES `Akun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaldoAwalAkun` ADD CONSTRAINT `SaldoAwalAkun_akunId_fkey` FOREIGN KEY (`akunId`) REFERENCES `Akun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MappingAkunOtomatis` ADD CONSTRAINT `MappingAkunOtomatis_debitAkunId_fkey` FOREIGN KEY (`debitAkunId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MappingAkunOtomatis` ADD CONSTRAINT `MappingAkunOtomatis_kreditAkunId_fkey` FOREIGN KEY (`kreditAkunId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
