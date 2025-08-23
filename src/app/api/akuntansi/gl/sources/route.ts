// src/app/api/akuntansi/gl/sources/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

type SourceType = "jurnal" | "penyusutan";
type StatusType = "posted" | "unposted";

function toDate(d?: string | null): Date | null {
  if (!d) return null;
  // "YYYY-MM-DD" → local midnight
  return new Date(`${d}T00:00:00`);
}

// Bentuk item untuk response
type JurnalItem = {
  type: "JURNAL";
  id: number;
  tanggal: Date;
  ref: string | null;
  uraian: string | null;
  kategori: { id: number; kode: string; nama: string } | null;
  debit: number;
  kredit: number;
  alokasiCount: number;
  posted: boolean;
  /** ⬅️ dipakai di UI untuk menyatukan DR/CR penyusutan jadi satu baris nominal */
  penyusutanId?: number | null;
};

type PenyusutanItem = {
  type: "PENYUSUTAN";
  id: number;
  periode: Date;
  aset: { id: number; nia: string; nama: string } | null;
  beban: number;
  posted: boolean;
};

export async function GET(req: Request) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "jurnal").toLowerCase() as SourceType;
  const status = (searchParams.get("status") || "") as StatusType | "";
  const from = toDate(searchParams.get("from"));
  const to = toDate(searchParams.get("to"));
  const q = (searchParams.get("q") || "").trim();

  if (!["jurnal", "penyusutan"].includes(type)) {
    return NextResponse.json({ error: "Param 'type' invalid." }, { status: 400 });
  }
  if (status && !["posted", "unposted"].includes(status)) {
    return NextResponse.json({ error: "Param 'status' invalid." }, { status: 400 });
  }

  if (type === "jurnal") {
    // ===== Ambil JurnalBiaya =====
    const where: any = {};
    if (from || to) {
      where.tanggal = {};
      if (from) where.tanggal.gte = from;
      if (to) where.tanggal.lte = to;
    }
    if (q) {
      where.OR = [
        { ref: { contains: q } },
        { uraian: { contains: q } },
        { kategori: { nama: { contains: q } } },
        { kategori: { kode: { contains: q } } },
      ];
    }

    // NB: Prisma akan mengembalikan semua kolom skalar (termasuk penyusutanId)
    // meskipun kita pakai `include` untuk relasi.
    // @ts-ignore
    const rows: any[] = await prisma.jurnalBiaya.findMany({
      where,
      orderBy: [{ tanggal: "asc" }, { id: "asc" }],
      include: {
        // @ts-ignore
        kategori: {
          select: { id: true, kode: true, nama: true, debitAkunId: true, kreditAkunId: true },
        },
        alokasi: { select: { id: true, unitBiayaId: true } },
      },
      take: 500,
    });

    const ids: number[] = rows.map((r: any) => r.id as number);

    // cek sudah diposting di GL?
    // @ts-ignore
    const glLinks: Array<{ jurnalBiayaId: number | null }> = await prisma.jurnalUmumLine.findMany({
      where: { jurnalBiayaId: { in: ids } },
      select: { jurnalBiayaId: true },
    });
    const postedSet = new Set(
      glLinks.map((g: { jurnalBiayaId: number | null }) => g.jurnalBiayaId!).filter(Boolean) as number[]
    );

    let items: JurnalItem[] = rows.map((r: any): JurnalItem => ({
      type: "JURNAL",
      id: r.id as number,
      tanggal: r.tanggal as Date,
      ref: (r.ref ?? null) as string | null,
      uraian: (r.uraian ?? null) as string | null,
      kategori: r.kategori
        ? { id: r.kategori.id as number, kode: r.kategori.kode as string, nama: r.kategori.nama as string }
        : null,
      debit: Number(r.debit || 0),
      kredit: Number(r.kredit || 0),
      alokasiCount: Array.isArray(r.alokasi) ? r.alokasi.length : 0,
      posted: postedSet.has(r.id as number),
      // ⬇️ kirimkan penyusutanId agar UI bisa menggabungkan debit & kredit pasangan penyusutan
      penyusutanId: (r as any)?.penyusutanId ?? null,
    }));

    if (status === "posted") items = items.filter((i: JurnalItem) => i.posted);
    if (status === "unposted") items = items.filter((i: JurnalItem) => !i.posted);

    return NextResponse.json(items);
  }

  // ===== type === "penyusutan" =====
  const whereP: any = {};
  if (from || to) {
    whereP.periode = {};
    if (from) whereP.periode.gte = from;
    if (to) whereP.periode.lte = to;
  }
  if (q) {
    // cari lewat nama aset
    whereP.aset = { nama: { contains: q } };
  }

  // @ts-ignore
  const rows: any[] = await prisma.penyusutan.findMany({
    where: whereP,
    orderBy: [{ periode: "asc" }, { id: "asc" }],
    include: { aset: { select: { id: true, nia: true, nama: true, akunAkumulasiId: true } } },
    take: 500,
  });

  const ids: number[] = rows.map((r: any) => r.id as number);

  // @ts-ignore
  const glLinks: Array<{ penyusutanId: number | null }> = await prisma.jurnalUmumLine.findMany({
    where: { penyusutanId: { in: ids } },
    select: { penyusutanId: true },
  });
  const postedSet = new Set(
    glLinks.map((g: { penyusutanId: number | null }) => g.penyusutanId!).filter(Boolean) as number[]
  );

  let items: PenyusutanItem[] = rows.map((r: any): PenyusutanItem => ({
    type: "PENYUSUTAN",
    id: r.id as number,
    periode: r.periode as Date,
    aset: r.aset ? { id: r.aset.id as number, nia: r.aset.nia as string, nama: r.aset.nama as string } : null,
    beban: Number(r.beban || 0),
    posted: postedSet.has(r.id as number),
  }));

  if (status === "posted") items = items.filter((i: PenyusutanItem) => i.posted);
  if (status === "unposted") items = items.filter((i: PenyusutanItem) => !i.posted);

  return NextResponse.json(items);
}
