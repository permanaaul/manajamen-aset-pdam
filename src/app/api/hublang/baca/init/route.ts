// app/api/hublang/baca/init/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---- helpers ----
function parseYm(ym: string): { tahun: number; bulan: number } {
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error("periode wajib format YYYY-MM");
  const [y, m] = ym.split("-").map(Number);
  return { tahun: y, bulan: m };
}
function prevYm(tahun: number, bulan: number): { tahun: number; bulan: number } {
  const d = new Date(tahun, bulan - 2, 1); // JS month 0..11
  return { tahun: d.getFullYear(), bulan: d.getMonth() + 1 };
}

// Tipe seleksi list yang diambil dari Prisma
type BacaListItem = {
  id: number;
  sambunganId: number;
  angkaLalu: number | null;
  angkaKini: number | null;
  pakaiM3: number | null;
  anomali: boolean | null;
  status: "DRAFT" | "TERVERIFIKASI";
  tanggalBaca: Date | null;
  catatan: string | null;
  sambungan: {
    noSambungan: string | null;
    golonganTarifId: number | null;
    golonganTarif: { id: number; kode: string | null; nama: string | null } | null;
    pelanggan: { nama: string | null } | null;
  } | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const periode: string = body?.periode || "";
    const ruteId: number | null =
      body?.ruteId == null || body?.ruteId === "" ? null : Number(body.ruteId);

    const { tahun, bulan } = parseYm(periode);
    const prev = prevYm(tahun, bulan);

    // 1) Ambil semua sambungan aktif (opsional filter rute)
    // @ts-ignore
    const sambunganList = await prisma.hblSambungan.findMany({
      where: { status: "AKTIF", ...(ruteId ? { ruteId } : {}) },
      select: { id: true },
    });

    // 2) Inisialisasi bacaan untuk sambungan yang belum punya record periode ini
    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      for (const s of sambunganList) {
        const existing = await tx.hblBaca.findFirst({
          where: { sambunganId: s.id, periodeTahun: tahun, periodeBulan: bulan },
          select: { id: true },
        });
        if (existing) continue;

        const last = await tx.hblBaca.findFirst({
          where: { sambunganId: s.id, periodeTahun: prev.tahun, periodeBulan: prev.bulan },
          orderBy: { id: "desc" },
          select: { angkaKini: true },
        });

        await tx.hblBaca.create({
          data: {
            sambunganId: s.id,
            periodeTahun: tahun,
            periodeBulan: bulan,
            angkaLalu: last?.angkaKini ?? 0,
            angkaKini: null,
            pakaiM3: null,
            anomali: null,
            tanggalBaca: null,
            catatan: null,
            status: "DRAFT",
          },
        });
      }
    });

    // 3) Ambil daftar bacaan untuk UI (ikutkan info golongan tarif)
    // @ts-ignore
    const list = (await prisma.hblBaca.findMany({
      where: {
        periodeTahun: tahun,
        periodeBulan: bulan,
        ...(ruteId ? { sambungan: { ruteId } } : {}),
      },
      orderBy: [{ id: "asc" }],
      select: {
        id: true,
        sambunganId: true,
        angkaLalu: true,
        angkaKini: true,
        pakaiM3: true,
        anomali: true,
        status: true,
        tanggalBaca: true,
        catatan: true,
        sambungan: {
          select: {
            noSambungan: true,
            golonganTarifId: true,
            golonganTarif: { select: { id: true, kode: true, nama: true } },
            pelanggan: { select: { nama: true } },
          },
        },
      },
    })) as BacaListItem[];

    const data = list.map((x: BacaListItem) => ({
      id: x.id,
      sambunganId: x.sambunganId,
      angkaLalu: x.angkaLalu ?? 0,
      angkaKini: x.angkaKini ?? null,
      pakaiM3: x.pakaiM3 ?? null,
      anomali: x.angkaKini == null && x.tanggalBaca == null ? null : x.anomali ?? null,
      status: x.status,
      tanggalBaca: x.tanggalBaca, // UI akan konversi ke input datetime-local
      catatan: x.catatan,
      pelangganNama: x.sambungan?.pelanggan?.nama ?? null,
      noSambungan: x.sambungan?.noSambungan ?? null,
      golonganTarifId: x.sambungan?.golonganTarifId ?? null,
      golonganTarifKode: x.sambungan?.golonganTarif?.kode ?? null,
    }));

    return NextResponse.json({ count: data.length, data }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message || "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
