// app/api/akuntansi/jurnal/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

type Params = { params: { id: string } };

// util: parse & round 2 desimal (terima "23.730.468,75" juga)
function to2dp(v: any): number {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

// GET detail
export async function GET(_: Request, { params }: Params) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    // @ts-ignore
    const row = await prisma.jurnalBiaya.findUnique({
      where: { id },
      include: { kategori: true, alokasi: { include: { unitBiaya: true, aset: true } } },
    });
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// PATCH update
export async function PATCH(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    const body = await req.json();

    const data: any = {};
    if (body.tanggal) data.tanggal = new Date(`${body.tanggal}T00:00:00`);
    if (body.kategoriId) data.kategoriId = Number(body.kategoriId);
    if (typeof body.ref === "string") data.ref = body.ref || null;
    if (typeof body.uraian === "string") data.uraian = body.uraian || null;
    if (typeof body.debit !== "undefined") data.debit = to2dp(body.debit);
    if (typeof body.kredit !== "undefined") data.kredit = to2dp(body.kredit);
    if (body.tipe) data.tipe = body.tipe; // "OPEX"/"CAPEX" kalau mau diubah

    // Jika tidak ada perubahan alokasi:
    if (!Array.isArray(body.alokasi)) {
      // @ts-ignore
      const updated = await prisma.jurnalBiaya.update({
        where: { id },
        data,
      });
      return NextResponse.json(updated);
    }

    // Jika ada alokasi baru -> replace all (hapus & buat ulang) dalam transaksi
    const alokasis = (body.alokasi as any[]).map((a) => ({
      unitBiayaId: a?.unitBiayaId ?? null,
      asetId: a?.asetId ?? null,
      persen: a?.persen ?? null,
      jumlah: a?.jumlah ?? null,
    }));

    // @ts-ignore
    const [_, updated] = await prisma.$transaction([
      // @ts-ignore
      prisma.jurnalBiayaAlokasi.deleteMany({ where: { jurnalId: id } }),
      // @ts-ignore
      prisma.jurnalBiaya.update({
        where: { id },
        data: {
          ...data,
          alokasi: { create: alokasis },
        },
        include: { alokasi: true },
      }),
    ]);

    return NextResponse.json(updated);
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    return NextResponse.json({ error: err.message || "Server error", code: (err as any)?.code }, { status: 500 });
  }
}

// DELETE jurnal + alokasinya
export async function DELETE(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    // @ts-ignore
    await prisma.jurnalBiaya.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    return NextResponse.json({ error: err.message || "Server error", code: (err as any)?.code }, { status: 500 });
  }
}
