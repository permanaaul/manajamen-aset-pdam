// app/api/akuntansi/jurnal/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { StatusJurnal } from "@prisma/client";

// ------- Helpers -------
function parseISODate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Bentuk line yang keluar dari SELECT detail
type LineSel = {
  id: number;
  akunId: number;
  uraian: string | null;
  debit: unknown;
  kredit: unknown;
};

// Bentuk line baru saat replaceLines
type NewLineIn = {
  akunId: number;
  uraian: string | null;
  debit: number;
  kredit: number;
};

// ===== GET DETAIL =====
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    // @ts-ignore
    const row = await prisma.jurnal.findUnique({
      where: { id },
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
        periodeId: true,
        lines: {
          select: {
            id: true,
            akunId: true,
            uraian: true,
            debit: true,
            kredit: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    const mappedLines = (row.lines as unknown as LineSel[]).map(
      (l: LineSel) => ({
        id: l.id,
        akunId: l.akunId,
        uraian: l.uraian,
        debit: Number(l.debit || 0),
        kredit: Number(l.kredit || 0),
      })
    );

    return NextResponse.json({
      ...row,
      tanggal: row.tanggal.toISOString(),
      lines: mappedLines,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

// ===== PUT (Update draft) / DELETE (hapus draft) =====
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    // @ts-ignore
    const hdr = await prisma.jurnal.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!hdr) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (hdr.status !== StatusJurnal.DRAFT) {
      return NextResponse.json({ error: "Hanya boleh ubah DRAFT" }, { status: 400 });
    }

    const body = (await req.json()) as {
      tanggal?: string;
      memo?: string | null;
      sumber?: string | null;
      refTable?: string | null;
      refId?: number | null;
      refNo?: string | null;
      replaceLines?: Array<{
        akunId?: number;
        akunKode?: string;
        uraian?: string;
        debit?: number;
        kredit?: number;
      }>;
    };

    let tanggal: Date | undefined;
    if (body.tanggal) {
      const d = parseISODate(body.tanggal);
      if (!d) return NextResponse.json({ error: "tanggal tidak valid" }, { status: 400 });
      tanggal = d;
    }

    // jika ganti lines → validasi balance + resolve akunKode
    let newLinesData: NewLineIn[] | undefined;

    if (Array.isArray(body.replaceLines)) {
      type Tmp = {
        idx: number;
        akunId: number | null;
        akunKode: string | null;
        uraian: string | null;
        debit: number;
        kredit: number;
      };

      const items: Tmp[] = body.replaceLines.map((l, i) => ({
        idx: i + 1,
        akunId: l.akunId ?? null,
        akunKode: (l.akunKode || "").trim() || null,
        uraian: l.uraian?.trim() || null,
        debit: Number(l.debit || 0),
        kredit: Number(l.kredit || 0),
      }));

      let td = 0,
        tk = 0;
      for (const it of items as Tmp[]) {
        if (!it.akunId && !it.akunKode) {
          return NextResponse.json(
            { error: `Line ${it.idx}: akunId/akunKode wajib` },
            { status: 400 }
          );
        }
        if (!it.akunId && it.akunKode) {
          // @ts-ignore
          const a = await prisma.akun.findUnique({
            where: { kode: it.akunKode },
            select: { id: true },
          });
          if (!a) {
            return NextResponse.json(
              { error: `Line ${it.idx}: akun ${it.akunKode} tidak ditemukan` },
              { status: 400 }
            );
          }
          it.akunId = a.id;
        }
        if (it.debit < 0 || it.kredit < 0) {
          return NextResponse.json(
            { error: `Line ${it.idx}: nilai negatif tidak diperbolehkan` },
            { status: 400 }
          );
        }
        td += it.debit;
        tk += it.kredit;
      }
      if (Math.round((td - tk) * 100) !== 0) {
        return NextResponse.json({ error: "Debit & Kredit harus seimbang" }, { status: 400 });
      }

      newLinesData = items.map((it: Tmp): NewLineIn => ({
        akunId: it.akunId!, // sudah di-resolve
        uraian: it.uraian,
        debit: it.debit,
        kredit: it.kredit,
      }));
    }

    // simpan
    // @ts-ignore
    const saved = await prisma.$transaction(async (tx) => {
      if (newLinesData) {
        await tx.jurnalLine.deleteMany({ where: { headerId: id } });
      }
      return tx.jurnal.update({
        where: { id },
        data: {
          ...(tanggal ? { tanggal } : {}),
          memo: body.memo ?? undefined,
          sumber: (body.sumber as any) ?? undefined,
          refTable: body.refTable ?? undefined,
          refId: body.refId ?? undefined,
          refNo: body.refNo ?? undefined,
          ...(newLinesData
            ? {
                lines: {
                  createMany: { data: newLinesData as NewLineIn[] },
                },
              }
            : {}),
        },
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
        },
      });
    });

    return NextResponse.json({ ...saved, tanggal: saved.tanggal.toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    // @ts-ignore
    const row = await prisma.jurnal.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (row.status !== StatusJurnal.DRAFT) {
      return NextResponse.json({ error: "Hanya boleh hapus DRAFT" }, { status: 400 });
    }

    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      await tx.jurnalLine.deleteMany({ where: { headerId: id } });
      await tx.jurnal.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
