/*
  Warnings:

  - You are about to alter the column `kategori` on the `aset` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(1))`.

*/
-- AlterTable
ALTER TABLE `aset` MODIFY `kategori` ENUM('KONSTRUKSI_SIPIL', 'PIPA', 'SUMUR_BOR', 'POMPA', 'KATUP', 'MOTOR_LISTRIK', 'KELISTRIKAN', 'KONTROL', 'BANGUNAN', 'TANAH') NOT NULL;
