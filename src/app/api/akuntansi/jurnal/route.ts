// app/api/akuntansi/jurnal/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// ===== Helpers =====
function toDate(d: string) {
  return new Date(`${d}T00:00:00`);
}
function to2dp(v: any): number {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

// ====== GET: daftar ringkas jurnal (opsional filter q) ======
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    // @ts-ignore
    const rows = await prisma.jurnalBiaya.findMany({
      where: q
        ? {
            OR: [
              { ref: { contains: q } },
              { uraian: { contains: q } },
              { kategori: { nama: { contains: q } } },
              { kategori: { kode: { contains: q } } },
            ],
          }
        : undefined,
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
      take: 100,
      include: {
        // @ts-ignore
        kategori: { select: { id: true, kode: true, nama: true, tipe: true } },
        alokasi: {
          include: {
            unitBiaya: { select: { id: true, kode: true, nama: true } },
            aset: { select: { id: true, nia: true, nama: true } },
          },
        },
      },
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// ====== POST: buat jurnal baru ======
type CreateBody = {
  tanggal: string;              // "YYYY-MM-DD"
  ref?: string | null;
  uraian?: string | null;
  kategoriId: number;
  debit?: number | string;
  kredit?: number | string;
  alokasi: Array<{
    unitBiayaId?: number | null;
    asetId?: number | null;
    persen?: number | null;
    jumlah?: number | null;
  }>;
};

export async function POST(req: Request) {
  // proteksi role
  try {
    await assertRole(req, ["ADMIN", "PIMPINAN"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as CreateBody;

    // ---- Validasi ringan ----
    if (!body?.tanggal) return NextResponse.json({ error: "Tanggal wajib diisi." }, { status: 400 });
    if (!body?.kategoriId) return NextResponse.json({ error: "Kategori wajib dipilih." }, { status: 400 });
    const d = to2dp(body?.debit ?? 0);
    const k = to2dp(body?.kredit ?? 0);
    if (d <= 0 && k <= 0) {
      return NextResponse.json({ error: "Isi minimal salah satu nilai Debit atau Kredit." }, { status: 400 });
    }
    if (!Array.isArray(body?.alokasi) || body.alokasi.length === 0) {
      return NextResponse.json({ error: "Pilih minimal satu Unit Biaya." }, { status: 400 });
    }
    const okAlokasi = body.alokasi.some((a) => a.unitBiayaId || a.asetId);
    if (!okAlokasi) {
      return NextResponse.json({ error: "Alokasi harus berisi unitBiayaId atau asetId." }, { status: 400 });
    }

    // Pastikan kategori ada
    // @ts-ignore
    const kat = await prisma.biayaKategori.findUnique({ where: { id: Number(body.kategoriId) } });
    if (!kat) return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 404 });

    // @ts-ignore
    const tipe = kat?.tipe === "ASET" ? "CAPEX" : "OPEX";

    // Simpan
    // @ts-ignore
    const created = await prisma.jurnalBiaya.create({
      data: {
        tanggal: toDate(body.tanggal),
        kategoriId: Number(body.kategoriId),
        tipe,                           // enum TipeBiaya: "OPEX" | "CAPEX"
        ref: body.ref || null,
        uraian: body.uraian || null,
        debit: d,
        kredit: k,
        alokasi: {
          create: body.alokasi.map((a) => ({
            unitBiayaId: a.unitBiayaId ?? null,
            asetId: a.asetId ?? null,
            persen: a.persen ?? null,
            jumlah: a.jumlah ?? null,
          })),
        },
      },
      include: { alokasi: true, kategori: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const err = e as Prisma.PrismaClientKnownRequestError;
    return NextResponse.json(
      { error: err.message || "Server error", code: (err as any)?.code, meta: (err as any)?.meta },
      { status: 500 }
    );
  }
}
