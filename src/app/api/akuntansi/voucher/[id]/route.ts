// src/app/api/akuntansi/voucher/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

type Params = { params: { id: string } };

// same helper as list route
function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  const obj = v as { toNumber?: () => number };
  if (obj && typeof obj === "object" && typeof obj.toNumber === "function") {
    try {
      return obj.toNumber();
    } catch {}
  }
  const n = Number(v as any);
  return Number.isFinite(n) ? n : 0;
}

type LineFull = {
  id: number;
  akunId: number;
  debit: unknown;
  kredit: unknown;
  akun: { id: number; kode: string; nama: string };
  unitBiaya: { id: number; nama: string } | null;
  aset: { id: number; nama: string; nia: string } | null;
};
type HeaderFull = {
  id: number;
  tanggal: Date;
  voucherNo: string | null;
  voucherDate: Date | null;
  ref: string | null;
  uraian: string | null;
  sumber: string | null;
  createdAt: Date;
  createdBy: { id: number; nama: string } | null;
  postedAt: Date | null;
  postedBy: { id: number; nama: string } | null;
  lines: LineFull[];
};

export async function GET(req: Request, { params }: Params) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  // @ts-ignore
  const h = (await prisma.jurnalUmum.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          akun: { select: { id: true, kode: true, nama: true } },
          unitBiaya: { select: { id: true, nama: true } },
          aset: { select: { id: true, nama: true, nia: true } },
        },
        orderBy: { id: "asc" },
      },
      createdBy: { select: { id: true, nama: true } },
      postedBy: { select: { id: true, nama: true } },
    },
  })) as HeaderFull | null;

  if (!h) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const totalDebit = h.lines.reduce((s: number, x: LineFull) => s + toNum(x.debit), 0);
  const totalKredit = h.lines.reduce((s: number, x: LineFull) => s + toNum(x.kredit), 0);

  return NextResponse.json({
    id: h.id,
    tanggal: h.tanggal,
    voucherNo: h.voucherNo,
    voucherDate: h.voucherDate,
    ref: h.ref,
    uraian: h.uraian,
    sumber: h.sumber,
    createdAt: h.createdAt,
    createdBy: h.createdBy,
    postedAt: h.postedAt,
    postedBy: h.postedBy,
    totals: { debit: totalDebit, kredit: totalKredit, balanced: Math.abs(totalDebit - totalKredit) < 0.005 },
    lines: h.lines.map((l: LineFull) => ({
      id: l.id,
      akunId: l.akunId,
      akun: l.akun,
      unitBiaya: l.unitBiaya || null,
      aset: l.aset || null,
      debit: toNum(l.debit),
      kredit: toNum(l.kredit),
    })),
  });
}
