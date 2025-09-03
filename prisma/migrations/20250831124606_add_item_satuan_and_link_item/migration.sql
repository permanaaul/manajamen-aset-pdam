-- 1) Buat tabel master satuan
CREATE TABLE `itemsatuan` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nama` VARCHAR(191) NOT NULL,
  `simbol` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `itemsatuan_simbol_key` (`simbol`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Tambahkan kolom referensi ke item (nullable dulu supaya mapping bisa jalan)
ALTER TABLE `item` ADD COLUMN `satuanId` INT NULL;

-- 3) Tambahkan FK
ALTER TABLE `item`
  ADD CONSTRAINT `item_satuanId_fkey`
  FOREIGN KEY (`satuanId`) REFERENCES `itemsatuan`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4) Seed minimal master satuan
INSERT INTO `itemsatuan` (`nama`, `simbol`) VALUES
  ('Pieces','PCS'),
  ('Meter','MTR'),
  ('Liter','LTR'),
  ('Unit','UNIT'),
  ('Set','SET'),
  ('Kilogram','KG'),
  ('Box','BOX'),
  ('Roll','ROLL')
ON DUPLICATE KEY UPDATE `nama` = VALUES(`nama`);

-- 5) Map nilai enum lama (kolom `item.satuan`) ke `itemsatuan.id`
--    Sesuaikan baris ON condition jika kamu ingin logika mapping yang berbeda.
UPDATE `item` i
LEFT JOIN `itemsatuan` s
  ON (
    (i.`satuan` = 'PCS'      AND s.`simbol` = 'PCS') OR
    (i.`satuan` = 'METER'    AND s.`nama`   = 'Meter') OR
    (i.`satuan` = 'LITER'    AND s.`nama`   = 'Liter') OR
    (i.`satuan` = 'UNIT'     AND s.`simbol` = 'UNIT') OR
    (i.`satuan` = 'SET'      AND s.`simbol` = 'SET') OR
    (i.`satuan` = 'KILOGRAM' AND s.`simbol` = 'KG') OR
    (i.`satuan` = 'BOX'      AND s.`simbol` = 'BOX') OR
    (i.`satuan` = 'ROLL'     AND s.`simbol` = 'ROLL')
  )
SET i.`satuanId` = s.`id`
WHERE i.`satuanId` IS NULL;

-- 6) Hapus kolom enum lama
ALTER TABLE `item` DROP COLUMN `satuan`;

-- 7) (Opsional) Wajibkan satuan terisi (jalankan hanya jika SEMUA item sudah punya `satuanId`)
ALTER TABLE `item` MODIFY `satuanId` INT NOT NULL;
