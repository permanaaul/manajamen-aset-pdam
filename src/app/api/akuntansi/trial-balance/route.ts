// app/api/akuntansi/trial-balance/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

type RowOut = {
  akunId: number;
  kode: string;
  nama: string;
  pos: "DEBIT" | "KREDIT";
  debit: number;
  kredit: number;
  saldoAkhir: number;
};

type SaldoJoin = {
  akunId: number;
  debit: unknown;
  kredit: unknown;
  saldoAkhir: unknown;
  akun: { id: number; kode: string; nama: string; pos: "DEBIT" | "KREDIT" };
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tahunQ = Number(url.searchParams.get("tahun"));
    const bulanQ = Number(url.searchParams.get("bulan"));
    const base = new Date();
    const tahun = Number.isFinite(tahunQ) && tahunQ > 0 ? tahunQ : base.getFullYear();
    const bulan = Number.isFinite(bulanQ) && bulanQ >= 1 && bulanQ <= 12 ? bulanQ : base.getMonth() + 1;

    const mulai = new Date(tahun, bulan - 1, 1, 0, 0, 0, 0);
    const akhir = endOfMonth(mulai);
    //@ts-ignore
    const saldo = (await prisma.saldoAkunBulanan.findMany({
      where: { tahun, bulan },
      include: { akun: { select: { id: true, kode: true, nama: true, pos: true } } },
      orderBy: [{ akun: { kode: "asc" } }],
    })) as SaldoJoin[];

    let rows: RowOut[] = [];
    if (saldo.length > 0) {
      rows = (saldo as SaldoJoin[]).map((s: SaldoJoin): RowOut => ({
        akunId: s.akunId,
        kode: s.akun.kode,
        nama: s.akun.nama,
        pos: s.akun.pos,
        debit: Number((s as any).debit || 0),
        kredit: Number((s as any).kredit || 0),
        saldoAkhir: Number((s as any).saldoAkhir || 0),
      }));
    } else {
        //@ts-ignore
      const lines = await prisma.jurnalLine.findMany({
        where: { header: { status: "POSTED", tanggal: { gte: mulai, lte: akhir } } },
        select: { akunId: true, debit: true, kredit: true, akun: { select: { kode: true, nama: true, pos: true } } },
      });

      const acc = new Map<number, { kode: string; nama: string; pos: "DEBIT" | "KREDIT"; debit: number; kredit: number }>();
      for (const l of lines) {
        const e = acc.get(l.akunId) || { kode: l.akun.kode, nama: l.akun.nama, pos: l.akun.pos as any, debit: 0, kredit: 0 };
        e.debit += Number(l.debit || 0);
        e.kredit += Number(l.kredit || 0);
        acc.set(l.akunId, e);
      }
      rows = [...acc.entries()]
        .map(([akunId, v]): RowOut => {
          const saldoAkhir = v.pos === "DEBIT" ? v.debit - v.kredit : v.kredit - v.debit;
          return { akunId, kode: v.kode, nama: v.nama, pos: v.pos, debit: v.debit, kredit: v.kredit, saldoAkhir };
        })
        .sort((a, b) => a.kode.localeCompare(b.kode));
    }

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalKredit = rows.reduce((s, r) => s + r.kredit, 0);
    const top5 = rows.slice(0, 5);

    return NextResponse.json({
      periode: { tahun, bulan, mulai, akhir },
      totalDebit,
      totalKredit,
      balanced: Math.abs(totalDebit - totalKredit) < 0.5,
      rows: top5,
      count: rows.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
