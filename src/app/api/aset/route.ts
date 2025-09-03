// app/api/aset/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toNum = (v: any) => (v == null ? 0 : Number(v) || 0);

// ========== GET  /api/aset?q=&kategori=&tahun=&page=&size=&order=&dir=
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const kategori = (url.searchParams.get("kategori") || "").trim();
    const tahun = parseInt(url.searchParams.get("tahun") || "", 10);

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "15", 10)));
    const skip = (page - 1) * size;

    // sorting
    const orderParam = (url.searchParams.get("order") || "nia").toLowerCase();
    const dirParam = (url.searchParams.get("dir") || "asc").toLowerCase() as "asc" | "desc";
    const allowed = new Set(["nia", "nama", "kategori", "lokasi", "tahun", "createdat", "updatedat"]);
    const sortField = allowed.has(orderParam) ? orderParam : "nia";
    const orderBy: any =
      sortField === "createdat" ? { createdAt: dirParam }
      : sortField === "updatedat" ? { updatedAt: dirParam }
      : { [sortField]: dirParam };

    // WHERE
    const where: any = {};
    if (q) {
      where.OR = [
        { nia: { contains: q, mode: "insensitive" } },
        { nama: { contains: q, mode: "insensitive" } },
        { lokasi: { contains: q, mode: "insensitive" } },
      ];
    }
    if (kategori) where.kategori = kategori as any;
    if (!Number.isNaN(tahun)) where.tahun = tahun;

    // @ts-ignore
    const count = await prisma.aset.count({ where });

    // @ts-ignore
    const rowsRaw = await prisma.aset.findMany({
      where,
      orderBy,
      skip,
      take: size,
      select: {
        id: true,
        nia: true,
        nama: true,
        kategori: true,
        lokasi: true,
        tahun: true,
        nilai: true,
        kondisi: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const rows = rowsRaw.map((a: any) => ({
      ...a,
      nilai: a.nilai != null ? Number(a.nilai) : 0,
    }));

    return NextResponse.json({ rows, count, page, size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// ========== POST  /api/aset
// body: { nia, nama, kategori, lokasi, tahun, nilai, kondisi, catatan?, penyusutan?: { ... } }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nia, nama, kategori, lokasi, tahun, nilai, kondisi,
      catatan = null,

      // opsional parameter penyusutan (boleh diabaikan saja dulu)
      tanggalOperasi = null,
      umurManfaatTahun = null,
      nilaiResidu = null,
      metodePenyusutan = null,
      golonganDepresiasi = null,
      mulaiPenyusutan = null,
    } = body ?? {};

    if (!nia || !nama) {
      return NextResponse.json({ error: "NIA & Nama wajib" }, { status: 400 });
    }

    // @ts-ignore
    const created = await prisma.aset.create({
      data: {
        nia: String(nia).trim(),
        nama: String(nama).trim(),
        kategori: (kategori || "KONSTRUKSI_SIPIL") as any,
        lokasi: lokasi ? String(lokasi) : "",
        tahun: Number(tahun) || new Date().getFullYear(),
        nilai: toNum(nilai),
        kondisi: kondisi ? String(kondisi) : "BAIK",
        catatan,

        // penyusutan params (opsional)
        tanggalOperasi: tanggalOperasi ? new Date(tanggalOperasi) : null,
        umurManfaatTahun: umurManfaatTahun != null ? Number(umurManfaatTahun) : null,
        nilaiResidu: nilaiResidu != null ? toNum(nilaiResidu) : null,
        metodePenyusutan: metodePenyusutan || null,
        golonganDepresiasi: golonganDepresiasi || null,
        mulaiPenyusutan: mulaiPenyusutan ? new Date(mulaiPenyusutan) : null,
      },
      select: { id: true, nia: true, nama: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "NIA aset sudah dipakai" }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
