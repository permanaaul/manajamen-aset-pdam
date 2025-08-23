/*
  Warnings:

  - A unique constraint covering the columns `[voucherNo]` on the table `JurnalUmum` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `jurnalumum` ADD COLUMN `postedAt` DATETIME(3) NULL,
    ADD COLUMN `postedById` INTEGER NULL,
    ADD COLUMN `printCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `voucherDate` DATETIME(3) NULL,
    ADD COLUMN `voucherNo` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `SequenceCounter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `SequenceCounter_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `JurnalUmum_voucherNo_key` ON `JurnalUmum`(`voucherNo`);

-- CreateIndex
CREATE INDEX `JurnalUmum_voucherNo_idx` ON `JurnalUmum`(`voucherNo`);

-- AddForeignKey
ALTER TABLE `JurnalUmum` ADD CONSTRAINT `JurnalUmum_postedById_fkey` FOREIGN KEY (`postedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
