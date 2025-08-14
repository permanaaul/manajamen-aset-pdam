import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { regeneratePenyusutanForAset } from "@/lib/penyusutan";
import type {
  MetodePenyusutan,
  GolonganDepresiasi,
} from "@prisma/client";

// GET /api/penyusutan/:asetId  -> ambil jadwal + ringkasan
export async function GET(
  _req: NextRequest,
  { params }: { params: { asetId: string } }
) {
  const asetId = Number(params.asetId);
  if (Number.isNaN(asetId)) {
    return NextResponse.json({ error: "asetId tidak valid" }, { status: 400 });
  }
  // @ts-ignore
  const aset = await prisma.aset.findUnique({ where: { id: asetId } });
  if (!aset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });
  // @ts-ignore
  const rows = await prisma.penyusutan.findMany({
    where: { asetId },
    orderBy: { periode: "asc" },
  });

  // ringkasan singkat (berdasarkan baris terakhir jika ada)
  const last = rows.at(-1);
  const ringkas = {
    metode: last?.metode ?? aset.metodePenyusutan ?? null,
    tarifTerakhir: last ? Number(last.tarif) : null,
    nilaiAwal: last ? Number(rows[0].nilaiAwal) : Number(aset.nilai),
    akumulasi: last ? Number(last.akumulasi) : 0,
    nilaiBuku: last ? Number(last.nilaiAkhir) : Number(aset.nilai),
    tahunMulai:
      (aset.mulaiPenyusutan
        ? new Date(aset.mulaiPenyusutan).getFullYear()
        : aset.tanggalOperasi
        ? new Date(aset.tanggalOperasi).getFullYear()
        : aset.tahun) ?? null,
    umur: aset.umurManfaatTahun ?? null,
    nilaiResidu: aset.nilaiResidu ? Number(aset.nilaiResidu) : 0,
  };

  return NextResponse.json({ aset, rows, ringkas });
}

// PUT /api/penyusutan/:asetId  -> update parameter penyusutan aset & regenerate
export async function PUT(
  req: NextRequest,
  { params }: { params: { asetId: string } }
) {
  const asetId = Number(params.asetId);
  if (Number.isNaN(asetId)) {
    return NextResponse.json({ error: "asetId tidak valid" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const payload: {
    metodePenyusutan?: MetodePenyusutan | null;
    umurManfaatTahun?: number | null;
    nilaiResidu?: number | null;
    golonganDepresiasi?: GolonganDepresiasi | null;
    tanggalOperasi?: Date | null;
    mulaiPenyusutan?: Date | null;
  } = {};

  if (body.metodePenyusutan === "GARIS_LURUS" || body.metodePenyusutan === "SALDO_MENURUN")
    payload.metodePenyusutan = body.metodePenyusutan;

  if (body.umurManfaatTahun != null) {
    const n = Number(body.umurManfaatTahun);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "Umur manfaat tidak valid" }, { status: 400 });
    }
    payload.umurManfaatTahun = Math.floor(n);
  }

  if (body.nilaiResidu != null) {
    const n = Number(body.nilaiResidu);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Nilai residu tidak valid" }, { status: 400 });
    }
    payload.nilaiResidu = n;
  }

  if (typeof body.golonganDepresiasi === "string")
    payload.golonganDepresiasi = body.golonganDepresiasi as GolonganDepresiasi;

  if (body.tanggalOperasi) payload.tanggalOperasi = new Date(body.tanggalOperasi);
  if (body.mulaiPenyusutan) payload.mulaiPenyusutan = new Date(body.mulaiPenyusutan);
  // @ts-ignore
  const aset = await prisma.aset.update({ where: { id: asetId }, data: payload });

  // regenerate jadwal
  await regeneratePenyusutanForAset(aset.id);

  return NextResponse.json({ ok: true });
}
