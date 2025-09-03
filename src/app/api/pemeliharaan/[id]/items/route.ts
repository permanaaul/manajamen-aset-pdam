// app/api/pemeliharaan/[id]/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type AddItem = {
  itemId: number;
  qty: number;
  hargaRp?: number | null;
  catatan?: string | null;
};

// Tipe minimal untuk line transaksi stok yang kita butuhkan
type StokLine = { id: number; itemId: number; qty: number };

/* Util: pastikan gudang valid, atau buat default */
async function resolveGudangId(tx: any, preferred?: number | null): Promise<number> {
  const p = Number(preferred || 0);
  if (p > 0) {
    const ok = await tx.gudang
      .findUnique({ where: { id: p }, select: { id: true } })
      .catch(() => null);
    if (ok?.id) return ok.id;
  }
  const any = await tx.gudang
    .findFirst({ select: { id: true }, orderBy: { id: "asc" } })
    .catch(() => null);
  if (any?.id) return any.id;

  const created = await tx.gudang
    .create({ data: { kode: "G01", nama: "Gudang Utama" }, select: { id: true } })
    .catch(() => null);
  if (created?.id) return created.id;

  throw new Error("Gudang belum tersedia.");
}

/* ========== POST: tambah item pemeliharaan & ISSUE stok ========== */
/**
 * Body:
 * {
 *   gudangId?: number,
 *   items: [{ itemId, qty, hargaRp?, catatan? }, ...]
 * }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    const b = await req.json();
    const items: AddItem[] = Array.isArray(b?.items)
      ? b.items.map((x: any) => ({
          itemId: Number(x?.itemId) || 0,
          qty: Number(x?.qty) || 0,
          hargaRp: x?.hargaRp != null ? Number(x.hargaRp) : null,
          catatan: x?.catatan ?? null,
        }))
      : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "items wajib" }, { status: 400 });
    }
    for (const it of items) {
      if (!(it.itemId > 0) || !(it.qty > 0)) {
        return NextResponse.json({ error: "tiap item wajib itemId dan qty > 0" }, { status: 400 });
      }
    }

    // Jalankan dalam transaksi
    //@ts-ignore
    const out = await prisma.$transaction(async (tx: any) => {
      const gudangId = await resolveGudangId(tx, b?.gudangId ? Number(b.gudangId) : null);

      // Cek & potong stok
      for (const it of items) {
        const saldo = await tx.stokSaldo.findUnique({
          where: { gudangId_itemId: { gudangId, itemId: it.itemId } },
        });
        const qty = Number(it.qty);
        if (!saldo || Number(saldo.qty) < qty) {
          throw new Error(
            `Stok tidak cukup untuk itemId ${it.itemId} di gudang ${gudangId}. Stok: ${saldo?.qty ?? 0}`
          );
        }
        await tx.stokSaldo.update({
          where: { gudangId_itemId: { gudangId, itemId: it.itemId } },
          data: { qty: Number(saldo.qty) - qty },
        });
      }

      // Buat transaksi ISSUE + pilih kolom line yang kita perlukan agar bertipe jelas
      const header = (await tx.stokTransaksi.create({
        data: {
          tipe: "ISSUE",
          status: "POSTED",
          tanggal: new Date(),
          gudangAsalId: gudangId,
          referensi: `Pemeliharaan #${id}`,
          catatan: "Konsumsi sparepart pemeliharaan",
          lines: {
            create: items.map((it) => ({
              itemId: it.itemId,
              qty: it.qty,
              hargaRp: it.hargaRp != null ? Number(it.hargaRp) : null,
              pemeliharaanId: id,
              catatan: it.catatan ?? "Pemeliharaan",
            })),
          },
        },
        // batasi select agar terketik
        select: {
          id: true,
          lines: { select: { id: true, itemId: true, qty: true } },
        },
      })) as { id: number; lines: StokLine[] };

      // Buat PemeliharaanItem + tautkan ke line
      const lines: StokLine[] = header.lines;
      for (let i = 0; i < lines.length; i++) {
        const ln: StokLine = lines[i];
        const src = items[i];
        await tx.pemeliharaanItem.create({
          data: {
            pemeliharaanId: id,
            itemId: ln.itemId,
            qty: ln.qty, // number OK untuk DECIMAL
            hargaRp: src?.hargaRp != null ? Number(src.hargaRp) : null,
            stokLineId: ln.id,
          },
        });
      }

      const lineIds = (lines as StokLine[]).map((l: StokLine) => l.id);
      return { transaksiId: header.id, lines: lineIds };
    });

    return NextResponse.json(out, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
