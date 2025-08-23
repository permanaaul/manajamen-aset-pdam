-- CreateTable
CREATE TABLE `UnitBiaya` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `jenis` ENUM('PRODUKSI', 'DISTRIBUSI', 'PELAYANAN', 'ADMINISTRASI', 'UMUM_SDM', 'LABORATORIUM', 'LAINNYA') NOT NULL DEFAULT 'LAINNYA',
    `parentId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UnitBiaya_kode_key`(`kode`),
    INDEX `UnitBiaya_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BiayaKategori` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BiayaKategori_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JurnalBiaya` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tanggal` DATETIME(3) NOT NULL,
    `kategoriId` INTEGER NOT NULL,
    `tipe` ENUM('OPEX', 'CAPEX') NOT NULL DEFAULT 'OPEX',
    `uraian` VARCHAR(191) NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `kredit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `asetId` INTEGER NULL,
    `pemeliharaanId` INTEGER NULL,
    `penyusutanId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JurnalBiaya_tanggal_idx`(`tanggal`),
    INDEX `JurnalBiaya_kategoriId_idx`(`kategoriId`),
    INDEX `JurnalBiaya_asetId_idx`(`asetId`),
    INDEX `JurnalBiaya_pemeliharaanId_idx`(`pemeliharaanId`),
    INDEX `JurnalBiaya_penyusutanId_idx`(`penyusutanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JurnalBiayaAlokasi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jurnalId` INTEGER NOT NULL,
    `unitBiayaId` INTEGER NULL,
    `asetId` INTEGER NULL,
    `persen` DECIMAL(5, 2) NULL,
    `jumlah` DECIMAL(15, 2) NULL,

    INDEX `JurnalBiayaAlokasi_jurnalId_idx`(`jurnalId`),
    INDEX `JurnalBiayaAlokasi_unitBiayaId_idx`(`unitBiayaId`),
    INDEX `JurnalBiayaAlokasi_asetId_idx`(`asetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnggaranBiaya` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tahun` INTEGER NOT NULL,
    `bulan` INTEGER NOT NULL DEFAULT 0,
    `kategoriId` INTEGER NOT NULL,
    `tipe` ENUM('OPEX', 'CAPEX') NOT NULL DEFAULT 'OPEX',
    `unitBiayaId` INTEGER NULL,
    `asetId` INTEGER NULL,
    `jumlah` DECIMAL(15, 2) NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnggaranBiaya_tahun_bulan_idx`(`tahun`, `bulan`),
    INDEX `AnggaranBiaya_kategoriId_idx`(`kategoriId`),
    INDEX `AnggaranBiaya_unitBiayaId_idx`(`unitBiayaId`),
    INDEX `AnggaranBiaya_asetId_idx`(`asetId`),
    UNIQUE INDEX `AnggaranBiaya_tahun_bulan_kategoriId_unitBiayaId_asetId_key`(`tahun`, `bulan`, `kategoriId`, `unitBiayaId`, `asetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UnitBiaya` ADD CONSTRAINT `UnitBiaya_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `UnitBiaya`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalBiaya` ADD CONSTRAINT `JurnalBiaya_kategoriId_fkey` FOREIGN KEY (`kategoriId`) REFERENCES `BiayaKategori`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalBiaya` ADD CONSTRAINT `JurnalBiaya_asetId_fkey` FOREIGN KEY (`asetId`) REFERENCES `Aset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalBiaya` ADD CONSTRAINT `JurnalBiaya_pemeliharaanId_fkey` FOREIGN KEY (`pemeliharaanId`) REFERENCES `Pemeliharaan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalBiaya` ADD CONSTRAINT `JurnalBiaya_penyusutanId_fkey` FOREIGN KEY (`penyusutanId`) REFERENCES `Penyusutan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalBiaya` ADD CONSTRAINT `JurnalBiaya_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalBiayaAlokasi` ADD CONSTRAINT `JurnalBiayaAlokasi_jurnalId_fkey` FOREIGN KEY (`jurnalId`) REFERENCES `JurnalBiaya`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalBiayaAlokasi` ADD CONSTRAINT `JurnalBiayaAlokasi_unitBiayaId_fkey` FOREIGN KEY (`unitBiayaId`) REFERENCES `UnitBiaya`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JurnalBiayaAlokasi` ADD CONSTRAINT `JurnalBiayaAlokasi_asetId_fkey` FOREIGN KEY (`asetId`) REFERENCES `Aset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnggaranBiaya` ADD CONSTRAINT `AnggaranBiaya_kategoriId_fkey` FOREIGN KEY (`kategoriId`) REFERENCES `BiayaKategori`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnggaranBiaya` ADD CONSTRAINT `AnggaranBiaya_unitBiayaId_fkey` FOREIGN KEY (`unitBiayaId`) REFERENCES `UnitBiaya`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnggaranBiaya` ADD CONSTRAINT `AnggaranBiaya_asetId_fkey` FOREIGN KEY (`asetId`) REFERENCES `Aset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnggaranBiaya` ADD CONSTRAINT `AnggaranBiaya_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
