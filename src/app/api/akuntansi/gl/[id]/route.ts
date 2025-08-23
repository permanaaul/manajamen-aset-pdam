// src/app/api/akuntansi/gl/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    await assertRole(_req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const id = Number(params.id || "");
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalid" }, { status: 400 });
  }

  // @ts-ignore
  const header = (await prisma.jurnalUmum.findUnique({
    where: { id },
    include: {
      lines: {
        orderBy: { id: "asc" },
        include: {
          akun: { select: { id: true, kode: true, nama: true } },
          unitBiaya: { select: { id: true, nama: true } },
          aset: { select: { id: true, nia: true, nama: true } },
        },
      },
    },
  })) as (null | {
    id: number;
    tanggal: Date;
    ref: string | null;
    uraian: string | null;
    sumber: string | null;
    lines: Array<{
      id: number;
      akunId: number;
      debit: any;
      kredit: any;
      akun: { id: number; kode: string; nama: string } | null;
      unitBiaya: { id: number; nama: string } | null;
      aset: { id: number; nia: string; nama: string } | null;
    }>;
  });

  if (!header) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // parse sumber
  let sourceType: "JURNAL" | "PENYUSUTAN" | null = null;
  let sourceId: number | null = null;
  if (typeof header.sumber === "string") {
    const [t, v] = header.sumber.split(":");
    if (t === "JURNAL") sourceType = "JURNAL";
    if (t === "PENYUSUTAN") sourceType = "PENYUSUTAN";
    if (v && !Number.isNaN(Number(v))) sourceId = Number(v);
  }

  const lines = header.lines.map((l) => ({
    id: l.id,
    akunId: l.akunId,
    akun: l.akun ? { kode: l.akun.kode, nama: l.akun.nama } : null,
    debit: Number(l.debit),
    kredit: Number(l.kredit),
    unit: l.unitBiaya ? { id: l.unitBiaya.id, nama: l.unitBiaya.nama } : null,
    aset: l.aset ? { id: l.aset.id, nia: l.aset.nia, nama: l.aset.nama } : null,
  }));

  return NextResponse.json({
    id: header.id,
    tanggal: header.tanggal,
    ref: header.ref,
    uraian: header.uraian,
    sumber: header.sumber,
    sourceType,
    sourceId,
    lines,
  });
}
