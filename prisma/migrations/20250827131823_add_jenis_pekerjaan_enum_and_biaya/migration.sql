/*
  Warnings:

  - You are about to drop the column `fotoAfter` on the `hblworkorder` table. All the data in the column will be lost.
  - You are about to drop the column `fotoBefore` on the `hblworkorder` table. All the data in the column will be lost.
  - You are about to drop the column `hasilPekerjaan` on the `hblworkorder` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `hblworkorder` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(8))` to `VarChar(191)`.
  - You are about to alter the column `prioritas` on the `hblworkorder` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(14))` to `VarChar(191)`.
  - You are about to alter the column `biayaMaterialRp` on the `hblworkorder` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Decimal(18,2)`.
  - You are about to alter the column `biayaJasaRp` on the `hblworkorder` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Decimal(18,2)`.

*/
-- DropForeignKey
ALTER TABLE `hblworkorder` DROP FOREIGN KEY `HblWorkOrder_pelangganId_fkey`;

-- DropForeignKey
ALTER TABLE `hblworkorder` DROP FOREIGN KEY `HblWorkOrder_petugasId_fkey`;

-- DropForeignKey
ALTER TABLE `hblworkorder` DROP FOREIGN KEY `HblWorkOrder_ruteId_fkey`;

-- DropForeignKey
ALTER TABLE `hblworkorder` DROP FOREIGN KEY `HblWorkOrder_sambunganId_fkey`;

-- DropIndex
DROP INDEX `HblWorkOrder_noWo_key` ON `hblworkorder`;

-- DropIndex
DROP INDEX `HblWorkOrder_status_prioritas_idx` ON `hblworkorder`;

-- AlterTable
ALTER TABLE `hblworkorder` DROP COLUMN `fotoAfter`,
    DROP COLUMN `fotoBefore`,
    DROP COLUMN `hasilPekerjaan`,
    ADD COLUMN `jenisPekerjaan` ENUM('INSPEKSI', 'PELUMASAN', 'KALIBRASI', 'GANTI_SPAREPART', 'PERBAIKAN_RINGAN', 'PERBAIKAN_BESAR', 'OVERHAUL', 'TESTING') NULL,
    MODIFY `tanggalBuat` DATETIME(3) NULL,
    MODIFY `status` VARCHAR(191) NOT NULL,
    MODIFY `prioritas` VARCHAR(191) NOT NULL,
    MODIFY `biayaMaterialRp` DECIMAL(18, 2) NULL,
    MODIFY `biayaJasaRp` DECIMAL(18, 2) NULL,
    MODIFY `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NULL;

-- AddForeignKey
ALTER TABLE `hblworkorder` ADD CONSTRAINT `hblworkorder_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `HblPelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hblworkorder` ADD CONSTRAINT `hblworkorder_sambunganId_fkey` FOREIGN KEY (`sambunganId`) REFERENCES `HblSambungan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hblworkorder` ADD CONSTRAINT `hblworkorder_ruteId_fkey` FOREIGN KEY (`ruteId`) REFERENCES `HblRute`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hblworkorder` ADD CONSTRAINT `hblworkorder_petugasId_fkey` FOREIGN KEY (`petugasId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `hblworkorder` RENAME INDEX `HblWorkOrder_pelangganId_idx` TO `hblworkorder_pelangganId_idx`;

-- RenameIndex
ALTER TABLE `hblworkorder` RENAME INDEX `HblWorkOrder_petugasId_idx` TO `hblworkorder_petugasId_idx`;

-- RenameIndex
ALTER TABLE `hblworkorder` RENAME INDEX `HblWorkOrder_ruteId_idx` TO `hblworkorder_ruteId_idx`;

-- RenameIndex
ALTER TABLE `hblworkorder` RENAME INDEX `HblWorkOrder_sambunganId_idx` TO `hblworkorder_sambunganId_idx`;
