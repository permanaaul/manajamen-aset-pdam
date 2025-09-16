// app/api/akuntansi/jurnal/[id]/post/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { StatusJurnal, StatusPeriode } from "@prisma/client";

// ===== Helpers =====
function pad2(n: number) { return String(n).padStart(2, "0"); }

async function ensurePeriodeId(d: Date) {
  const tahun = d.getFullYear();
  const bulan = d.getMonth() + 1;
  const mulai = new Date(tahun, bulan - 1, 1);
  const akhir = new Date(tahun, bulan, 0);
  // @ts-ignore
  const p = await prisma.periodeAkuntansi.upsert({
    where: { tahun_bulan: { tahun, bulan } },
    create: { tahun, bulan, mulai, akhir, status: StatusPeriode.TERBUKA },
    update: {},
    select: { id: true, status: true },
  });
  return p;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    // Ambil header + totalkan lines
    // @ts-ignore
    const hdr = await prisma.jurnal.findUnique({
      where: { id },
      select: {
        id: true, nomor: true, tanggal: true, status: true, periodeId: true,
        lines: { select: { debit: true, kredit: true } },
      },
    });
    if (!hdr) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (hdr.status !== StatusJurnal.DRAFT) {
      return NextResponse.json({ error: "Hanya DRAFT yang bisa diposting" }, { status: 400 });
    }
    if (!hdr.lines || hdr.lines.length < 2) {
      return NextResponse.json({ error: "Minimal 2 baris jurnal" }, { status: 400 });
    }

    let td = 0, tk = 0;
    for (const l of hdr.lines) {
      td += Number(l.debit || 0);
      tk += Number(l.kredit || 0);
    }
    if (Math.round((td - tk) * 100) !== 0) {
      return NextResponse.json({ error: "Debit & Kredit tidak seimbang" }, { status: 400 });
    }

    const per = await ensurePeriodeId(hdr.tanggal);
    if (per.status !== StatusPeriode.TERBUKA) {
      return NextResponse.json({ error: "Periode tidak terbuka" }, { status: 400 });
    }

    // Post
    // @ts-ignore
    const updated = await prisma.jurnal.update({
      where: { id },
      data: {
        status: StatusJurnal.POSTED,
        postedAt: new Date(),
        periodeId: per.id,
      },
      select: { id: true, nomor: true, status: true, postedAt: true },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
