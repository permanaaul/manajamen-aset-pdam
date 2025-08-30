-- CreateTable
CREATE TABLE `HblGolonganTarif` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `diameterMm` INTEGER NULL,
    `minChargeM3` INTEGER NULL,
    `minChargeRp` DECIMAL(15, 2) NULL,
    `biayaAdminRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `pembulatanDenom` INTEGER NOT NULL DEFAULT 1,
    `pajakAktif` BOOLEAN NOT NULL DEFAULT false,
    `pajakPersen` DECIMAL(5, 2) NULL,
    `subsidiCatatan` VARCHAR(191) NULL,
    `subsidiRp` DECIMAL(15, 2) NULL,
    `gracePeriodHari` INTEGER NOT NULL DEFAULT 10,
    `skemaDenda` ENUM('FLAT', 'PERSEN', 'BERTAHAP') NULL,
    `dendaFlatPerHariRp` DECIMAL(15, 2) NULL,
    `dendaPersenPerBulan` DECIMAL(5, 2) NULL,
    `dendaBertahapJson` JSON NULL,
    `sp1Hari` INTEGER NOT NULL DEFAULT 15,
    `sp2Hari` INTEGER NOT NULL DEFAULT 30,
    `sp3Hari` INTEGER NOT NULL DEFAULT 45,
    `biayaBukaTutupRp` DECIMAL(15, 2) NULL,
    `biayaPasangKembaliRp` DECIMAL(15, 2) NULL,
    `berlakuDari` DATETIME(3) NULL,
    `berlakuSampai` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HblGolonganTarif_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblTarifBlok` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `golonganTarifId` INTEGER NOT NULL,
    `urutan` INTEGER NOT NULL,
    `dariM3` INTEGER NULL,
    `sampaiM3` INTEGER NULL,
    `tarifPerM3` DECIMAL(15, 2) NOT NULL,

    INDEX `HblTarifBlok_golonganTarifId_urutan_idx`(`golonganTarifId`, `urutan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblKebijakan` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `pembulatanDenom` INTEGER NOT NULL DEFAULT 100,
    `urutanPelunasan` VARCHAR(191) NOT NULL DEFAULT 'pokok->denda->biaya',
    `estimasiFormula` VARCHAR(191) NOT NULL DEFAULT 'avg_3bulan',
    `rolloverDigitMax` INTEGER NOT NULL DEFAULT 6,
    `rolloverDiizinkan` BOOLEAN NOT NULL DEFAULT true,
    `anomaliThresholdPersen` INTEGER NOT NULL DEFAULT 200,
    `anomaliMinM3` INTEGER NOT NULL DEFAULT 5,
    `estimasiBulanTidakTerbaca` INTEGER NOT NULL DEFAULT 2,
    `periodLockRule` VARCHAR(191) NOT NULL DEFAULT 'after_posting_gl',
    `distribusiTagihan` VARCHAR(191) NOT NULL DEFAULT 'Cetak',
    `kanalPembayaranAktif` VARCHAR(191) NOT NULL DEFAULT 'Kas,Bank',
    `postingGLEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblPeriode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tahun` INTEGER NOT NULL,
    `bulan` INTEGER NOT NULL,
    `billingFinal` BOOLEAN NOT NULL DEFAULT false,
    `glPosted` BOOLEAN NOT NULL DEFAULT false,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `lockedAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `HblPeriode_tahun_bulan_key`(`tahun`, `bulan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblPelanggan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `tipe` ENUM('SOSIAL', 'NIAGA', 'INSTANSI', 'LAINNYA') NOT NULL,
    `nik` VARCHAR(32) NULL,
    `npwp` VARCHAR(32) NULL,
    `hp` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `alamatJalan` VARCHAR(191) NULL,
    `rt` VARCHAR(8) NULL,
    `rw` VARCHAR(8) NULL,
    `kelurahan` VARCHAR(191) NULL,
    `kecamatan` VARCHAR(191) NULL,
    `kota` VARCHAR(191) NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HblPelanggan_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblSambungan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `noSambungan` VARCHAR(191) NOT NULL,
    `pelangganId` INTEGER NOT NULL,
    `golonganTarifId` INTEGER NOT NULL,
    `diameterMm` INTEGER NOT NULL,
    `alamatSambungan` VARCHAR(191) NULL,
    `ruteId` INTEGER NULL,
    `status` ENUM('AKTIF', 'TUTUP_SEMENTARA', 'PUTUS') NOT NULL DEFAULT 'AKTIF',
    `tanggalPasang` DATETIME(3) NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HblSambungan_noSambungan_key`(`noSambungan`),
    INDEX `HblSambungan_pelangganId_idx`(`pelangganId`),
    INDEX `HblSambungan_ruteId_idx`(`ruteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblMeter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `noSeri` VARCHAR(191) NOT NULL,
    `sambunganId` INTEGER NOT NULL,
    `tipe` VARCHAR(191) NOT NULL DEFAULT 'analog',
    `tahunPasang` INTEGER NULL,
    `kondisi` VARCHAR(191) NULL,
    `digitMaks` INTEGER NOT NULL DEFAULT 6,
    `segelNo` VARCHAR(191) NULL,
    `fotoUrl` VARCHAR(191) NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HblMeter_noSeri_key`(`noSeri`),
    INDEX `HblMeter_sambunganId_idx`(`sambunganId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblRute` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `petugasId` INTEGER NULL,
    `kapasitasPerHari` INTEGER NULL,
    `jadwalMulai` DATETIME(3) NULL,
    `jadwalSelesai` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HblRute_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblBaca` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sambunganId` INTEGER NOT NULL,
    `ruteId` INTEGER NULL,
    `periodeTahun` INTEGER NOT NULL,
    `periodeBulan` INTEGER NOT NULL,
    `angkaLalu` INTEGER NOT NULL DEFAULT 0,
    `angkaKini` INTEGER NOT NULL DEFAULT 0,
    `pakaiM3` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'TERVERIFIKASI') NOT NULL DEFAULT 'DRAFT',
    `anomali` BOOLEAN NOT NULL DEFAULT false,
    `catatan` VARCHAR(191) NULL,
    `tanggalBaca` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HblBaca_ruteId_idx`(`ruteId`),
    UNIQUE INDEX `HblBaca_sambunganId_periodeTahun_periodeBulan_key`(`sambunganId`, `periodeTahun`, `periodeBulan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblTagihan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `noTagihan` VARCHAR(191) NOT NULL,
    `pelangganId` INTEGER NOT NULL,
    `sambunganId` INTEGER NOT NULL,
    `periodeTahun` INTEGER NOT NULL,
    `periodeBulan` INTEGER NOT NULL,
    `pakaiM3` INTEGER NOT NULL DEFAULT 0,
    `jumlahAirRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `biayaAdminRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `dendaRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `pajakRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'FINAL', 'POSTED') NOT NULL DEFAULT 'DRAFT',
    `tanggalFinal` DATETIME(3) NULL,
    `tanggalPosting` DATETIME(3) NULL,
    `postingRef` VARCHAR(191) NULL,
    `tingkatTeguran` ENUM('NONE', 'SP1', 'SP2', 'SP3', 'PUTUS') NOT NULL DEFAULT 'NONE',
    `jurnalId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HblTagihan_noTagihan_key`(`noTagihan`),
    INDEX `HblTagihan_pelangganId_idx`(`pelangganId`),
    INDEX `HblTagihan_sambunganId_idx`(`sambunganId`),
    INDEX `HblTagihan_status_idx`(`status`),
    UNIQUE INDEX `HblTagihan_sambunganId_periodeTahun_periodeBulan_key`(`sambunganId`, `periodeTahun`, `periodeBulan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblTagihanItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tagihanId` INTEGER NOT NULL,
    `jenisItem` VARCHAR(191) NOT NULL,
    `jumlahRp` DECIMAL(15, 2) NOT NULL,
    `catatan` VARCHAR(191) NULL,

    INDEX `HblTagihanItem_tagihanId_idx`(`tagihanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblPembayaran` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `noKwitansi` VARCHAR(191) NOT NULL,
    `metode` ENUM('TUNAI', 'TRANSFER', 'VA', 'LAINNYA') NOT NULL,
    `tanggalBayar` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `jumlahTotalRp` DECIMAL(15, 2) NOT NULL,
    `diterimaOlehId` INTEGER NULL,
    `catatan` VARCHAR(191) NULL,
    `jurnalId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HblPembayaran_noKwitansi_key`(`noKwitansi`),
    INDEX `HblPembayaran_jurnalId_idx`(`jurnalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblPembayaranAlokasi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pembayaranId` INTEGER NOT NULL,
    `tagihanId` INTEGER NOT NULL,
    `jumlahRp` DECIMAL(15, 2) NOT NULL,
    `alokasiPokokRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `alokasiDendaRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `alokasiAdminRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,

    INDEX `HblPembayaranAlokasi_pembayaranId_idx`(`pembayaranId`),
    INDEX `HblPembayaranAlokasi_tagihanId_idx`(`tagihanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblTeguran` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tagihanId` INTEGER NOT NULL,
    `level` ENUM('NONE', 'SP1', 'SP2', 'SP3', 'PUTUS') NOT NULL,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `biayaRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `noSurat` VARCHAR(191) NULL,
    `catatan` VARCHAR(191) NULL,

    INDEX `HblTeguran_tagihanId_level_idx`(`tagihanId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblPemetaanAkun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipe` ENUM('AR', 'PENDAPATAN_AIR', 'PENDAPATAN_NON_AIR', 'PENDAPATAN_DENDA', 'PAJAK_KELUARAN', 'KAS', 'BANK') NOT NULL,
    `akunId` INTEGER NOT NULL,
    `segment` VARCHAR(191) NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `berlakuDari` DATETIME(3) NULL,
    `berlakuSampai` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HblPemetaanAkun_tipe_akunId_aktif_idx`(`tipe`, `akunId`, `aktif`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblAntrianJurnal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sumber` VARCHAR(191) NOT NULL DEFAULT 'HUBLANG',
    `refType` ENUM('BILLING', 'PAYMENT') NOT NULL,
    `refId` VARCHAR(191) NOT NULL,
    `memo` VARCHAR(191) NULL,
    `totalRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` ENUM('NOT_POSTED', 'POSTED', 'FAILED') NOT NULL DEFAULT 'NOT_POSTED',
    `postedAt` DATETIME(3) NULL,
    `jurnalId` INTEGER NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HblAntrianJurnal_idempotencyKey_key`(`idempotencyKey`),
    INDEX `HblAntrianJurnal_refType_refId_idx`(`refType`, `refId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HblAntrianJurnalLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `antrianId` INTEGER NOT NULL,
    `akunId` INTEGER NOT NULL,
    `debitRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `kreditRp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `catatan` VARCHAR(191) NULL,

    INDEX `HblAntrianJurnalLine_antrianId_idx`(`antrianId`),
    INDEX `HblAntrianJurnalLine_akunId_idx`(`akunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HblTarifBlok` ADD CONSTRAINT `HblTarifBlok_golonganTarifId_fkey` FOREIGN KEY (`golonganTarifId`) REFERENCES `HblGolonganTarif`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblSambungan` ADD CONSTRAINT `HblSambungan_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `HblPelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblSambungan` ADD CONSTRAINT `HblSambungan_golonganTarifId_fkey` FOREIGN KEY (`golonganTarifId`) REFERENCES `HblGolonganTarif`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblSambungan` ADD CONSTRAINT `HblSambungan_ruteId_fkey` FOREIGN KEY (`ruteId`) REFERENCES `HblRute`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblMeter` ADD CONSTRAINT `HblMeter_sambunganId_fkey` FOREIGN KEY (`sambunganId`) REFERENCES `HblSambungan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblRute` ADD CONSTRAINT `HblRute_petugasId_fkey` FOREIGN KEY (`petugasId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblBaca` ADD CONSTRAINT `HblBaca_sambunganId_fkey` FOREIGN KEY (`sambunganId`) REFERENCES `HblSambungan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblBaca` ADD CONSTRAINT `HblBaca_ruteId_fkey` FOREIGN KEY (`ruteId`) REFERENCES `HblRute`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblTagihan` ADD CONSTRAINT `HblTagihan_jurnalId_fkey` FOREIGN KEY (`jurnalId`) REFERENCES `JurnalUmum`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblTagihan` ADD CONSTRAINT `HblTagihan_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `HblPelanggan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblTagihan` ADD CONSTRAINT `HblTagihan_sambunganId_fkey` FOREIGN KEY (`sambunganId`) REFERENCES `HblSambungan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblTagihanItem` ADD CONSTRAINT `HblTagihanItem_tagihanId_fkey` FOREIGN KEY (`tagihanId`) REFERENCES `HblTagihan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblPembayaran` ADD CONSTRAINT `HblPembayaran_jurnalId_fkey` FOREIGN KEY (`jurnalId`) REFERENCES `JurnalUmum`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblPembayaran` ADD CONSTRAINT `HblPembayaran_diterimaOlehId_fkey` FOREIGN KEY (`diterimaOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblPembayaranAlokasi` ADD CONSTRAINT `HblPembayaranAlokasi_pembayaranId_fkey` FOREIGN KEY (`pembayaranId`) REFERENCES `HblPembayaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblPembayaranAlokasi` ADD CONSTRAINT `HblPembayaranAlokasi_tagihanId_fkey` FOREIGN KEY (`tagihanId`) REFERENCES `HblTagihan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblTeguran` ADD CONSTRAINT `HblTeguran_tagihanId_fkey` FOREIGN KEY (`tagihanId`) REFERENCES `HblTagihan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblPemetaanAkun` ADD CONSTRAINT `HblPemetaanAkun_akunId_fkey` FOREIGN KEY (`akunId`) REFERENCES `Akun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblAntrianJurnal` ADD CONSTRAINT `HblAntrianJurnal_jurnalId_fkey` FOREIGN KEY (`jurnalId`) REFERENCES `JurnalUmum`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblAntrianJurnalLine` ADD CONSTRAINT `HblAntrianJurnalLine_antrianId_fkey` FOREIGN KEY (`antrianId`) REFERENCES `HblAntrianJurnal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HblAntrianJurnalLine` ADD CONSTRAINT `HblAntrianJurnalLine_akunId_fkey` FOREIGN KEY (`akunId`) REFERENCES `Akun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
