// app/api/hublang/workorder/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    let data: any;

    try {
      // 1) Lengkap: kolom baru + petugas
      // @ts-ignore
      data = await prisma.hblWorkOrder.findUnique({
        where: { id },
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
          pelanggan: { select: { id: true, kode: true, nama: true } },
          sambungan: { select: { id: true, noSambungan: true } },
          petugas: { select: { id: true, nama: true } }, // <- bisa tak ada di schema
        },
      });
    } catch {
      try {
        // 2) Tanpa petugas
        // @ts-ignore
        data = await prisma.hblWorkOrder.findUnique({
          where: { id },
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
            pelanggan: { select: { id: true, kode: true, nama: true } },
            sambungan: { select: { id: true, noSambungan: true } },
          },
        });
      } catch {
        // 3) Paling aman (schema lama)
        // @ts-ignore
        data = await prisma.hblWorkOrder.findUnique({
          where: { id },
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
            pelanggan: { select: { id: true, kode: true, nama: true } },
            sambungan: { select: { id: true, noSambungan: true } },
          },
        });
      }
    }

    if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

    const out = {
      id: data.id,
      noWo: data.noWo,
      tanggalBuat: data.tanggalBuat ? data.tanggalBuat.toISOString() : null,
      status: data.status,
      prioritas: data.prioritas,
      tipe: data.jenisPekerjaan ?? null, // untuk UI
      jenis: data.jenis ?? null,
      deskripsi: data.deskripsi ?? null,
      targetTanggal: data.targetTanggal ? data.targetTanggal.toISOString() : null,
      selesaiTanggal: data.selesaiTanggal ? data.selesaiTanggal.toISOString() : null,
      // Decimal -> number
      // @ts-ignore
      biayaMaterialRp: data.biayaMaterialRp != null ? Number(data.biayaMaterialRp) : null,
      // @ts-ignore
      biayaJasaRp: data.biayaJasaRp != null ? Number(data.biayaJasaRp) : null,
      pelanggan: data.pelanggan ?? null,
      sambungan: data.sambungan ?? null,
      petugas: data.petugas ?? null,
    };

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const body = await req.json();

    // tombol "Tandai Selesai"
    if (body?.doneNow) {
      // @ts-ignore
      const updated = await prisma.hblWorkOrder.update({
        where: { id },
        data: { status: "DONE", selesaiTanggal: new Date() },
        select: { id: true, status: true, selesaiTanggal: true },
      });
      return NextResponse.json({
        ...updated,
        selesaiTanggal: updated.selesaiTanggal?.toISOString() ?? null,
      });
    }

    const allowed: any = {};
    ["status", "prioritas", "jenis", "deskripsi"].forEach((k) => {
      if (k in body) allowed[k] = body[k] ?? null;
    });
    if ("targetTanggal" in body) {
      allowed.targetTanggal = body.targetTanggal
        ? new Date(String(body.targetTanggal))
        : null;
    }
    if ("tipe" in body) {
      allowed.jenisPekerjaan = body.tipe || null; // map ke kolom enum
    }
    if ("biayaMaterialRp" in body) {
      // @ts-ignore
      allowed.biayaMaterialRp = body.biayaMaterialRp ?? null;
    }
    if ("biayaJasaRp" in body) {
      // @ts-ignore
      allowed.biayaJasaRp = body.biayaJasaRp ?? null;
    }
    ["pelangganId", "sambunganId", "petugasId"].forEach((k) => {
      if (k in body) allowed[k] = body[k] || null;
    });

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "tidak ada field yang diubah" }, { status: 400 });
    }

    // @ts-ignore
    const updated = await prisma.hblWorkOrder.update({
      where: { id },
      data: allowed,
      select: { id: true, status: true, prioritas: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  // @ts-ignore
  await prisma.hblWorkOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
