// app/api/hublang/workorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** =======================
 * GET /api/hublang/workorder
 * q, status, prioritas, page, size
 * ======================= */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const status = url.searchParams.get("status") || undefined;
    const prioritas = url.searchParams.get("prioritas") || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "20", 10)));
    const skip = (page - 1) * size;

    const where: any = {};
    if (status) where.status = status;
    if (prioritas) where.prioritas = prioritas;
    if (q) {
      where.OR = [
        { noWo: { contains: q } },
        { jenis: { contains: q } },
        { deskripsi: { contains: q } },
        { pelanggan: { nama: { contains: q } } },
        { pelanggan: { kode: { contains: q } } },
        { sambungan: { noSambungan: { contains: q } } },
      ];
    }

    // --- Query dengan *multi*-fallback supaya tidak 500 walau kolom/relasi belum ada
    let rowsRaw: any[] = [];
    try {
      // 1) Lengkap: kolom baru + petugas
      // @ts-ignore
      rowsRaw = await prisma.hblWorkOrder.findMany({
        where,
        orderBy: { tanggalBuat: "desc" },
        skip,
        take: size,
        select: {
          id: true,
          noWo: true,
          tanggalBuat: true,
          status: true,
          prioritas: true,
          jenis: true,
          deskripsi: true,
          targetTanggal: true,
          selesaiTanggal: true,
          jenisPekerjaan: true,      // ← tipe
          biayaMaterialRp: true,
          biayaJasaRp: true,

          pelanggan: { select: { id: true, nama: true } },
          sambungan: { select: { id: true, noSambungan: true } },
          petugas: { select: { id: true, nama: true } }, // <- bisa tidak ada di schema
        },
      });
    } catch {
      try {
        // 2) Tanpa petugas, kolom baru tetap dicoba
        // @ts-ignore
        rowsRaw = await prisma.hblWorkOrder.findMany({
          where,
          orderBy: { tanggalBuat: "desc" },
          skip,
          take: size,
          select: {
            id: true,
            noWo: true,
            tanggalBuat: true,
            status: true,
            prioritas: true,
            jenis: true,
            deskripsi: true,
            targetTanggal: true,
            selesaiTanggal: true,
            jenisPekerjaan: true,
            biayaMaterialRp: true,
            biayaJasaRp: true,

            pelanggan: { select: { id: true, nama: true } },
            sambungan: { select: { id: true, noSambungan: true } },
          },
        });
      } catch {
        // 3) Fallback paling aman (schema lama)
        // @ts-ignore
        rowsRaw = await prisma.hblWorkOrder.findMany({
          where,
          orderBy: { tanggalBuat: "desc" },
          skip,
          take: size,
          select: {
            id: true,
            noWo: true,
            tanggalBuat: true,
            status: true,
            prioritas: true,
            jenis: true,
            deskripsi: true,
            targetTanggal: true,
            selesaiTanggal: true,

            pelanggan: { select: { id: true, nama: true } },
            sambungan: { select: { id: true, noSambungan: true } },
          },
        });
      }
    }

    // @ts-ignore
    const count = await prisma.hblWorkOrder.count({ where });

    const rows = rowsRaw.map((r: any) => ({
      id: r.id,
      noWo: r.noWo,
      tanggalBuat: r.tanggalBuat ? r.tanggalBuat.toISOString() : null,
      status: r.status,
      prioritas: r.prioritas,
      jenis: r.jenis,
      deskripsi: r.deskripsi,
      targetTanggal: r.targetTanggal ? r.targetTanggal.toISOString() : null,
      selesaiTanggal: r.selesaiTanggal ? r.selesaiTanggal.toISOString() : null,
      // supaya cocok dengan UI: kirim sebagai "tipe"
      tipe: r.jenisPekerjaan ?? null,
      // Decimal -> number (kalau ada)
      // @ts-ignore
      biayaMaterialRp: r.biayaMaterialRp != null ? Number(r.biayaMaterialRp) : null,
      // @ts-ignore
      biayaJasaRp: r.biayaJasaRp != null ? Number(r.biayaJasaRp) : null,

      pelanggan: r.pelanggan ?? null,
      sambungan: r.sambungan ?? null,
      petugas: r.petugas ?? null, // bisa undefined kalau di-fallback
    }));

    return NextResponse.json({ rows, count, page, size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/** Penomoran otomatis: WO-YYYYMM-00001 */
async function nextWoNumber() {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = `HBL-WO-${yyyymm}`;
  // @ts-ignore
  const counter = await prisma.sequenceCounter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  const n = String(counter.value).padStart(5, "0");
  return `WO-${yyyymm}-${n}`;
}

/** =======================
 * POST /api/hublang/workorder
 * body: { jenis, deskripsi?, prioritas?, status?, pelangganId?, petugasId?, targetTanggal?, tipe?, biayaMaterialRp?, biayaJasaRp? }
 * ======================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      jenis,
      deskripsi = null,
      prioritas = "NORMAL",
      status = "DRAFT",
      pelangganId = null,
      petugasId = null,
      targetTanggal = null,
      tipe = null, // enum JenisPekerjaanPemeliharaan
      biayaMaterialRp = null,
      biayaJasaRp = null,
    } = body || {};

    if (!jenis || typeof jenis !== "string") {
      return NextResponse.json({ error: "Jenis wajib diisi" }, { status: 400 });
    }

    const noWo = await nextWoNumber();

    const baseData: any = {
      noWo,
      tanggalBuat: new Date(),
      jenis,
      deskripsi,
      prioritas,
      status,
      pelangganId: pelangganId ?? undefined,
      petugasId: petugasId ?? undefined,
      targetTanggal: targetTanggal ? new Date(String(targetTanggal)) : undefined,
      // @ts-ignore
      biayaMaterialRp: biayaMaterialRp ?? undefined,
      // @ts-ignore
      biayaJasaRp: biayaJasaRp ?? undefined,
    };

    // coba tulis dengan kolom enum (jika ada)
    try {
      // @ts-ignore
      const created = await prisma.hblWorkOrder.create({
        data: {
          ...baseData,
          ...(tipe ? { jenisPekerjaan: tipe } : {}),
        },
        select: { id: true, noWo: true },
      });
      return NextResponse.json({ id: created.id, noWo: created.noWo });
    } catch {
      // fallback tanpa kolom enum
      // @ts-ignore
      const created2 = await prisma.hblWorkOrder.create({
        data: baseData,
        select: { id: true, noWo: true },
      });
      return NextResponse.json({ id: created2.id, noWo: created2.noWo });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
