/*
  Warnings:

  - Added the required column `pelaksana` to the `Pemeliharaan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Pemeliharaan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `pemeliharaan` ADD COLUMN `pelaksana` VARCHAR(191) NOT NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL,
    MODIFY `biaya` DECIMAL(15, 2) NULL;
