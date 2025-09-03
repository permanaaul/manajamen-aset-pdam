-- AlterTable
ALTER TABLE `aset` ADD COLUMN `basisPenyusutan` ENUM('TAHUNAN', 'BULANAN') NOT NULL DEFAULT 'TAHUNAN',
    ADD COLUMN `gunakanTarifCustom` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `tarifCustom` DECIMAL(6, 3) NULL;

-- AlterTable
ALTER TABLE `penyusutan` ADD COLUMN `basis` ENUM('TAHUNAN', 'BULANAN') NOT NULL DEFAULT 'TAHUNAN';

-- CreateIndex
CREATE INDEX `Aset_mulaiPenyusutan_idx` ON `Aset`(`mulaiPenyusutan`);

-- CreateIndex
CREATE INDEX `Penyusutan_asetId_periode_idx` ON `Penyusutan`(`asetId`, `periode`);
