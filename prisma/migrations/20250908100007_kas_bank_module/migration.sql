-- CreateTable
CREATE TABLE `KasBankAkun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `jenis` ENUM('KAS', 'BANK') NOT NULL,
    `bank` VARCHAR(191) NULL,
    `noRek` VARCHAR(191) NULL,
    `pemilik` VARCHAR(191) NULL,
    `akunGLId` INTEGER NOT NULL,
    `saldoAwal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KasBankAkun_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KasBankTransaksi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nomor` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipe` ENUM('IN', 'OUT', 'TRF') NOT NULL,
    `status` ENUM('DRAFT', 'POSTED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `akunId` INTEGER NULL,
    `asalId` INTEGER NULL,
    `tujuanId` INTEGER NULL,
    `lawanAkunId` INTEGER NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `biaya` DECIMAL(18, 2) NULL,
    `memo` VARCHAR(191) NULL,
    `referensi` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `postedAt` DATETIME(3) NULL,
    `jurnalId` INTEGER NULL,
    `clearedAt` DATETIME(3) NULL,
    `clearedAmount` DECIMAL(18, 2) NULL,
    `statementRef` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KasBankTransaksi_nomor_key`(`nomor`),
    INDEX `KasBankTransaksi_tanggal_idx`(`tanggal`),
    INDEX `KasBankTransaksi_tipe_status_idx`(`tipe`, `status`),
    INDEX `KasBankTransaksi_akunId_idx`(`akunId`),
    INDEX `KasBankTransaksi_asalId_idx`(`asalId`),
    INDEX `KasBankTransaksi_tujuanId_idx`(`tujuanId`),
    INDEX `KasBankTransaksi_jurnalId_idx`(`jurnalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KasBankSaldoBulanan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `akunId` INTEGER NOT NULL,
    `tahun` INTEGER NOT NULL,
    `bulan` INTEGER NOT NULL,
    `saldoAwal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `masuk` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `keluar` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `saldoAkhir` DECIMAL(18, 2) NOT NULL DEFAULT 0,

    INDEX `KasBankSaldoBulanan_tahun_bulan_idx`(`tahun`, `bulan`),
    UNIQUE INDEX `KasBankSaldoBulanan_akunId_tahun_bulan_key`(`akunId`, `tahun`, `bulan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KasBankAkun` ADD CONSTRAINT `KasBankAkun_akunGLId_fkey` FOREIGN KEY (`akunGLId`) REFERENCES `Akun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KasBankTransaksi` ADD CONSTRAINT `KasBankTransaksi_akunId_fkey` FOREIGN KEY (`akunId`) REFERENCES `KasBankAkun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KasBankTransaksi` ADD CONSTRAINT `KasBankTransaksi_asalId_fkey` FOREIGN KEY (`asalId`) REFERENCES `KasBankAkun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KasBankTransaksi` ADD CONSTRAINT `KasBankTransaksi_tujuanId_fkey` FOREIGN KEY (`tujuanId`) REFERENCES `KasBankAkun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KasBankTransaksi` ADD CONSTRAINT `KasBankTransaksi_lawanAkunId_fkey` FOREIGN KEY (`lawanAkunId`) REFERENCES `Akun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KasBankTransaksi` ADD CONSTRAINT `KasBankTransaksi_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KasBankTransaksi` ADD CONSTRAINT `KasBankTransaksi_jurnalId_fkey` FOREIGN KEY (`jurnalId`) REFERENCES `Jurnal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KasBankSaldoBulanan` ADD CONSTRAINT `KasBankSaldoBulanan_akunId_fkey` FOREIGN KEY (`akunId`) REFERENCES `KasBankAkun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
