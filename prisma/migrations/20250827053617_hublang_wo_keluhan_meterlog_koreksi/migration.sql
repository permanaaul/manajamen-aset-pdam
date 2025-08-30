-- AlterTable
ALTER TABLE `hbltagihan` ADD COLUMN `printCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `tarifSnapshotJson` JSON NULL;

-- CreateTable
CREATE TABLE `HblWorkOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `noWo` VARCHAR(191) NOT NULL,
    `tanggalBuat` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('DRAFT', 'OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `prioritas` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `jenis` VARCHAR(191) NULL,
    `deskripsi` VARCHAR(191) NULL,
    `pelangganId` INTEGER NULL,
    `sambunganId` INTEGER NULL,
    `ruteId` INTEGER NULL,
    `petugasId` INTEGER NULL,
    `targetTanggal` DATETIME(3) NULL,
    `selesaiTanggal` DATETIME(3) NULL,
    `hasilPekerjaan` VARCHAR(191) NULL,
    `fotoBefore` JSON NULL,
    `fotoAfter` JSON NULL,
    `biayaMaterialRp` DECIMAL(15, 2) NULL,
    `biayaJasaRp` DECIMAL(15, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HblWorkOrder_noWo_key`(`noWo`),
    INDEX `HblWorkOrder_pelangganId_idx`(`pelangganId`),
    INDEX `HblWorkOrder_sambunganId_idx`(`sambunganId`),
    INDEX `HblWorkOrder_ruteId_idx`(`ruteId`),
    INDEX `HblWorkOrder_petugasId_idx`(`petugasId`),
    INDEX `HblWorkOrder_status_prioritas_idx`(`status`, `prioritas`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblKeluhan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `kanal` ENUM('WALKIN', 'TELP', 'WEB', 'APP', 'LAINNYA') NOT NULL DEFAULT 'WALKIN',
    `ringkas` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(191) NULL,
    `lampiran` JSON NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'CLOSED', 'CANCELED') NOT NULL DEFAULT 'OPEN',
    `pelangganId` INTEGER NULL,
    `sambunganId` INTEGER NULL,
    `workOrderId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HblKeluhan_pelangganId_idx`(`pelangganId`),
    INDEX `HblKeluhan_sambunganId_idx`(`sambunganId`),
    INDEX `HblKeluhan_workOrderId_idx`(`workOrderId`),
    INDEX `HblKeluhan_status_kanal_idx`(`status`, `kanal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblMeterRiwayat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sambunganId` INTEGER NOT NULL,
    `meterId` INTEGER NULL,
    `event` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `digitAwal` INTEGER NULL,
    `digitAkhir` INTEGER NULL,
    `catatan` VARCHAR(191) NULL,
    `fotoUrl` VARCHAR(191) NULL,

    INDEX `HblMeterRiwayat_sambunganId_idx`(`sambunganId`),
    INDEX `HblMeterRiwayat_meterId_idx`(`meterId`),
    INDEX `HblMeterRiwayat_event_tanggal_idx`(`event`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblKoreksiBaca` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bacaId` INTEGER NOT NULL,
    `alasan` VARCHAR(191) NULL,
    `angkaKiniSebelum` INTEGER NULL,
    `angkaKiniSesudah` INTEGER NULL,
    `pakaiSebelum` INTEGER NULL,
    `pakaiSesudah` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HblKoreksiBaca_bacaId_idx`(`bacaId`),
    INDEX `HblKoreksiBaca_createdById_idx`(`createdById`),
    INDEX `HblKoreksiBaca_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HblWorkOrder` ADD CONSTRAINT `HblWorkOrder_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `HblPelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblWorkOrder` ADD CONSTRAINT `HblWorkOrder_sambunganId_fkey` FOREIGN KEY (`sambunganId`) REFERENCES `HblSambungan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblWorkOrder` ADD CONSTRAINT `HblWorkOrder_ruteId_fkey` FOREIGN KEY (`ruteId`) REFERENCES `HblRute`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblWorkOrder` ADD CONSTRAINT `HblWorkOrder_petugasId_fkey` FOREIGN KEY (`petugasId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblKeluhan` ADD CONSTRAINT `HblKeluhan_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `HblPelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblKeluhan` ADD CONSTRAINT `HblKeluhan_sambunganId_fkey` FOREIGN KEY (`sambunganId`) REFERENCES `HblSambungan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblKeluhan` ADD CONSTRAINT `HblKeluhan_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `HblWorkOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblMeterRiwayat` ADD CONSTRAINT `HblMeterRiwayat_sambunganId_fkey` FOREIGN KEY (`sambunganId`) REFERENCES `HblSambungan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblMeterRiwayat` ADD CONSTRAINT `HblMeterRiwayat_meterId_fkey` FOREIGN KEY (`meterId`) REFERENCES `HblMeter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblKoreksiBaca` ADD CONSTRAINT `HblKoreksiBaca_bacaId_fkey` FOREIGN KEY (`bacaId`) REFERENCES `HblBaca`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblKoreksiBaca` ADD CONSTRAINT `HblKoreksiBaca_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
