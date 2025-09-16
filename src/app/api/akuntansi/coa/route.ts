// app/api/akuntansi/coa/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TipeAkun, PosSaldo } from "@prisma/client";

type Pos = "DEBIT" | "KREDIT";

type AkunFlat = {
  id: number;
  kode: string;
  nama: string;
  pos: Pos;
  tipe: TipeAkun;
  isPosting: boolean;
  isActive: boolean;
  level: number;
  parentId: number | null;
  _count?: { children: number; jurnalLines: number };
};
type AkunNode = AkunFlat & { children: AkunNode[] };

const toBool = (v: string | null): boolean | null => {
  if (v == null) return null;
  const s = v.toLowerCase();
  if (["1", "true", "yes", "y"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return null;
};
const numOrNull = (s: string | null): number | null => {
  if (!s || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// infer kategori dari digit 1 (opsional fallback)
function inferTipeFromKode(kode: string): TipeAkun {
  const f = (kode || "").trim()[0];
  if (f === "1") return TipeAkun.ASET;
  if (f === "2") return TipeAkun.KEWAJIBAN;
  if (f === "3") return TipeAkun.EKUITAS;
  if (f === "4") return TipeAkun.PENDAPATAN;
  return TipeAkun.BEBAN;
}

function mapRow(r: any): AkunFlat {
  return {
    id: r.id,
    kode: r.kode,
    nama: r.nama,
    pos: r.pos as Pos,
    tipe: r.tipe as TipeAkun,
    isPosting: !!r.isPosting,
    isActive: !!r.isActive,
    level: r.level ?? 1,
    parentId: r.parentId ?? null,
    _count: r._count,
  };
}

/* =========================== GET =========================== */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const tree = toBool(url.searchParams.get("tree")) ?? false;
    const rootOnly = toBool(url.searchParams.get("rootOnly")) ?? false;
    const parentIdParsed = numOrNull(url.searchParams.get("parentId"));
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const size = Math.min(200, Math.max(1, Number(url.searchParams.get("size") || 50)));

    const where: any = {};
    if (q) where.OR = [{ kode: { contains: q } }, { nama: { contains: q } }];
    if (rootOnly) where.parentId = null;
    if (parentIdParsed !== null) where.parentId = parentIdParsed;

    if (!tree) {
      const [count, raw] = await Promise.all([
        // @ts-ignore
        prisma.akun.count({ where }),
        // @ts-ignore
        prisma.akun.findMany({
          where,
          orderBy: [{ kode: "asc" }],
          skip: (page - 1) * size,
          take: size,
          select: {
            id: true,
            kode: true,
            nama: true,
            pos: true as const,
            tipe: true,
            isPosting: true,
            isActive: true,
            level: true,
            parentId: true,
            // FIX: gunakan nama relasi yang benar—`jurnalLines`, bukan `lines`
            _count: { select: { children: true, jurnalLines: true } },
          },
        }),
      ]);
      const rows = (raw as any[]).map(mapRow);
      return NextResponse.json({ count, page, size, rows });
    }

    // tree mode
    // @ts-ignore
    const allRaw = await prisma.akun.findMany({
      where,
      orderBy: [{ kode: "asc" }],
      select: {
        id: true,
        kode: true,
        nama: true,
        pos: true as const,
        tipe: true,
        isPosting: true,
        isActive: true,
        level: true,
        parentId: true,
      },
    });
    const all = (allRaw as any[]).map(mapRow);

    const byId = new Map<number, AkunNode>();
    for (const r of all) byId.set(r.id, { ...r, children: [] });
    const roots: AkunNode[] = [];
    for (const r of all) {
      const node = byId.get(r.id)!;
      if (r.parentId && byId.has(r.parentId)) byId.get(r.parentId)!.children.push(node);
      else roots.push(node);
    }
    return NextResponse.json({ rows: roots });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

/* =========================== POST =========================== */
/*
Body fleksibel:
{
  kode: "1101",
  nama: "Kas",
  pos: "DEBIT" | "KREDIT",
  tipe?: "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN", // atau pakai "kategori"
  kategori?: sama seperti "tipe",
  isPosting?: boolean,        // true = detail/leaf
  isGroup?: boolean,          // alternatif
  type?: "DETAIL" | "GROUP",  // alternatif
  parentId?: number | null,
  isActive?: boolean
}
*/
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as any;
    const kode = (body.kode || "").trim();
    const nama = (body.nama || "").trim();
    const posStr = String(body.pos || "").toUpperCase();

    if (!kode || !nama || !["DEBIT", "KREDIT"].includes(posStr)) {
      return NextResponse.json(
        { error: "kode, nama, dan pos (DEBIT/KREDIT) wajib" },
        { status: 400 }
      );
    }

    const posEnum: PosSaldo = posStr === "DEBIT" ? PosSaldo.DEBIT : PosSaldo.KREDIT;

    // tentukan detail/grup
    let isPosting: boolean | null = null;
    if (typeof body.isPosting === "boolean") isPosting = body.isPosting;
    else if (typeof body.isGroup === "boolean") isPosting = !body.isGroup;
    else if (body.type) {
      const t = String(body.type).toUpperCase();
      isPosting = t === "DETAIL";
    }
    if (isPosting == null) isPosting = true; // default detail

    // tentukan kategori (TipeAkun)
    let tipeEnum: TipeAkun | null = null;
    const tipeRaw = (body.tipe || body.kategori || "").toString().toUpperCase();
    if (tipeRaw && (TipeAkun as any)[tipeRaw]) {
      tipeEnum = (TipeAkun as any)[tipeRaw] as TipeAkun;
    } else {
      tipeEnum = inferTipeFromKode(kode);
    }

    // parent & level
    let parentId: number | null = numOrNull(
      body.parentId == null ? null : String(body.parentId)
    );
    let level = 1;
    if (parentId) {
      // @ts-ignore
      const parent = await prisma.akun.findUnique({
        where: { id: parentId },
        select: { id: true, level: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "parentId tidak valid" }, { status: 400 });
      }
      level = (parent.level || 1) + 1;
    }

    // @ts-ignore
    const created = await prisma.akun.create({
      data: {
        kode,
        nama,
        pos: posEnum,
        tipe: tipeEnum!,
        isPosting,
        parentId,
        level,
        isActive: body.isActive ?? true,
      },
      select: {
        id: true,
        kode: true,
        nama: true,
        pos: true,
        tipe: true,
        isPosting: true,
        isActive: true,
        parentId: true,
        level: true,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        kode: created.kode,
        nama: created.nama,
        pos: created.pos as Pos,
        tipe: created.tipe as TipeAkun,
        isPosting: created.isPosting,
        isActive: created.isActive,
        parentId: created.parentId,
        level: created.level,
      },
      { status: 201 }
    );
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Kode akun sudah ada" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
