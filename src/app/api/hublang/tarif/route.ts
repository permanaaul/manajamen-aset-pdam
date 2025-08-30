// app/api/hublang/tarif/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from "@/lib/prisma";

// ===== CREATE =====
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      kode, nama, diameterMm = null,
      minChargeM3 = null, minChargeRp = null,
      biayaAdminRp = '0', pembulatanDenom = 1,
      pajakAktif = false, pajakPersen = null,
      subsidiCatatan = null, subsidiRp = null,
      gracePeriodHari = 10, skemaDenda = null,
      dendaFlatPerHariRp = null, dendaPersenPerBulan = null, dendaBertahapJson = null,
      sp1Hari = 15, sp2Hari = 30, sp3Hari = 45,
      biayaBukaTutupRp = null, biayaPasangKembaliRp = null,
      berlakuDari = null, berlakuSampai = null,
      blok = [],
    } = body ?? {};

    if (!kode || !nama) {
      return NextResponse.json({ error: 'kode & nama wajib' }, { status: 400 });
    }
    if ((minChargeM3 && minChargeRp) || (!minChargeM3 && !minChargeRp)) {
      return NextResponse.json({ error: 'Pilih salah satu: minChargeM3 ATAU minChargeRp' }, { status: 400 });
    }
    if (!Array.isArray(blok) || blok.length === 0) {
      return NextResponse.json({ error: 'blok tarif wajib diisi' }, { status: 400 });
    }

    // ——— enum sanitize
    const enumSkema =
      typeof skemaDenda === 'string' ? skemaDenda.toUpperCase() : skemaDenda;
    const skemaOk =
      enumSkema && ['FLAT', 'PERSEN', 'BERTAHAP'].includes(enumSkema) ? enumSkema : null;

    // @ts-ignore
    const created = await prisma.$transaction(async (tx) => {
      const header = await tx.hblGolonganTarif.create({
        data: {
          kode, nama, diameterMm,
          minChargeM3, minChargeRp,
          biayaAdminRp, pembulatanDenom,
          pajakAktif,
          pajakPersen: pajakAktif ? (pajakPersen ?? '0') : null,
          subsidiCatatan, subsidiRp,

          gracePeriodHari,
          skemaDenda: skemaOk,
          dendaFlatPerHariRp: dendaFlatPerHariRp ?? null,
          dendaPersenPerBulan: dendaPersenPerBulan ?? null,
          dendaBertahapJson: dendaBertahapJson ?? null,
          sp1Hari, sp2Hari, sp3Hari,
          biayaBukaTutupRp: biayaBukaTutupRp ?? null,
          biayaPasangKembaliRp: biayaPasangKembaliRp ?? null,

          berlakuDari: berlakuDari ?? null,
          berlakuSampai: berlakuSampai ?? null,
        },
      });

      await tx.hblTarifBlok.createMany({
        data: blok.map((b: any, idx: number) => ({
          golonganTarifId: header.id,
          urutan: b.urutan ?? idx + 1,
          dariM3: b.dariM3 ?? null,
          sampaiM3: b.sampaiM3 ?? null,
          tarifPerM3: b.tarifPerM3,
        })),
      });

      return header;
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Kode tarif sudah dipakai' }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

// ===== LIST =====
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // sort: id_asc | id_desc | updated_desc
    const sort = (searchParams.get("sort") || "id_asc").toLowerCase();
    const orderBy =
      sort === "id_desc" ? { id: "desc" as const } :
      sort === "updated_desc" ? { updatedAt: "desc" as const } :
      { id: "asc" as const }; // default: ID ASC

    const where = q
      ? {
          OR: [
            { kode: { contains: q, mode: "insensitive" } },
            { nama: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      // @ts-ignore
      prisma.hblGolonganTarif.findMany({
        where,
        select: {
          id: true,
          kode: true,
          nama: true,
          diameterMm: true,
          minChargeM3: true,
          minChargeRp: true,
          biayaAdminRp: true,
          pajakAktif: true,
          pajakPersen: true,
          updatedAt: true,
        },
        orderBy,
        skip,
        take: limit,
      }),// @ts-ignore
      prisma.hblGolonganTarif.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    // Cek dipakai sambungan?
    // @ts-ignore
    const used = await prisma.hblSambungan.count({
      where: { golonganTarifId: id },
    });
    if (used > 0) {
      return NextResponse.json(
        { error: `Tidak bisa hapus. Dipakai oleh ${used} sambungan.` },
        { status: 409 }
      );
    }

    // Hapus blok & header dalam transaksi
    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      await tx.hblTarifBlok.deleteMany({ where: { golonganTarifId: id } });
      await tx.hblGolonganTarif.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}