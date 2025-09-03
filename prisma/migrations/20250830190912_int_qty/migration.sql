/* Optional: backup dulu sebelum apply di prod :) */

/* 1) Normalisasi data lama (DECIMAL -> INT) */
UPDATE `stoksaldo` SET `qty` = ROUND(`qty`), `reservedQty` = ROUND(`reservedQty`);
UPDATE `item`      SET `minQty` = ROUND(`minQty`) WHERE `minQty` IS NOT NULL;

/* 2) Ubah tipe kolom ke INTEGER */
ALTER TABLE `item`
  MODIFY `minQty` INTEGER NULL;

ALTER TABLE `stoksaldo`
  MODIFY `qty`         INTEGER NOT NULL DEFAULT 0,
  MODIFY `reservedQty` INTEGER NOT NULL DEFAULT 0;
