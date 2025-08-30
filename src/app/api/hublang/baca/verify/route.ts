// app/api/hublang/baca/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import  prisma  from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids wajib array' }, { status: 400 });
  }
  try {
    // @ts-ignore
    const res = await prisma.hblBaca.updateMany({
      where: { id: { in: ids as number[] } },
      data: { status: 'TERVERIFIKASI' },
    });
    return NextResponse.json({ updated: res.count }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
