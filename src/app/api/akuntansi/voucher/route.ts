// src/app/api/akuntansi/voucher/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";

function toDate(d?: string | null): Date | null {
  if (!d) return null;
  return new Date(`${d}T00:00:00`);
}

/** Convert Prisma Decimal | number | string | null -> number safely */
function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  // Prisma.Decimal has .toNumber()
  const obj = v as { toNumber?: () => number };
  if (obj && typeof obj === "object" && typeof obj.toNumber === "function") {
    try {
      return obj.toNumber();
    } catch {
      /* fallthrough */
    }
  }
  const n = Number(v as any);
  return Number.isFinite(n) ? n : 0;
}

type LineMini = { debit: unknown; kredit: unknown };
type RowMini = {
  id: number;
  tanggal: Date;
  voucherNo: string | null;
  voucherDate: Date | null;
  ref: string | null;
  uraian: string | null;
  sumber: string | null;
  printCount: number | null;
  createdAt: Date;
  postedAt: Date | null;
  lines: LineMini[];
};

export async function GET(req: Request) {
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = toDate(searchParams.get("from"));
  const to = toDate(searchParams.get("to"));
  const q = (searchParams.get("q") || "").trim();

  const where: any = { voucherNo: { not: null } };
  if (from || to) {
    where.tanggal = {};
    if (from) where.tanggal.gte = from;
    if (to) where.tanggal.lte = to;
  }
  if (q) {
    where.OR = [
      { voucherNo: { contains: q } },
      { ref: { contains: q } },
      { uraian: { contains: q } },
      { sumber: { contains: q } },
    ];
  }

  // @ts-ignore
  const rows = (await prisma.jurnalUmum.findMany({
    where,
    orderBy: [{ tanggal: "desc" }, { id: "desc" }],
    select: {
      id: true,
      tanggal: true,
      voucherNo: true,
      voucherDate: true,
      ref: true,
      uraian: true,
      sumber: true,
      printCount: true,
      createdAt: true,
      postedAt: true,
      lines: { select: { debit: true, kredit: true } },
    },
    take: 500,
  })) as RowMini[];

  const items = rows.map((r: RowMini) => {
    const totalD = r.lines.reduce((s: number, x: LineMini) => s + toNum(x.debit), 0);
    const totalK = r.lines.reduce((s: number, x: LineMini) => s + toNum(x.kredit), 0);
    return {
      id: r.id,
      tanggal: r.tanggal,
      voucherNo: r.voucherNo,
      voucherDate: r.voucherDate,
      ref: r.ref,
      uraian: r.uraian,
      sumber: r.sumber,
      printCount: r.printCount,
      totalDebit: totalD,
      totalKredit: totalK,
      balanced: Math.abs(totalD - totalK) < 0.005,
    };
  });

  return NextResponse.json(items);
}
