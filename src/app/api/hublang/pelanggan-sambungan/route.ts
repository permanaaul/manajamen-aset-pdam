// app/api/hublang/pelanggan-sambungan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Helper: terima beberapa format umum & kembalikan Date atau null
function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  let s = String(v).trim();
  // DD/MM/YYYY HH:mm
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})$/);
  if (m1) {
    const [, dd, mm, yyyy, HH, MM] = m1;
    s = `${yyyy}-${mm}-${dd}T${HH}:${MM}:00`;
  }
  // YYYY-MM-DD HH:mm -> YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) s = s.replace(' ', 'T');
  // tambah detik bila belum ada
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) s = s + ':00';

  const d = new Date(s); // dianggap waktu lokal
  return isNaN(d.getTime()) ? null : d;
}

/* =========================
   GET /api/hublang/pelanggan-sambungan
   Dua mode:
   1) Detail pelanggan + sambungan:
      ?pelangganId=<id> (atau ?id=<id>)
      ==> { id, kode, nama, sambungan:[...], primarySambungan:{id,noSambungan}|null }
   2) Listing (mode lama, tetap seperti semula):
      q, tipe, status, page, pageSize, sort
========================= */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // ====== MODE DETAIL (baru) ======
    const pelangganIdParam = searchParams.get('pelangganId') ?? searchParams.get('id');
    if (pelangganIdParam != null && pelangganIdParam !== '') {
      const pelangganId = Number(pelangganIdParam);
      if (!Number.isFinite(pelangganId)) {
        return NextResponse.json({ error: 'pelangganId harus numerik' }, { status: 400 });
      }

      // @ts-ignore
      const row = await prisma.hblPelanggan.findUnique({
        where: { id: pelangganId },
        select: {
          id: true,
          kode: true,
          nama: true,
          sambungan: {
            select: {
              id: true,
              noSambungan: true,
              status: true,          // HblStatusSambungan
              tanggalPasang: true,
              diameterMm: true,
              golonganTarifId: true,
            },
            orderBy: [{ tanggalPasang: 'desc' }, { id: 'desc' }],
          },
        },
      });

      if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

      // Pilih sambungan utama: yang AKTIF dahulu, jika tak ada ambil yang terbaru
      const aktif = row.sambungan.find((s: any) => s.status === 'AKTIF') ?? null;
      const primary = aktif ?? (row.sambungan.length ? row.sambungan[0] : null);

      return NextResponse.json({
        id: row.id,
        kode: row.kode,
        nama: row.nama,
        sambungan: row.sambungan.map((s: any) => ({
          id: s.id,
          noSambungan: s.noSambungan,
          status: s.status,
          tanggalPasang: s.tanggalPasang ?? null,
          diameterMm: s.diameterMm,
          golonganTarifId: s.golonganTarifId,
        })),
        primarySambungan: primary
          ? { id: primary.id, noSambungan: primary.noSambungan }
          : null,
      });
    }

    // ====== MODE LIST (existing) ======
    const q = (searchParams.get('q') || '').trim();
    const tipe = searchParams.get('tipe') as 'SOSIAL' | 'NIAGA' | 'INSTANSI' | 'LAINNYA' | null;
    const status = searchParams.get('status'); // AKTIF | NONAKTIF | null
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 20)));

    // kontrol urutan (default ASC = yang baru di bawah)
    const sortParam = (searchParams.get('sort') ?? 'asc').toLowerCase();
    const order: 'asc' | 'desc' = ['desc', 'new', 'newest'].includes(sortParam) ? 'desc' : 'asc';

    const where: any = {
      ...(q
        ? {
            OR: [
              { kode: { contains: q, mode: 'insensitive' } },
              { nama: { contains: q, mode: 'insensitive' } },
              { hp: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { alamatJalan: { contains: q, mode: 'insensitive' } },
              { sambungan: { some: { noSambungan: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
      ...(tipe ? { tipe } : {}),
      ...(status ? { aktif: status === 'AKTIF' } : {}),
    };

    const skip = (page - 1) * pageSize;

    // @ts-ignore
    const [total, rows] = await Promise.all([
      // @ts-ignore
      prisma.hblPelanggan.count({ where }),
      // @ts-ignore
      prisma.hblPelanggan.findMany({
        where,
        orderBy: { id: order }, // <= pakai kontrol urutan
        skip,
        take: pageSize,
        select: {
          id: true,
          kode: true,
          nama: true,
          tipe: true,
          hp: true,
          email: true,
          alamatJalan: true,
          aktif: true,
          _count: { select: { sambungan: true } },
          sambungan: {
            orderBy: { id: 'asc' },
            take: 3, // preview max 3 sambungan
            select: {
              id: true,
              noSambungan: true,
              status: true,
              diameterMm: true,
              golonganTarifId: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({ data: rows, paging: { page, pageSize, total } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

/* =========================
   POST /api/hublang/pelanggan-sambungan
   Upsert pelanggan by kode + upsert sambungan by noSambungan
========================= */
export async function POST(req: NextRequest) {
  try {
    const { pelanggan, sambungan } = await req.json();

    if (!pelanggan?.kode || !pelanggan?.nama || !pelanggan?.tipe) {
      return NextResponse.json({ error: 'pelanggan.kode, nama, tipe wajib' }, { status: 400 });
    }
    if (
      !sambungan?.noSambungan ||
      sambungan?.golonganTarifId == null ||
      sambungan?.diameterMm == null
    ) {
      return NextResponse.json(
        { error: 'sambungan.noSambungan, golonganTarifId, diameterMm wajib' },
        { status: 400 }
      );
    }

    // Normalisasi numerik & tanggal
    const golonganTarifId = Number(sambungan.golonganTarifId);
    const diameterMm = Number(sambungan.diameterMm);
    let ruteId =
      sambungan.ruteId != null && sambungan.ruteId !== ''
        ? Number(sambungan.ruteId)
        : null;
    const lat = sambungan.lat != null && sambungan.lat !== '' ? Number(sambungan.lat) : null;
    const lng = sambungan.lng != null && sambungan.lng !== '' ? Number(sambungan.lng) : null;
    const tanggalPasang = toDateOrNull(sambungan.tanggalPasang);

    if (!Number.isFinite(golonganTarifId) || !Number.isFinite(diameterMm)) {
      return NextResponse.json(
        { error: 'golonganTarifId/diameterMm harus numerik' },
        { status: 400 }
      );
    }

    // ===== Validasi FK (hindari P2003) =====
    // @ts-ignore
    const tarifAda = await prisma.hblGolonganTarif.findUnique({
      where: { id: golonganTarifId },
      select: { id: true },
    });
    if (!tarifAda) {
      return NextResponse.json(
        { error: `golonganTarifId ${golonganTarifId} tidak ditemukan` },
        { status: 400 }
      );
    }

    if (ruteId != null) {
      // @ts-ignore
      const ruteAda = await prisma.hblRute.findUnique({
        where: { id: ruteId },
        select: { id: true },
      });
      // Karena opsional: kalau tidak ada, kosongkan saja agar tidak FK error
      if (!ruteAda) ruteId = null;
    }

    // @ts-ignore
    const result = await prisma.$transaction(async (tx) => {
      const pel = await tx.hblPelanggan.upsert({
        where: { kode: pelanggan.kode },
        update: {
          nama: pelanggan.nama,
          tipe: pelanggan.tipe,
          nik: pelanggan.nik ?? null,
          npwp: pelanggan.npwp ?? null,
          hp: pelanggan.hp ?? null,
          email: pelanggan.email ?? null,
          alamatJalan: pelanggan.alamatJalan ?? null,
          rt: pelanggan.rt ?? null,
          rw: pelanggan.rw ?? null,
          kelurahan: pelanggan.kelurahan ?? null,
          kecamatan: pelanggan.kecamatan ?? null,
          kota: pelanggan.kota ?? null,
          aktif: pelanggan.aktif ?? true,
        },
        create: {
          kode: pelanggan.kode,
          nama: pelanggan.nama,
          tipe: pelanggan.tipe,
          nik: pelanggan.nik ?? null,
          npwp: pelanggan.npwp ?? null,
          hp: pelanggan.hp ?? null,
          email: pelanggan.email ?? null,
          alamatJalan: pelanggan.alamatJalan ?? null,
          rt: pelanggan.rt ?? null,
          rw: pelanggan.rw ?? null,
          kelurahan: pelanggan.kelurahan ?? null,
          kecamatan: pelanggan.kecamatan ?? null,
          kota: pelanggan.kota ?? null,
          aktif: pelanggan.aktif ?? true,
        },
      });

      const smb = await tx.hblSambungan.upsert({
        where: { noSambungan: sambungan.noSambungan },
        update: {
          pelangganId: pel.id,
          golonganTarifId,
          diameterMm,
          alamatSambungan: sambungan.alamatSambungan ?? null,
          ruteId, // <- sudah divalidasi/di-nullkan kalau tidak ada
          tanggalPasang,
          lat,
          lng,
          status: 'AKTIF',
        },
        create: {
          noSambungan: sambungan.noSambungan,
          pelangganId: pel.id,
          golonganTarifId,
          diameterMm,
          alamatSambungan: sambungan.alamatSambungan ?? null,
          ruteId, // <- sudah divalidasi/di-nullkan kalau tidak ada
          tanggalPasang,
          lat,
          lng,
        },
      });

      return {
        pelanggan: { id: pel.id, kode: pel.kode, nama: pel.nama },
        sambungan: { id: smb.id, noSambungan: smb.noSambungan },
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    // P2002 => unique violation (kode/noSambungan)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Kode/noSambungan duplikat' }, { status: 409 });
    }
    // P2003 => foreign key violation (backup handler kalau ada FK lain yang miss)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Foreign key tidak valid (cek ruteId / golonganTarifId)' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

/* =========================
   DELETE /api/hublang/pelanggan-sambungan
   Hapus pelanggan (default) ATAU sambungan:
   - Hapus pelanggan:  DELETE ?id=<pelangganId>
   - Hapus sambungan:  DELETE ?target=sambungan&id=<sambunganId>
   Body { id } juga didukung kalau tidak pakai query.
========================= */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let target = (searchParams.get('target') || 'pelanggan').toLowerCase(); // <- let, bukan const

    let idStr = searchParams.get('id');
    let id = idStr ? Number(idStr) : NaN;

    if (!Number.isFinite(id)) {
      try {
        const body = await req.json();
        if (body?.id != null) id = Number(body.id);
        if (body?.target) target = String(body.target).toLowerCase();
      } catch { /* ignore */ }
    }

    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id wajib numeric' }, { status: 400 });
    }

    if (target === 'sambungan') {
      // @ts-ignore
      const smb = await prisma.hblSambungan.findUnique({
        where: { id },
        select: { id: true, noSambungan: true },
      });
      if (!smb) return NextResponse.json({ error: 'Sambungan tidak ditemukan' }, { status: 404 });

      // @ts-ignore
      await prisma.$transaction(async (tx) => {
        await tx.hblBaca.deleteMany({ where: { sambunganId: id } });
        await tx.hblSambungan.delete({ where: { id } });
      });

      return NextResponse.json(
        { ok: true, deleted: { id: smb.id, noSambungan: smb.noSambungan } },
        { status: 200 }
      );
    }

    // Default: hapus pelanggan + turunannya
    // @ts-ignore
    const pel = await prisma.hblPelanggan.findUnique({
      where: { id },
      select: { id: true, kode: true, nama: true },
    });
    if (!pel) return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });

    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      const sambs: { id: number }[] = await tx.hblSambungan.findMany({
        where: { pelangganId: id },
        select: { id: true },
      });
      const sambIds = sambs.map((s: { id: number }) => s.id); // <- tipe eksplisit

      if (sambIds.length) {
        await tx.hblBaca.deleteMany({ where: { sambunganId: { in: sambIds } } });
        await tx.hblSambungan.deleteMany({ where: { id: { in: sambIds } } });
      }

      await tx.hblPelanggan.delete({ where: { id } });
    });

    return NextResponse.json(
      { ok: true, deleted: { id: pel.id, kode: pel.kode, nama: pel.nama } },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
