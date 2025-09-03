/*
  Warnings:

  - A unique constraint covering the columns `[nama]` on the table `ItemSatuan` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `item` DROP FOREIGN KEY `item_satuanId_fkey`;

-- DropIndex
DROP INDEX `item_satuanId_fkey` ON `item`;

-- AlterTable
ALTER TABLE `item` MODIFY `satuanId` INTEGER NULL;

-- AlterTable
ALTER TABLE `itemsatuan` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `Aset_kategori_idx` ON `Aset`(`kategori`);

-- CreateIndex
CREATE INDEX `Aset_tahun_idx` ON `Aset`(`tahun`);

-- CreateIndex
CREATE UNIQUE INDEX `ItemSatuan_nama_key` ON `ItemSatuan`(`nama`);

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_satuanId_fkey` FOREIGN KEY (`satuanId`) REFERENCES `ItemSatuan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `itemsatuan` RENAME INDEX `itemsatuan_simbol_key` TO `ItemSatuan_simbol_key`;

-- RenameIndex
ALTER TABLE `stoktransaksiline` RENAME INDEX `StokTransaksiLine_asetId_fkey` TO `StokTransaksiLine_asetId_idx`;
