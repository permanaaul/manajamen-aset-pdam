// app/api/kasbank/akun/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { JenisKasBank, TipeAkun } from "@prisma/client";

// helper
const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);

type GLBrief = { id: number; kode: string; nama: string };
type RowDB = {
  id: number;
  kode: string;
  nama: string;
  jenis: JenisKasBank;
  bank: string | null;
  noRek: string | null;
  pemilik: string | null;
  aktif: boolean;
  akunGLId: number | null;
  akunGL: GLBrief | null;
  saldoAwal: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const aktif = url.searchParams.get("aktif");
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get("size") || 20)));
    const skip = (page - 1) * size;

    const where: any = {};
    if (q) {
      where.OR = [
        { kode: { contains: q, mode: "insensitive" } },
        { nama: { contains: q, mode: "insensitive" } },
        { bank: { contains: q, mode: "insensitive" } },
        { noRek: { contains: q, mode: "insensitive" } },
      ];
    }
    if (aktif === "true") where.aktif = true;
    if (aktif === "false") where.aktif = false;

    // @ts-ignore
    const [count, rows] = await Promise.all([
      //@ts-ignore
      prisma.kasBankAkun.count({ where }),
      //@ts-ignore
      prisma.kasBankAkun.findMany({
        where,
        orderBy: [{ nama: "asc" }],
        skip,
        take: size,
        select: {
          id: true,
          kode: true,
          nama: true,
          jenis: true,
          bank: true,
          noRek: true,
          pemilik: true,
          aktif: true,
          akunGLId: true,
          akunGL: { select: { id: true, kode: true, nama: true } },
          saldoAwal: true,
        },
      }),
    ]);

    const out = (rows as RowDB[]).map((r: RowDB) => ({
      id: r.id,
      kode: r.kode,
      nama: r.nama,
      jenis: r.jenis,
      bank: r.bank,
      noRek: r.noRek,
      pemilik: r.pemilik,
      aktif: r.aktif,
      akunGLId: r.akunGLId,
      akunGL: r.akunGL,
      saldoAwal: toNum(r.saldoAwal),
    }));

    return NextResponse.json({ rows: out, count, page, size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // terima 'tipe' dari UI (CASH/BANK) → map ke enum JenisKasBank
    const jenis: JenisKasBank =
      String(body.tipe || "").toUpperCase() === "BANK" ? JenisKasBank.BANK : JenisKasBank.KAS;

    // dukung akunId ATAU akunKode
    let akunGLId: number | null = Number(body.akunId) || null;
    const akunKode: string = String(body.akunKode || "").trim();

    if (!akunGLId && akunKode) {
      // @ts-ignore
      const akun = await prisma.akun.findFirst({
        where: { kode: akunKode },
        select: { id: true, tipe: true, isPosting: true },
      });
      if (!akun) {
        return NextResponse.json({ error: "Akun GL (kode CoA) tidak ditemukan." }, { status: 400 });
      }
      // opsional: validasi tipe akun cash/bank = ASET & posting
      if (akun.tipe !== TipeAkun.ASET || !akun.isPosting) {
        return NextResponse.json(
          { error: "Akun GL harus akun ASET dan bersifat posting." },
          { status: 400 }
        );
      }
      akunGLId = akun.id;
    }

    const data = {
      kode: String(body.kode || "").trim(),
      nama: String(body.nama || "").trim(),
      jenis,
      bank: body.bankNama ? String(body.bankNama) : null,
      noRek: body.bankNo ? String(body.bankNo) : null,
      pemilik: body.bankCabang ? String(body.bankCabang) : null, // atau gunakan field 'cabang' jika kamu punya
      akunGLId: akunGLId!,
      saldoAwal: toNum(body.saldoAwal || 0),
      aktif: Boolean(body.aktif ?? true),
    };

    if (!data.kode || !data.nama || !data.akunGLId) {
      return NextResponse.json({ error: "kode/nama/akun GL wajib diisi." }, { status: 400 });
    }

    // validasi unik kode
    // @ts-ignore
    const exists = await prisma.kasBankAkun.findFirst({
      where: { kode: data.kode },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ error: "Kode akun kas/bank sudah dipakai." }, { status: 400 });
    }

    // @ts-ignore
    const created = await prisma.kasBankAkun.create({
      data,
      select: {
        id: true,
        kode: true,
        nama: true,
        jenis: true,
        akunGLId: true,
        akunGL: { select: { id: true, kode: true, nama: true } },
        saldoAwal: true,
        aktif: true,
      },
    });

    return NextResponse.json({ ok: true, akun: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
