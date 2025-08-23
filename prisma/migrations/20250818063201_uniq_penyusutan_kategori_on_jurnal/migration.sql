/*
  Warnings:

  - A unique constraint covering the columns `[penyusutanId,kategoriId]` on the table `JurnalBiaya` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `JurnalBiaya_penyusutanId_kategoriId_key` ON `JurnalBiaya`(`penyusutanId`, `kategoriId`);
