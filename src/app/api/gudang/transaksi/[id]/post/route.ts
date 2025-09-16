// app/api/gudang/transaksi/[id]/post/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ===== helpers nomor jurnal =====
async function nextJurnalNo(prefix = "JRN") {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = `${prefix}-${yyyymm}`;
  // @ts-ignore
  const row = await prisma.sequenceCounter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  return `${key}-${String(row.value).padStart(5, "0")}`;
}

// ===== helpers periode =====
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

// buat periode jika belum ada; wajib status TERBUKA
async function ensureOpenPeriod(tx: any, tgl: Date) {
  const tahun = tgl.getFullYear();
  const bulan = tgl.getMonth() + 1;
  // @ts-ignore
  let p = await tx.periodeAkuntansi.findUnique({ where: { tahun_bulan: { tahun, bulan } } });
  if (!p) {
    // @ts-ignore
    p = await tx.periodeAkuntansi.create({
      data: {
        tahun,
        bulan,
        mulai: startOfMonth(tgl),
        akhir: endOfMonth(tgl),
        status: "TERBUKA",
      },
    });
  }
  if (p.status !== "TERBUKA") throw new Error(`Periode ${tahun}-${String(bulan).padStart(2, "0")} tidak TERBUKA`);
  return p;
}

// ===== mapping akun =====
// Kunci yang dipakai (silakan seed di MappingAkunOtomatis)
// - INVENTORY_RECEIPT_DR  (default debit saat IN jika item.akunPersediaanId null)
// - INVENTORY_RECEIPT_CR  (kredit lawan saat IN, mis. Hutang/Kas)
// - INVENTORY_ISSUE_DR    (debit saat OUT, mis. Beban BHP/Produksi bila item.akunBebanId null)
// - INVENTORY_ISSUE_CR    (kredit persediaan default bila item.akunPersediaanId null)
// - INVENTORY_ADJ_GAIN    (kredit selisih lebih)
// - INVENTORY_ADJ_LOSS    (debit selisih kurang)
async function getMap(tx: any, key: string) {
  // @ts-ignore
  return tx.mappingAkunOtomatis.findUnique({ where: { kunci: key }, select: { debitAkunId: true, kreditAkunId: true } });
}

// ===== saldo bulanan (trial balance) =====
async function applySaldoBulanan(tx: any, akunId: number, tgl: Date, debit: number, kredit: number) {
  const tahun = tgl.getFullYear();
  const bulan = tgl.getMonth() + 1;

  // @ts-ignore
  const akun = await tx.akun.findUnique({ where: { id: akunId }, select: { pos: true } });
  if (!akun) throw new Error(`Akun ${akunId} tidak ditemukan`);

  // @ts-ignore
  const sb = await tx.saldoAkunBulanan.upsert({
    where: { akunId_tahun_bulan: { akunId, tahun, bulan } },
    update: {
      debit:  { increment: debit },
      kredit: { increment: kredit },
    },
    create: {
      akunId, tahun, bulan,
      saldoAwal: 0,
      debit, kredit,
      saldoAkhir: 0,
    },
  });

  // hitung saldo akhir: saldoAwal + (pos==DEBIT ? debit - kredit : kredit - debit)
  const curr = await tx.saldoAkunBulanan.findUnique({ where: { akunId_tahun_bulan: { akunId, tahun, bulan } } });
  if (curr) {
    const d = Number(curr.debit);
    const k = Number(curr.kredit);
    const base = Number(curr.saldoAwal);
    const akhir = akun.pos === "DEBIT" ? base + (d - k) : base + (k - d);
    await tx.saldoAkunBulanan.update({
      where: { akunId_tahun_bulan: { akunId, tahun, bulan } },
      data: { saldoAkhir: akhir },
    });
  }
}

// ===== angka aman =====
const n = (v: any) => (v == null ? 0 : Number(v) || 0);

// ===== POST (posting jurnal dari transaksi gudang) =====
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    // ambil header + lines + item-akun
    // @ts-ignore
    const header = await prisma.stokTransaksi.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: { select: { id: true, nama: true, akunPersediaanId: true, akunBebanId: true } },
          },
          orderBy: { id: "asc" },
        },
        gudangAsal:   { select: { id: true, nama: true } },
        gudangTujuan: { select: { id: true, nama: true } },
      },
    });

    if (!header) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (header.jurnalId) return NextResponse.json({ error: "sudah diposting ke jurnal" }, { status: 400 });
    if (header.status !== "POSTED") return NextResponse.json({ error: "transaksi belum berstatus POSTED" }, { status: 400 });

    const tanggal = new Date(header.tanggal);

    // jalankan dalam transaksi
    // @ts-ignore
    const result = await prisma.$transaction(async (tx) => {
      // pastikan periode terbuka
      const periode = await ensureOpenPeriod(tx, tanggal);

      // ambil mapping sekali
      const mapIN_DR  = await getMap(tx, "INVENTORY_RECEIPT_DR");
      const mapIN_CR  = await getMap(tx, "INVENTORY_RECEIPT_CR");
      const mapOUT_DR = await getMap(tx, "INVENTORY_ISSUE_DR");
      const mapOUT_CR = await getMap(tx, "INVENTORY_ISSUE_CR");
      const mapADJ_GAIN = await getMap(tx, "INVENTORY_ADJ_GAIN");
      const mapADJ_LOSS = await getMap(tx, "INVENTORY_ADJ_LOSS");

      // nomor jurnal
      const nomorJ = await nextJurnalNo("JRN");

      // buat header jurnal
      // @ts-ignore
      const jurnal = await tx.jurnal.create({
        data: {
          nomor: nomorJ,
          tanggal,
          periodeId: periode.id,
          status: "POSTED",
          sumber: "GUDANG",
          memo: `Posting Gudang ${header.nomor}`,
          refTable: "stok_transaksi",
          refId: header.id,
          refNo: header.nomor,
          postedAt: new Date(),
          // createdById/postedById bisa diisi jika ada auth user
        },
      });

      // util bikin line + update saldo bulanan
      async function pushLine(akunId: number, uraian: string, debit: number, kredit: number, extra: any = {}) {
        if (!akunId) throw new Error(`Akun belum terdefinisi untuk "${uraian}"`);
        // @ts-ignore
        await tx.jurnalLine.create({
          data: {
            headerId: jurnal.id,
            akunId,
            uraian,
            debit,
            kredit,
            gudangId: header.gudangAsalId || header.gudangTujuanId || null,
            ...extra,
          },
        });
        await applySaldoBulanan(tx, akunId, tanggal, debit, kredit);
      }

      // iterasi lines
      for (const l of header.lines) {
        const qty = n(l.qty);
        const harga = n(l.hargaRp);
        const amount = Math.round(qty * harga); // IDR pembulatan ke rupiah

        // referensi dimensi
        const dims = { stokLineId: l.id, itemId: l.itemId };

        if (header.tipe === "RECEIPT") {
          // DR persediaan (item.akunPersediaanId || mapping)
          const drAkun = l.item?.akunPersediaanId || mapIN_DR?.debitAkunId || 0;
          // CR lawan (mapping wajib)
          const crAkun = mapIN_CR?.kreditAkunId || 0;
          if (!drAkun || !crAkun) throw new Error("Mapping akun IN belum lengkap (INVENTORY_RECEIPT_DR/CR)");

          await pushLine(drAkun, `IN ${l.item?.nama || l.itemId}`, amount, 0, dims);
          await pushLine(crAkun, `IN ${l.item?.nama || l.itemId}`, 0, amount, dims);
        }

        if (header.tipe === "ISSUE") {
          // DR beban (item.akunBebanId || mapping)
          const drAkun = l.item?.akunBebanId || mapOUT_DR?.debitAkunId || 0;
          // CR persediaan (item.akunPersediaanId || mapping)
          const crAkun = l.item?.akunPersediaanId || mapOUT_CR?.kreditAkunId || 0;
          if (!drAkun || !crAkun) throw new Error("Mapping akun OUT belum lengkap (INVENTORY_ISSUE_DR/CR)");

          await pushLine(drAkun, `OUT ${l.item?.nama || l.itemId}`, amount, 0, dims);
          await pushLine(crAkun, `OUT ${l.item?.nama || l.itemId}`, 0, amount, dims);
        }

        if (header.tipe === "ADJUSTMENT") {
          // qty di header.lines adalah ABS pada insert kamu; tentukan arah dari catatan/harga?
          // Asumsi: tanda ekonomis dilihat dari hargaRp (+ tambah nilai, – kurangi nilai) atau dari catatan.
          // Simpel: jika hargaRp >= 0 → tambah persediaan; jika < 0 → kurangi (jika tidak ada, pakai +).
          const plus = harga >= 0;
          const amt = Math.abs(amount);

          if (plus) {
            const drAkun = l.item?.akunPersediaanId || mapIN_DR?.debitAkunId || 0;
            const crAkun = mapADJ_GAIN?.kreditAkunId || 0;
            if (!drAkun || !crAkun) throw new Error("Mapping akun ADJ(+) belum lengkap (RECEIPT_DR / ADJ_GAIN)");
            await pushLine(drAkun, `ADJ+ ${l.item?.nama || l.itemId}`, amt, 0, dims);
            await pushLine(crAkun, `ADJ+ ${l.item?.nama || l.itemId}`, 0, amt, dims);
          } else {
            const drAkun = mapADJ_LOSS?.debitAkunId || 0;
            const crAkun = l.item?.akunPersediaanId || mapOUT_CR?.kreditAkunId || 0;
            if (!drAkun || !crAkun) throw new Error("Mapping akun ADJ(-) belum lengkap (ADJ_LOSS / ISSUE_CR)");
            await pushLine(drAkun, `ADJ- ${l.item?.nama || l.itemId}`, amt, 0, dims);
            await pushLine(crAkun, `ADJ- ${l.item?.nama || l.itemId}`, 0, amt, dims);
          }
        }
      }

      // set link jurnalId di header
      await tx.stokTransaksi.update({
        where: { id: header.id },
        data: { jurnalId: jurnal.id },
      });

      return { jurnalId: jurnal.id, nomor: jurnal.nomor };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
