import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

type Params = { params: { id: string } };

function toStartLocal(d: Date | string) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

function yearRange(y: number) {
  const gte = new Date(y, 0, 1);
  const lt = new Date(y + 1, 0, 1);
  return { gte, lt };
}

/** GET: preview semua penyusutan aset (filter by year) + status posted */
export async function GET(req: Request, { params }: Params) {
  try {
    const asetId = Number(params.id);
    if (!Number.isFinite(asetId)) {
      return NextResponse.json({ error: "asetId tidak valid." }, { status: 400 });
    }

    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const { gte, lt } = yearRange(year);

    // @ts-ignore
    const rows: Array<{ id: number; periode: Date }> = await prisma.penyusutan.findMany({
      where: { asetId, periode: { gte, lt } },
      orderBy: [{ periode: "asc" }],
      select: { id: true, periode: true },
    });

    const ids = rows.map((r: { id: number; periode: Date }) => r.id);

    // Hitung jumlah jurnalBiaya per penyusutanId
    const grouped =
      ids.length
        // @ts-ignore
        ? await prisma.jurnalBiaya.groupBy({
            by: ["penyusutanId"],
            _count: { _all: true },
            where: { penyusutanId: { in: ids } },
          })
        : [];

    const countMap = new Map<number, number>();
    for (const g of grouped as Array<{ penyusutanId: number | null; _count: { _all: number } }>) {
      if (g.penyusutanId != null) countMap.set(g.penyusutanId, g._count._all);
    }

    const total = ids.length;
    let already = 0;
    const idsPending: number[] = [];
    for (const pid of ids) {
      const c = countMap.get(pid) || 0;
      // OPSI 2: 1 baris per periode → dianggap posted jika ada >= 1 baris
      if (c >= 1) already++;
      else idsPending.push(pid);
    }

    return NextResponse.json({ year, total, already, pending: idsPending.length, idsPending });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/** POST: bulk posting (idempotent). Body: { year } atau { penyusutanIds: number[] } + kategoriBebanId wajib */
export async function POST(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const asetId = Number(params.id);
    if (!Number.isFinite(asetId)) {
      return NextResponse.json({ error: "asetId tidak valid." }, { status: 400 });
    }

    const body = await req.json();

    const kategoriBebanId = Number(body?.kategoriBebanId);
    if (!kategoriBebanId) {
      return NextResponse.json({ error: "Kategori beban wajib." }, { status: 400 });
    }

    const unitBiayaId = body?.unitBiayaId != null ? Number(body.unitBiayaId) : undefined;
    const alokasiAsetId = body?.asetId != null ? Number(body.asetId) : undefined;
    const ref: string | null = (body?.ref ?? "").toString().trim() || null;
    const overrideTanggal: string | null = (body?.tanggal ?? "").toString().trim() || null;
    const uraianPrefix: string = (body?.uraianPrefix ?? "").toString().trim();

    // kandidat IDs: dari body.penyusutanIds atau dari year
    let kandidatIds: number[] = Array.isArray(body?.penyusutanIds)
      ? (body.penyusutanIds as unknown[]).map((x: unknown) => Number(x)).filter(Number.isFinite)
      : [];

    let yearUsed: number | null = null;
    if (!kandidatIds.length) {
      const year = Number(body?.year) || new Date().getFullYear();
      yearUsed = year;
      const { gte, lt } = yearRange(year);

      // @ts-ignore
      const rows: Array<{ id: number }> = await prisma.penyusutan.findMany({
        where: { asetId, periode: { gte, lt } },
        select: { id: true },
      });

      kandidatIds = rows.map((r: { id: number }) => r.id);
    }

    if (!kandidatIds.length) {
      return NextResponse.json({ error: "Tidak ada periode penyusutan." }, { status: 400 });
    }

    // @ts-ignore
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Validasi kategori beban ada
      // @ts-ignore
      const kb = await tx.biayaKategori.findUnique({ where: { id: kategoriBebanId } });
      if (!kb) throw new Error("Kategori beban tidak ditemukan.");

      let posted = 0,
        skipped = 0;
      const errors: Array<{ id: number; message: string }> = [];

      for (const pid of kandidatIds) {
        // @ts-ignore
        const p = await tx.penyusutan.findFirst({
          where: { id: pid, asetId },
          include: { aset: true },
        });
        if (!p) {
          skipped++;
          continue;
        }

        // Prisma Decimal safe
        const nominal =
          typeof (p as any).beban === "object" && typeof (p as any).beban?.toNumber === "function"
            ? (p as any).beban.toNumber()
            : Number((p as any).beban || 0);

        if (!Number.isFinite(nominal) || nominal <= 0) {
          skipped++;
          continue;
        }

        const tanggal = overrideTanggal ? toStartLocal(overrideTanggal) : toStartLocal((p as any).periode);
        const assetName = (p as any)?.aset?.nama ?? "Aset";
        const m = tanggal.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
        const uraian = `${uraianPrefix ? `${uraianPrefix} ` : ""}Penyusutan ${assetName} - ${m}`;

        // Cek apakah baris beban sudah ada (idempotent)
        // @ts-ignore
        const ex = await tx.jurnalBiaya.findFirst({
          where: { penyusutanId: pid, kategoriId: kategoriBebanId },
          select: { id: true },
        });

        if (ex) {
          skipped++;
          continue;
        }

        type AlokasiCreate = {
          unitBiayaId?: number | null;
          asetId?: number | null;
          persen?: number | null;
          jumlah?: number | null;
        };
        const aloks: AlokasiCreate[] = [];
        if (Number.isFinite(unitBiayaId)) aloks.push({ unitBiayaId, persen: null, jumlah: nominal });
        if (Number.isFinite(alokasiAsetId)) aloks.push({ asetId: alokasiAsetId, persen: null, jumlah: nominal });

        const dataCreate = {
          tanggal,
          uraian,
          ref,
          tipe: "OPEX" as const,
          penyusutanId: pid,
          kategoriId: kategoriBebanId,
          debit: nominal,
          kredit: 0,
          alokasi: aloks.length ? { create: aloks } : undefined,
        };

        try {
          // @ts-ignore
          await tx.jurnalBiaya.create({ data: dataCreate });
          posted += 1;
        } catch (err: any) {
          if ((err as Prisma.PrismaClientKnownRequestError)?.code === "P2002") {
            // unique composite → anggap sudah diposting oleh proses lain
            skipped++;
          } else {
            errors.push({ id: pid, message: err?.message || "error" });
          }
        }
      }

      return { posted, skipped, errors, year: yearUsed };
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    if ((err as any)?.code === "P2002") {
      return NextResponse.json({ ok: true, message: "Sebagian/sudah diposting." }, { status: 200 });
    }
    return NextResponse.json({ error: err?.message || e?.message || "Server error" }, { status: 500 });
  }
}
