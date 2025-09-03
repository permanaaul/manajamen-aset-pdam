// app/api/aset/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  KategoriAset,
  MetodePenyusutan,
  GolonganDepresiasi,
} from "@prisma/client";

/**
 * GET /api/aset/lookup
 *
 * Mode:
 * - type=meta        -> enum (kategori, metode, golongan)
 * - type=aset        -> daftar aset (opsional ?q=, ?limit=) atau ?id= untuk satu aset
 * - (tanpa type)     -> default ke meta (kompatibel form lama)
 *
 * Tambahan untuk halaman Generate:
 * - ?listAll=1       -> paksa kembalikan daftar aset walau tanpa type/q (tidak ganggu default lama)
 * - ?limit=50        -> batasi jumlah (default 50, max 100)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "").toLowerCase(); // 'meta' | 'aset' | ''
    const q = (url.searchParams.get("q") || "").trim();
    const idParam = url.searchParams.get("id");
    const listAll = url.searchParams.get("listAll") === "1" || url.searchParams.get("for") === "generate";
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

    // === META: enum untuk form tambah/edit aset (default lama) ===
    if (type === "meta" || (!type && !q && !idParam && !listAll)) {
      return NextResponse.json({
        kategori: Object.values(KategoriAset),
        metode: Object.values(MetodePenyusutan),
        golongan: Object.values(GolonganDepresiasi),
      });
    }

    // === ASET: ambil satu by id ===
    if (idParam) {
      const id = Number(idParam) || 0;
      if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

      // @ts-ignore
      const row = await prisma.aset.findUnique({
        where: { id },
        select: { id: true, nia: true, nama: true, lokasi: true, kategori: true },
      });

      if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({ rows: [row] });
    }

    // === ASET: list (digunakan oleh Generate & pencarian umum) ===
    const where: any = {};
    if (q) {
      where.OR = [
        { nia:   { contains: q, mode: "insensitive" } },
        { nama:  { contains: q, mode: "insensitive" } },
        { lokasi:{ contains: q, mode: "insensitive" } },
      ];
    }

    // @ts-ignore
    const rows = await prisma.aset.findMany({
      where,
      // tampilkan yang terbaru dulu agar aset baru mudah terlihat di Generate
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: { id: true, nia: true, nama: true, lokasi: true, kategori: true },
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
