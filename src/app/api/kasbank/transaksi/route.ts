// app/api/kasbank/transaksi/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  TipeKasBankTransaksi,
  StatusDokumen,
} from "@prisma/client";

/* helpers */
const toNum = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const pad2 = (n: number) => String(n).padStart(2, "0");

function monthKey(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}`; // YYYYMM
}

async function nextKBNumber(prefix: string, d = new Date()) {
  const key = `${prefix}-${monthKey(d)}`;
  // @ts-ignore
  const row = await prisma.sequenceCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return `${key}-${String(row.value).padStart(4, "0")}`;
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(t);
  return isNaN(+dt) ? null : dt;
}

// ==== types for rows mapping ====
type Brief = { id: number; kode: string; nama: string };
type RowDB = {
  id: number;
  nomor: string;
  tanggal: Date;
  tipe: "IN" | "OUT" | "TRF";
  status: StatusDokumen;
  akunId: number | null;
  asalId: number | null;
  tujuanId: number | null;
  lawanAkunId: number | null;
  amount: unknown; // Decimal | number
  biaya: unknown;  // Decimal | number | null
  memo: string | null;
  referensi: string | null;
  jurnalId: number | null;
  akun: Brief | null;
  asal: Brief | null;
  tujuan: Brief | null;
  lawanAkun: Brief | null;
};

/* ============ GET: list transaksi (filterable) ============ */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const tipe = url.searchParams.get("tipe") as TipeKasBankTransaksi | null;
    const status = url.searchParams.get("status") as StatusDokumen | null;

    const akunId = Number(url.searchParams.get("akunId") || 0) || undefined;
    const asalId = Number(url.searchParams.get("asalId") || 0) || undefined;
    const tujuanId = Number(url.searchParams.get("tujuanId") || 0) || undefined;

    const dari = parseDate(url.searchParams.get("dari"));
    const sampai = parseDate(url.searchParams.get("sampai"));
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get("size") || 20)));
    const skip = (page - 1) * size;

    const where: any = {};
    if (q) {
      where.OR = [
        { nomor: { contains: q, mode: "insensitive" } },
        { memo: { contains: q, mode: "insensitive" } },
        { referensi: { contains: q, mode: "insensitive" } },
      ];
    }
    if (tipe) where.tipe = tipe;
    if (status) where.status = status;
    if (akunId) where.akunId = akunId;
    if (asalId) where.asalId = asalId;
    if (tujuanId) where.tujuanId = tujuanId;
    if (dari || sampai) {
      where.tanggal = {};
      if (dari) where.tanggal.gte = new Date(dari.setHours(0, 0, 0, 0));
      if (sampai) where.tanggal.lte = new Date(sampai.setHours(23, 59, 59, 999));
    }

    // @ts-ignore
    const [count, rows, sum] = await Promise.all([
        //@ts-ignore
      prisma.kasBankTransaksi.count({ where }),
      //@ts-ignore
      prisma.kasBankTransaksi.findMany({
        where,
        orderBy: [{ tanggal: "desc" }, { id: "desc" }],
        skip,
        take: size,
        select: {
          id: true,
          nomor: true,
          tanggal: true,
          tipe: true,
          status: true,
          akunId: true,
          asalId: true,
          tujuanId: true,
          lawanAkunId: true,
          amount: true,
          biaya: true,
          memo: true,
          referensi: true,
          jurnalId: true,
          akun: { select: { id: true, kode: true, nama: true } },
          asal: { select: { id: true, kode: true, nama: true } },
          tujuan: { select: { id: true, kode: true, nama: true } },
          lawanAkun: { select: { id: true, kode: true, nama: true } },
        },
      }),
      //@ts-ignore
      prisma.kasBankTransaksi.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const out = (rows as RowDB[]).map((r: RowDB) => ({
      id: r.id,
      nomor: r.nomor,
      tanggal: r.tanggal.toISOString(),
      tipe: r.tipe,
      status: r.status,
      akunId: r.akunId,
      asalId: r.asalId,
      tujuanId: r.tujuanId,
      lawanAkunId: r.lawanAkunId,
      amount: toNum(r.amount),
      biaya: toNum(r.biaya),
      memo: r.memo,
      referensi: r.referensi,
      jurnalId: r.jurnalId,
      akun: r.akun,
      asal: r.asal,
      tujuan: r.tujuan,
      lawanAkun: r.lawanAkun,
    }));

    return NextResponse.json({
      rows: out,
      count,
      page,
      size,
      summary: { totalAmount: toNum((sum as any)?._sum?.amount || 0) },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ============ POST: buat transaksi DRAFT ============ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const tipe: TipeKasBankTransaksi = body.tipe as TipeKasBankTransaksi;
    if (!Object.values(TipeKasBankTransaksi).includes(tipe)) {
      return NextResponse.json({ error: "tipe harus IN/OUT/TRF" }, { status: 400 });
    }

    const tanggal = body.tanggal ? new Date(body.tanggal) : new Date();
    const memo = body.memo ? String(body.memo) : null;
    const referensi = body.referensi ? String(body.referensi) : null;
    const amount = toNum(body.amount);
    const biaya = body.biaya != null ? toNum(body.biaya) : null;
    const lawanAkunId = body.lawanAkunId ? Number(body.lawanAkunId) : null;

    let nomorPrefix = "KB";
    if (tipe === "IN") nomorPrefix = "KBIN";
    if (tipe === "OUT") nomorPrefix = "KBOUT";
    if (tipe === "TRF") nomorPrefix = "KBTRF";

    const nomor = await nextKBNumber(nomorPrefix, tanggal);

    const data: any = {
      nomor,
      tanggal,
      tipe,
      status: StatusDokumen.DRAFT,
      memo,
      referensi,
      amount,
      biaya,
    };

    if (tipe === "IN" || tipe === "OUT") {
      const akunId = Number(body.akunId || 0);
      if (!akunId) return NextResponse.json({ error: "akunId wajib (IN/OUT)" }, { status: 400 });
      if (!lawanAkunId) return NextResponse.json({ error: "lawanAkunId wajib (IN/OUT)" }, { status: 400 });
      data.akunId = akunId;
      data.lawanAkunId = lawanAkunId;
    } else if (tipe === "TRF") {
      const asalId = Number(body.asalId || 0);
      const tujuanId = Number(body.tujuanId || 0);
      if (!asalId || !tujuanId || asalId === tujuanId) {
        return NextResponse.json({ error: "asalId & tujuanId wajib dan tidak boleh sama (TRF)" }, { status: 400 });
      }
      data.asalId = asalId;
      data.tujuanId = tujuanId;
    }

    // @ts-ignore
    const created = await prisma.kasBankTransaksi.create({ data });
    return NextResponse.json({ ok: true, transaksi: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
