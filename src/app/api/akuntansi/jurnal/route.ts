// app/api/akuntansi/jurnal/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { StatusJurnal, SumberJurnal, StatusPeriode } from "@prisma/client";

// ===== Helpers =====
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function parseISODate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
async function ensurePeriodeId(d: Date) {
  const tahun = d.getFullYear();
  const bulan = d.getMonth() + 1;
  const mulai = new Date(tahun, bulan - 1, 1);
  const akhir = new Date(tahun, bulan, 0); // akhir bulan (tgl terakhir)

  // @ts-ignore
  const p = await prisma.periodeAkuntansi.upsert({
    where: { tahun_bulan: { tahun, bulan } },
    create: {
      tahun,
      bulan,
      mulai,
      akhir,
      status: StatusPeriode.TERBUKA,
    },
    update: {},
    select: { id: true },
  });
  return p.id;
}

async function nextJurnalNumber(d: Date) {
  const key = `JRN-${d.getFullYear()}${pad2(d.getMonth() + 1)}`;
  // @ts-ignore
  const row = await prisma.sequenceCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  const seq = row.value;
  return `${key}-${String(seq).padStart(4, "0")}`;
}

type LineIn = {
  akunId?: number;
  akunKode?: string;
  debit?: number;
  kredit?: number;
  uraian?: string;
  asetId?: number;
  gudangId?: number;
  itemId?: number;
  pemeliharaanId?: number;
  stokLineId?: number;
};

// ====== GET ======
type JurnalRowDB = {
  id: number;
  nomor: string;
  tanggal: Date;
  status: string;
  sumber: string;
  memo: string | null;
  refTable: string | null;
  refId: number | null;
  refNo: string | null;
  _count: { lines: number };
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || 5)));
    // @ts-ignore
    const rows = (await prisma.jurnal.findMany({
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        nomor: true,
        tanggal: true,
        status: true,
        sumber: true,
        memo: true,
        refTable: true,
        refId: true,
        refNo: true,
        _count: { select: { lines: true } },
      },
    })) as JurnalRowDB[];

    return NextResponse.json(
      rows.map((r) => ({ ...r, tanggal: r.tanggal.toISOString() }))
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

// ====== POST (Create) ======
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tanggal: string;
      memo?: string;
      sumber?: keyof typeof SumberJurnal;
      lines: LineIn[];
      refTable?: string;
      refId?: number;
      refNo?: string;
    };

    const tanggal = parseISODate(body.tanggal);
    if (!tanggal) {
      return NextResponse.json({ error: "tanggal wajib (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!Array.isArray(body.lines) || body.lines.length < 2) {
      return NextResponse.json({ error: "Minimal 2 lines" }, { status: 400 });
    }

    // Validasi & resolve akunId
    const linesIn = body.lines.map((l, idx) => ({
      idx,
      akunId: l.akunId ?? null,
      akunKode: l.akunKode?.trim() || null,
      debit: Number(l.debit || 0),
      kredit: Number(l.kredit || 0),
      uraian: l.uraian?.trim() || null,
      asetId: l.asetId ?? null,
      gudangId: l.gudangId ?? null,
      itemId: l.itemId ?? null,
      pemeliharaanId: l.pemeliharaanId ?? null,
      stokLineId: l.stokLineId ?? null,
    }));

    let totalD = 0;
    let totalK = 0;

    // Resolve akunId by kode bila perlu
    for (const l of linesIn) {
      if (!l.akunId && !l.akunKode) {
        return NextResponse.json(
          { error: `Line ${l.idx + 1}: akunId atau akunKode wajib` },
          { status: 400 }
        );
      }
      if (!l.akunId && l.akunKode) {
        // @ts-ignore
        const a = await prisma.akun.findUnique({
          where: { kode: l.akunKode },
          select: { id: true },
        });
        if (!a) return NextResponse.json({ error: `Akun ${l.akunKode} tidak ditemukan` }, { status: 400 });
        l.akunId = a.id;
      }
      if (l.debit < 0 || l.kredit < 0) {
        return NextResponse.json({ error: `Line ${l.idx + 1}: nilai negatif tidak diperbolehkan` }, { status: 400 });
      }
      totalD += l.debit;
      totalK += l.kredit;
    }

    if (Math.round((totalD - totalK) * 100) !== 0) {
      return NextResponse.json({ error: "Total debit dan kredit harus seimbang" }, { status: 400 });
    }

    const periodeId = await ensurePeriodeId(tanggal);
    const nomor = await nextJurnalNumber(tanggal);

    // Simpan header + lines
    // @ts-ignore
    const created = await prisma.jurnal.create({
      data: {
        nomor,
        tanggal,
        periodeId,
        status: StatusJurnal.DRAFT, // awalnya draft; nanti bisa POST/UNPOST
        sumber: (body.sumber as SumberJurnal) || SumberJurnal.MANUAL,
        memo: body.memo?.trim() || null,
        refTable: body.refTable || null,
        refId: body.refId ?? null,
        refNo: body.refNo || null,
        lines: {
          createMany: {
            data: linesIn.map((l) => ({
              akunId: l.akunId!, // sudah di-resolve
              uraian: l.uraian,
              debit: l.debit,
              kredit: l.kredit,
              asetId: l.asetId,
              gudangId: l.gudangId,
              itemId: l.itemId,
              pemeliharaanId: l.pemeliharaanId,
              stokLineId: l.stokLineId,
            })),
          },
        },
      },
      select: {
        id: true,
        nomor: true,
        tanggal: true,
        periodeId: true,
        status: true,
        sumber: true,
        memo: true,
        lines: {
          select: {
            id: true,
            akunId: true,
            debit: true,
            kredit: true,
            uraian: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        ...created,
        tanggal: created.tanggal.toISOString(),
      },
      { status: 201 }
    );
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Nomor jurnal duplikat" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
