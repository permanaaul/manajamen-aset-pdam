-- CreateTable
CREATE TABLE `Pemeliharaan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asetId` INTEGER NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `jenis` VARCHAR(191) NOT NULL,
    `biaya` DECIMAL(15, 2) NOT NULL,
    `catatan` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Pemeliharaan` ADD CONSTRAINT `Pemeliharaan_asetId_fkey` FOREIGN KEY (`asetId`) REFERENCES `Aset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
