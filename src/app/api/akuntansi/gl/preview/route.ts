// src/app/api/akuntansi/gl/preview/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

type SourceType = "jurnal" | "penyusutan";

export async function GET(req: Request) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "").toLowerCase() as SourceType;
  const id = Number(searchParams.get("id") || "");

  if (!["jurnal", "penyusutan"].includes(type)) {
    return NextResponse.json({ error: "Param 'type' invalid." }, { status: 400 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Param 'id' invalid." }, { status: 400 });
  }

  if (type === "jurnal") {
    // ---- Ambil JurnalBiaya + kategori & alokasi
    // @ts-ignore
    const r = await prisma.jurnalBiaya.findUnique({
      where: { id },
      include: {
        kategori: {
          select: { id: true, kode: true, nama: true, debitAkunId: true, kreditAkunId: true },
        },
        // perlu asetId agar bisa ditempel ke voucher
        alokasi: { select: { id: true, unitBiayaId: true, asetId: true } },
        aset: { select: { id: true, nama: true } },
        // fallback: bila jurnal ini terhubung ke penyusutan, ambil aset dari sana
        penyusutan: { select: { asetId: true } },
      },
    });
    if (!r) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const issues: string[] = [];
    const lines: any[] = [];

    // === Unit (ambil jika alokasi hanya 1) ===
    const alokasiUnits = (r.alokasi || [])
      .map((a: { unitBiayaId: number | null | undefined }) => a.unitBiayaId ?? null)
      .filter((v: number | null): v is number => typeof v === "number");
    const unitForLine = alokasiUnits.length === 1 ? alokasiUnits[0] : null;
    if (alokasiUnits.length > 1) {
      issues.push("Alokasi memiliki >1 unit; jumlah tidak dipecah per unit. Akan disimpan tanpa unit.");
    }

    // === Aset (prioritas: jurnal.asetId -> penyusutan.asetId -> satu alokasi.asetId) ===
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

    // CASE A: dua sisi terisi
    if (debit > 0 && kredit > 0) {
      if (!debitAkunId) issues.push("Kategori belum terhubung ke 'debitAkun' (akun biaya).");
      if (!kreditAkunId) issues.push("Kategori belum terhubung ke 'kreditAkun' (akun lawan).");

      const akunD = await getAkun(debitAkunId);
      const akunK = await getAkun(kreditAkunId);
      if (debitAkunId && !akunD) issues.push("Akun debit tidak ditemukan.");
      if (kreditAkunId && !akunK) issues.push("Akun kredit tidak ditemukan.");

      if (akunD) {
        lines.push({
          akunId: akunD.id,
          akun: { kode: akunD.kode, nama: akunD.nama },
          debit: +debit.toFixed(2),
          kredit: 0,
          unitBiayaId: unitForLine,
          asetId: asetForLine,
        });
      }
      if (akunK) {
        lines.push({
          akunId: akunK.id,
          akun: { kode: akunK.kode, nama: akunK.nama },
          debit: 0,
          kredit: +kredit.toFixed(2),
          unitBiayaId: unitForLine,
          asetId: asetForLine,
        });
      }
    }
    // CASE B: hanya debit
    else if (debit > 0) {
      if (!debitAkunId) issues.push("Kategori belum terhubung ke 'debitAkun' (akun biaya).");
      if (!kreditAkunId) issues.push("Kategori belum terhubung ke 'kreditAkun' (akun lawan).");

      const akunD = await getAkun(debitAkunId);
      const akunK = await getAkun(kreditAkunId);
      if (debitAkunId && !akunD) issues.push("Akun debit tidak ditemukan.");
      if (kreditAkunId && !akunK) issues.push("Akun kredit tidak ditemukan.");

      if (akunD) {
        lines.push({
          akunId: akunD.id,
          akun: { kode: akunD.kode, nama: akunD.nama },
          debit: +debit.toFixed(2),
          kredit: 0,
          unitBiayaId: unitForLine,
          asetId: asetForLine,
        });
      }
      if (akunK) {
        lines.push({
          akunId: akunK.id,
          akun: { kode: akunK.kode, nama: akunK.nama },
          debit: 0,
          kredit: +debit.toFixed(2),
          unitBiayaId: unitForLine,
          asetId: asetForLine,
        });
      }
    }
    // CASE C: hanya kredit
    else if (kredit > 0) {
      if (!debitAkunId) issues.push("Kategori belum terhubung ke 'debitAkun' (akun biaya).");
      if (!kreditAkunId) issues.push("Kategori belum terhubung ke 'kreditAkun' (akun lawan).");

      const akunD = await getAkun(debitAkunId);
      const akunK = await getAkun(kreditAkunId);
      if (debitAkunId && !akunD) issues.push("Akun debit tidak ditemukan.");
      if (kreditAkunId && !akunK) issues.push("Akun kredit tidak ditemukan.");

      if (akunK) {
        lines.push({
          akunId: akunK.id,
          akun: { kode: akunK.kode, nama: akunK.nama },
          debit: 0,
          kredit: +kredit.toFixed(2),
          unitBiayaId: unitForLine,
          asetId: asetForLine,
        });
      }
      if (akunD) {
        lines.push({
          akunId: akunD.id,
          akun: { kode: akunD.kode, nama: akunD.nama },
          debit: +kredit.toFixed(2),
          kredit: 0,
          unitBiayaId: unitForLine,
          asetId: asetForLine,
        });
      }
    } else {
      issues.push("Nominal debit/kredit tidak valid.");
    }

    const canPost = lines.length === 2 && issues.length === 0;

    const header = {
      tanggal: r.tanggal,
      ref: r.ref || `GL/JURNAL/${r.id}`,
      uraian: r.uraian || (r.kategori ? `Jurnal ${r.kategori.nama}` : "Jurnal Biaya"),
      sumber: `JURNAL:${r.id}`,
    };

    return NextResponse.json({ type: "JURNAL", id: r.id, canPost, issues, header, lines });
  }

  // ---- type === "penyusutan"
  // @ts-ignore
  const p = await prisma.penyusutan.findUnique({
    where: { id },
    include: { aset: { select: { id: true, nama: true, akunAkumulasiId: true } } },
  });
  if (!p) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const issues: string[] = [];
  const lines: any[] = [];

  // akun kredit (akumulasi) dari aset
  const kreditAkunId = p.aset?.akunAkumulasiId || null;
  if (!kreditAkunId) issues.push("Aset belum dihubungkan ke Akun Akumulasi Penyusutan (kredit).");
  // @ts-ignore
  const kreditAkun = kreditAkunId ? await prisma.akun.findUnique({ where: { id: kreditAkunId } }) : null;
  if (kreditAkunId && !kreditAkun) issues.push("Akun akumulasi tidak ditemukan.");

  // akun beban debit via kategori “penyusutan” (mapping)
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
  if (!debitAkunId) issues.push("Tidak ditemukan Akun Beban Penyusutan (mapping kategori).");
  if (debitAkunId && !debitAkun) issues.push("Akun beban penyusutan tidak ditemukan.");

  const amt = Number(p.beban || 0);
  if (amt <= 0) issues.push("Nilai penyusutan (beban) tidak valid.");

  if (debitAkun && kreditAkun && amt > 0) {
    lines.push({
      akunId: debitAkun.id,
      akun: { kode: debitAkun.kode, nama: debitAkun.nama },
      debit: +amt.toFixed(2),
      kredit: 0,
      unitBiayaId: null,
      asetId: (p as any).asetId || null,
    });
    lines.push({
      akunId: kreditAkun.id,
      akun: { kode: kreditAkun.kode, nama: kreditAkun.nama },
      debit: 0,
      kredit: +amt.toFixed(2),
      unitBiayaId: null,
      asetId: (p as any).asetId || null,
    });
  }

  const canPost = lines.length === 2 && issues.length === 0;
  const header = {
    tanggal: p.periode,
    ref: `GL/PENY/${p.id}`,
    uraian: `Penyusutan ${p.aset?.nama || "Aset"} (${new Date(p.periode).toLocaleString("id-ID", {
      month: "long",
      year: "numeric",
    })})`,
    sumber: `PENYUSUTAN:${p.id}`,
  };

  return NextResponse.json({ type: "PENYUSUTAN", id: p.id, canPost, issues, header, lines });
}
