// app/api/akuntansi/penyusutan/[id]/posting/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

type Params = { params: { id: string } };

function safeNum(x: unknown) {
  if (x == null) return 0;
  const n =
    typeof x === "object" && typeof (x as any)?.toNumber === "function"
      ? (x as any).toNumber()
      : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function startOfDayLocal(isoLike: string) {
  const d = new Date(isoLike);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Cek status posting satu penyusutan */
export async function GET(_: Request, { params }: Params) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    // @ts-ignore
    const rows = await prisma.jurnalBiaya.findMany({
      where: { penyusutanId: id },
      orderBy: [{ tanggal: "asc" }, { id: "asc" }],
      include: {
        kategori: { select: { id: true, nama: true } },
        alokasi: {
          include: {
            unitBiaya: { select: { id: true, nama: true } },
            aset: { select: { id: true, nia: true, nama: true } },
          },
        },
      },
    });

    return NextResponse.json({ posted: rows.length > 0, count: rows.length, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/** Posting idempotent 1 penyusutan → 2 baris jurnal (beban + akumulasi) */
export async function POST(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });

    const body = await req.json();
    const kategoriBebanId = Number(body?.kategoriBebanId);
    const kategoriAkumulasiId = Number(body?.kategoriAkumulasiId);
    const unitBiayaId = body?.unitBiayaId != null ? Number(body.unitBiayaId) : undefined;
    const asetId = body?.asetId != null ? Number(body.asetId) : undefined;
    const ref: string | null = (body?.ref ?? "").toString().trim() || null;
    const manualTanggal: string | null = (body?.tanggal ?? "").toString().trim() || null;
    let uraian: string | null = (body?.uraian ?? "").toString().trim() || null;

    if (!kategoriBebanId || !kategoriAkumulasiId) {
      return NextResponse.json({ error: "kategoriBebanId dan kategoriAkumulasiId wajib diisi." }, { status: 400 });
    }
    // @ts-ignore
    const p = await prisma.penyusutan.findUnique({
      where: { id },
      include: { aset: true },
    });
    if (!p) return NextResponse.json({ error: "Penyusutan tidak ditemukan." }, { status: 404 });

    const nominal = safeNum((p as any).beban);
    if (nominal <= 0) return NextResponse.json({ error: "Nilai beban penyusutan tidak valid atau nol." }, { status: 400 });

    const tanggal = manualTanggal ? startOfDayLocal(manualTanggal) : startOfDayLocal((p as any).periode);
    if (!uraian) {
      const nm = (p as any)?.aset?.nama ?? "Aset";
      const m = tanggal.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      uraian = `Penyusutan ${nm} - ${m}`;
    }

    type AlokasiCreate = { unitBiayaId?: number | null; asetId?: number | null; persen?: number | null; jumlah?: number | null };
    const aloks: AlokasiCreate[] = [];
    if (Number.isFinite(unitBiayaId)) aloks.push({ unitBiayaId, persen: null, jumlah: nominal });
    if (Number.isFinite(asetId))      aloks.push({ asetId, persen: null, jumlah: nominal });
    // @ts-ignore
    const out = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // @ts-ignore
      const kb = await tx.biayaKategori.findUnique({ where: { id: kategoriBebanId } });
      // @ts-ignore
      const ka = await tx.biayaKategori.findUnique({ where: { id: kategoriAkumulasiId } });
      if (!kb || !ka) throw new Error("Kategori beban/akumulasi tidak ditemukan.");
      // @ts-ignore
      const existing: Array<{ kategoriId: number }> = await tx.jurnalBiaya.findMany({
        where: { penyusutanId: id, kategoriId: { in: [kategoriBebanId, kategoriAkumulasiId] } },
        select: { kategoriId: true },
      });
      const hasBeban = existing.some((e: { kategoriId: number }) => e.kategoriId === kategoriBebanId);
      const hasAkum  = existing.some((e: { kategoriId: number }) => e.kategoriId === kategoriAkumulasiId);
      if (hasBeban && hasAkum) return { created: 0 };

      const common = {
        tanggal, uraian, ref, tipe: "OPEX" as const, penyusutanId: id,
        alokasi: aloks.length ? { create: aloks } : undefined,
      };

      let created = 0;
      // @ts-ignore
      if (!hasBeban) { await tx.jurnalBiaya.create({ data: { ...common, kategoriId: kategoriBebanId, debit: nominal, kredit: 0 } }); created++; }
      // @ts-ignore
      if (!hasAkum)  { await tx.jurnalBiaya.create({ data: { ...common, kategoriId: kategoriAkumulasiId, debit: 0, kredit: nominal } }); created++; }

      return { created };
    });

    return NextResponse.json(
      out.created ? { ok: true, created: out.created } : { ok: true, message: "Sudah diposting." },
      { status: out.created ? 201 : 200 },
    );
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    if ((err as any)?.code === "P2002") return NextResponse.json({ ok: true, message: "Sudah diposting." }, { status: 200 });
    return NextResponse.json({ error: err?.message || e?.message || "Server error" }, { status: 500 });
  }
}
