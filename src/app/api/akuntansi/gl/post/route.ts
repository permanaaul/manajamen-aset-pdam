// src/app/api/akuntansi/gl/post/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { nextVoucherNo } from "@/lib/voucher"; // generate nomor voucher

type Item = { type: "JURNAL" | "PENYUSUTAN"; id: number };

async function isPosted(item: Item) {
  if (item.type === "JURNAL") {
    // @ts-ignore
    const f = await prisma.jurnalUmumLine.findFirst({ where: { jurnalBiayaId: item.id } });
    return !!f;
  }
  // @ts-ignore
  const f = await prisma.jurnalUmumLine.findFirst({ where: { penyusutanId: item.id } });
  return !!f;
}

// panggil ulang preview logic via DB (tanpa memanggil HTTP)
async function buildPreview(item: Item) {
  if (item.type === "JURNAL") {
    // @ts-ignore
    const r = await prisma.jurnalBiaya.findUnique({
      where: { id: item.id },
      include: {
        kategori: {
          select: { id: true, kode: true, nama: true, debitAkunId: true, kreditAkunId: true },
        },
        // ikutkan asetId pada alokasi & fallback aset dari penyusutan
        alokasi: { select: { id: true, unitBiayaId: true, asetId: true } },
        aset: { select: { id: true, nama: true } },
        penyusutan: { select: { asetId: true } },
      },
    });
    if (!r) return { canPost: false, issues: ["NOT_FOUND"], header: null, lines: [] as any[] };

    const issues: string[] = [];
    const lines: any[] = [];

    // === Unit ===
    const alokasiUnits = (r.alokasi || [])
      .map((a: { unitBiayaId: number | null | undefined }) => a.unitBiayaId ?? null)
      .filter((v: number | null): v is number => typeof v === "number");
    const unitForLine = alokasiUnits.length === 1 ? alokasiUnits[0] : null;
    if (alokasiUnits.length > 1) {
      issues.push("Alokasi memiliki >1 unit; jumlah tidak dipecah per unit. Akan disimpan tanpa unit.");
    }

    // === Aset ===
    const alokasiAsets = (r.alokasi || [])
      .map((a: { asetId: number | null | undefined }) => a.asetId ?? null)
      .filter((v: number | null): v is number => typeof v === "number");

    const asetForLine =
      (r as any).asetId ??
      (r as any)?.penyusutan?.asetId ??
      (alokasiAsets.length === 1 ? alokasiAsets[0] : null);

    if (alokasiAsets.length > 1) {
      issues.push("Alokasi memiliki >1 aset; tidak ditempel ke baris. Akan disimpan tanpa aset.");
    }

    const debitAkunId = r.kategori?.debitAkunId || null;
    const kreditAkunId = r.kategori?.kreditAkunId || null;
    const debit = Number(r.debit || 0);
    const kredit = Number(r.kredit || 0);

    // helper ambil akun
    const getAkun = async (idAkun: number | null) =>
      // @ts-ignore
      idAkun ? await prisma.akun.findUnique({ where: { id: idAkun } }) : null;

    if (debit > 0 && kredit > 0) {
      if (!debitAkunId) issues.push("Kategori belum terhubung debitAkun.");
      if (!kreditAkunId) issues.push("Kategori belum terhubung kreditAkun.");

      const akunD = await getAkun(debitAkunId);
      const akunK = await getAkun(kreditAkunId);
      if (debitAkunId && !akunD) issues.push("Akun debit tidak ditemukan.");
      if (kreditAkunId && !akunK) issues.push("Akun kredit tidak ditemukan.");

      if (akunD)
        lines.push({ akunId: akunD.id, debit: +debit.toFixed(2), kredit: 0, unitBiayaId: unitForLine, asetId: asetForLine });
      if (akunK)
        lines.push({ akunId: akunK.id, debit: 0, kredit: +kredit.toFixed(2), unitBiayaId: unitForLine, asetId: asetForLine });
    } else if (debit > 0) {
      if (!debitAkunId) issues.push("Kategori belum terhubung debitAkun.");
      if (!kreditAkunId) issues.push("Kategori belum terhubung kreditAkun.");

      const akunD = await getAkun(debitAkunId);
      const akunK = await getAkun(kreditAkunId);
      if (debitAkunId && !akunD) issues.push("Akun debit tidak ditemukan.");
      if (kreditAkunId && !akunK) issues.push("Akun kredit tidak ditemukan.");

      if (akunD)
        lines.push({ akunId: akunD.id, debit: +debit.toFixed(2), kredit: 0, unitBiayaId: unitForLine, asetId: asetForLine });
      if (akunK)
        lines.push({ akunId: akunK.id, debit: 0, kredit: +debit.toFixed(2), unitBiayaId: unitForLine, asetId: asetForLine });
    } else if (kredit > 0) {
      if (!debitAkunId) issues.push("Kategori belum terhubung debitAkun.");
      if (!kreditAkunId) issues.push("Kategori belum terhubung kreditAkun.");

      const akunD = await getAkun(debitAkunId);
      const akunK = await getAkun(kreditAkunId);
      if (debitAkunId && !akunD) issues.push("Akun debit tidak ditemukan.");
      if (kreditAkunId && !akunK) issues.push("Akun kredit tidak ditemukan.");

      if (akunK)
        lines.push({ akunId: akunK.id, debit: 0, kredit: +kredit.toFixed(2), unitBiayaId: unitForLine, asetId: asetForLine });
      if (akunD)
        lines.push({ akunId: akunD.id, debit: +kredit.toFixed(2), kredit: 0, unitBiayaId: unitForLine, asetId: asetForLine });
    } else {
      issues.push("Nilai jurnal tidak valid.");
    }

    const canPost = lines.length === 2 && issues.length === 0;
    const header = {
      tanggal: r.tanggal,
      ref: r.ref || `GL/JURNAL/${r.id}`,
      uraian: r.uraian || (r.kategori ? `Jurnal ${r.kategori.nama}` : "Jurnal Biaya"),
      sumber: `JURNAL:${r.id}`,
    };
    return { canPost, issues, header, lines };
  }

  // PENYUSUTAN (tanpa perubahan)
  // @ts-ignore
  const p = await prisma.penyusutan.findUnique({
    where: { id: item.id },
    include: { aset: { select: { id: true, nama: true, akunAkumulasiId: true } } },
  });
  if (!p) return { canPost: false, issues: ["NOT_FOUND"], header: null, lines: [] as any[] };

  const issues: string[] = [];
  const lines: any[] = [];

  const kreditAkunId = p.aset?.akunAkumulasiId || null;
  // @ts-ignore
  const kreditAkun = kreditAkunId ? await prisma.akun.findUnique({ where: { id: kreditAkunId } }) : null;
  if (!kreditAkunId) issues.push("Aset belum dihubungkan ke Akun Akumulasi (kredit).");
  if (kreditAkunId && !kreditAkun) issues.push("Akun akumulasi tidak ditemukan.");

  // @ts-ignore
  const bebanKategori = await prisma.biayaKategori.findFirst({
    where: {
      OR: [{ kode: { contains: "PENYUSUTAN" } }, { nama: { contains: "PENYUSUTAN" } }],
      tipe: "BIAYA",
      debitAkunId: { not: null },
    },
    select: { debitAkunId: true },
  });
  const debitAkunId = bebanKategori?.debitAkunId || null;
  // @ts-ignore
  const debitAkun = debitAkunId ? await prisma.akun.findUnique({ where: { id: debitAkunId } }) : null;
  if (!debitAkunId) issues.push("Tidak ditemukan Akun Beban Penyusutan.");
  if (debitAkunId && !debitAkun) issues.push("Akun beban penyusutan tidak ditemukan.");

  const amt = Number(p.beban || 0);
  if (amt <= 0) issues.push("Nilai penyusutan tidak valid.");

  if (debitAkun && kreditAkun && amt > 0) {
    lines.push({ akunId: debitAkun.id, debit: +amt.toFixed(2), kredit: 0, unitBiayaId: null, asetId: p.asetId || null });
    lines.push({ akunId: kreditAkun.id, debit: 0, kredit: +amt.toFixed(2), unitBiayaId: null, asetId: p.asetId || null });
  }

  const canPost = lines.length === 2 && issues.length === 0;
  const header = {
    tanggal: p.periode,
    ref: `GL/PENY/${p.id}`,
    uraian: `Penyusutan ${p.aset?.nama || "Aset"} (${new Date(p.periode).getFullYear()})`,
    sumber: `PENYUSUTAN:${p.id}`,
  };
  return { canPost, issues, header, lines };
}

export async function POST(req: Request) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json()) as { items: Item[] };
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "No items." }, { status: 400 });

  const result = {
    ok: true,
    posted: 0,
    skipped: 0,
    errors: [] as Array<{ type: string; id: number; message: string }>,
  };

  for (const it of items) {
    try {
      if (!(it && (it.type === "JURNAL" || it.type === "PENYUSUTAN") && Number.isFinite(it.id))) {
        result.errors.push({ type: String(it?.type || "?"), id: Number(it?.id || 0), message: "Item invalid" });
        continue;
      }
      if (await isPosted(it)) {
        result.skipped++;
        continue;
      }

      const pv = await buildPreview(it);
      if (!pv.canPost) {
        result.errors.push({ type: it.type, id: it.id, message: `Tidak bisa post: ${pv.issues.join("; ")}` });
        continue;
      }

      // @ts-ignore
      const created = await prisma.$transaction(async (tx: any) => {
        // ====== VOUCHER: generate nomor & set tanggal ======
        const voucherDate = new Date(pv.header!.tanggal as any);
        const voucherNo = await nextVoucherNo(tx, voucherDate, "VCH");

        // @ts-ignore
        const header = await tx.jurnalUmum.create({
          data: {
            tanggal: pv.header!.tanggal as any,
            ref: pv.header!.ref || null,
            uraian: pv.header!.uraian || null,
            sumber: pv.header!.sumber || null,
            // fields voucher
            voucherNo,
            voucherDate,
          },
        });

        for (const ln of pv.lines) {
          // @ts-ignore
          await tx.jurnalUmumLine.create({
            data: {
              headerId: header.id,
              akunId: ln.akunId,
              unitBiayaId: ln.unitBiayaId || null,
              asetId: ln.asetId || null,
              jurnalBiayaId: it.type === "JURNAL" ? it.id : null,
              penyusutanId: it.type === "PENYUSUTAN" ? it.id : null,
              debit: ln.debit,
              kredit: ln.kredit,
            },
          });
        }
        return header;
      });

      if (created?.id) result.posted++;
      else result.errors.push({ type: it.type, id: it.id, message: "Gagal membuat header." });
    } catch (e: any) {
      result.errors.push({ type: it.type, id: it.id, message: e?.message || "Error" });
    }
  }

  return NextResponse.json(result);
}
