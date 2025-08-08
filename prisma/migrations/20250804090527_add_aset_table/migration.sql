-- CreateTable
CREATE TABLE `Aset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nia` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `kategori` VARCHAR(191) NOT NULL,
    `lokasi` VARCHAR(191) NOT NULL,
    `tahun` INTEGER NOT NULL,
    `nilai` DECIMAL(15, 2) NOT NULL,
    `kondisi` VARCHAR(191) NOT NULL,
    `catatan` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Aset_nia_key`(`nia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
