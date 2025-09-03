// app/api/pemeliharaan/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/* helpers */
const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);

function mapJenisPekerjaan(s?: string | null) {
  const x = (s || "").toUpperCase();
  const allowed = [
    "INSPEKSI", "PELUMASAN", "KALIBRASI", "GANTI_SPAREPART",
    "PERBAIKAN_RINGAN", "PERBAIKAN_BESAR", "OVERHAUL", "TESTING",
  ];
  return allowed.includes(x) ? x : null;
}
function mapStrategi(s?: string | null) {
  const x = (s || "").toUpperCase();
  const allowed = ["PREVENTIF", "KOREKTIF", "PREDIKTIF"];
  return allowed.includes(x) ? x : null;
}

/** Tipe minimal untuk baris list pemeliharaan (sesuai SELECT) */
type Row = {
  id: number;
  tanggal: Date | null;
  pelaksana: string | null;
  jenis: string | null;
  status: string | null;
  biaya: unknown;
  catatan: string | null;
  jenisPekerjaan: string | null;
  strategi: string | null;
  aset: { id: number; nia: string; nama: string } | null;
  _count: { items: number; stokLines: number };
};

/* =========================
 * GET /api/pemeliharaan
 * q, status, asetId, jenisPekerjaan, strategi, dateFrom, dateTo, page, size
 * ========================= */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "").trim();
    const asetId = Number(url.searchParams.get("asetId") || 0) || undefined;
    const jenisPekerjaan = mapJenisPekerjaan(url.searchParams.get("jenisPekerjaan"));
    const strategi = mapStrategi(url.searchParams.get("strategi"));

    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo   = url.searchParams.get("dateTo");

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "20", 10)));
    const skip = (page - 1) * size;

    const where: any = {};
    if (q) {
      where.OR = [
        { pelaksana: { contains: q, mode: "insensitive" } },
        { catatan:   { contains: q, mode: "insensitive" } },
        {
          aset: {
            OR: [
              { nia:  { contains: q, mode: "insensitive" } },
              { nama: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ];
    }
    if (status) where.status = { contains: status, mode: "insensitive" };
    if (asetId) where.asetId = asetId;
    if (jenisPekerjaan) where.jenisPekerjaan = jenisPekerjaan;
    if (strategi) where.strategi = strategi;
    if (dateFrom || dateTo) {
      where.tanggal = {};
      if (dateFrom) where.tanggal.gte = new Date(`${dateFrom}T00:00:00`);
      if (dateTo)   where.tanggal.lte = new Date(`${dateTo}T23:59:59`);
    }

    const [count, rowsRaw] = await Promise.all([
        //@ts-ignore
      prisma.pemeliharaan.count({ where }),
      //@ts-ignore
      prisma.pemeliharaan.findMany({
        where,
        orderBy: [{ tanggal: "desc" }, { id: "desc" }],
        skip,
        take: size,
        select: {
          id: true,
          tanggal: true,
          pelaksana: true,
          jenis: true,
          status: true,
          biaya: true,
          catatan: true,
          jenisPekerjaan: true,
          strategi: true,
          aset: { select: { id: true, nia: true, nama: true } },
          _count: { select: { items: true, stokLines: true } },
        },
      }),
    ]);

    const rows = rowsRaw as Row[];

    const out = rows.map((r: Row) => ({
      id: r.id,
      no: `PM-${String(r.id).padStart(5, "0")}`,
      tanggal: r.tanggal ? r.tanggal.toISOString() : null,
      pelaksana: r.pelaksana,
      jenis: r.jenis,
      status: r.status,
      biaya: toNum(r.biaya),
      catatan: r.catatan,
      jenisPekerjaan: r.jenisPekerjaan ?? null,
      strategi: r.strategi ?? null,
      aset: r.aset ? { id: r.aset.id, nia: r.aset.nia, nama: r.aset.nama } : null,
      jumlahItem: r._count.items || r._count.stokLines || 0,
    }));

    return NextResponse.json({ rows: out, count, page, size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/* =========================
 * POST /api/pemeliharaan
 * body: { asetId, tanggal, pelaksana?, jenis?, status?, biaya?, catatan?, jenisPekerjaan?, strategi?, downtimeJam? }
 * ========================= */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const asetId = Number(b?.asetId || 0);
    const tanggal = b?.tanggal ? new Date(b.tanggal) : new Date();

    if (!asetId) {
      return NextResponse.json({ error: "asetId wajib" }, { status: 400 });
    }
    //@ts-ignore
    const aset = await prisma.aset.findUnique({ where: { id: asetId }, select: { id: true } });
    if (!aset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });
    //@ts-ignore
    const created = await prisma.pemeliharaan.create({
      data: {
        asetId,
        tanggal,
        pelaksana: b?.pelaksana ?? "-",
        jenis: (b?.jenis || "PEMELIHARAAN").toString(),
        status: (b?.status || "OPEN").toString(),
        biaya: b?.biaya != null ? Number(b.biaya) : null,
        catatan: b?.catatan ?? null,
        jenisPekerjaan: mapJenisPekerjaan(b?.jenisPekerjaan),
        strategi: mapStrategi(b?.strategi),
        downtimeJam: b?.downtimeJam != null ? Number(b.downtimeJam) : null,
      },
      select: { id: true },
    });

    return NextResponse.json(
      { id: created.id, no: `PM-${String(created.id).padStart(5, "0")}` },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
