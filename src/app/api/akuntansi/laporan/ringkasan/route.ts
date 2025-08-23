// app/api/akuntansi/laporan/ringkasan/route.ts
import { NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { num } from "@/lib/num";
import type { Pemeliharaan, Aset, Penyusutan } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dariS = searchParams.get("dari");
  const sampaiS = searchParams.get("sampai");

  const range = {
    gte: dariS ? new Date(dariS) : undefined,
    lte: sampaiS ? new Date(sampaiS) : undefined,
  };

  // 1) Pemeliharaan (periode + aset ringkas)
  // @ts-ignore
  const pem = await prisma.pemeliharaan.findMany({
    where: { tanggal: range },
    include: { aset: { select: { id: true, kategori: true, nilai: true } } },
    orderBy: { tanggal: "asc" },
  }) as (Pemeliharaan & { aset: Pick<Aset, "id" | "kategori" | "nilai"> | null })[];

  // 2) Ringkasan status
  const statusMap = new Map<string, { jumlah: number; totalBiaya: number }>();
  for (const p of pem) {
    const key: string = p.status ?? "UNKNOWN";
    const biaya = num(p.biayaMaterial) + num(p.biayaJasa) + num(p.biaya);
    if (!statusMap.has(key)) statusMap.set(key, { jumlah: 0, totalBiaya: 0 });
    const cur = statusMap.get(key)!;
    cur.jumlah += 1;
    cur.totalBiaya += biaya;
  }
  const statusSummary = Array.from(statusMap.entries()).map(([status, v]) => ({
    status,
    jumlah: v.jumlah,
    totalBiaya: v.totalBiaya,
  }));

  // 3) Aset per kategori
  // @ts-ignore
  const asetAll = (await prisma.aset.findMany({
    select: { kategori: true, nilai: true },
  })) as Pick<Aset, "kategori" | "nilai">[];

  const asetKat = new Map<string, { jumlah: number; totalNilai: number }>();
  for (const a of asetAll) {
    const k = a.kategori as string;
    if (!asetKat.has(k)) asetKat.set(k, { jumlah: 0, totalNilai: 0 });
    const cur = asetKat.get(k)!;
    cur.jumlah += 1;
    cur.totalNilai += num(a.nilai);
  }
  const asetPerKategori = Array.from(asetKat.entries()).map(([kategori, v]) => ({
    kategori,
    jumlah: v.jumlah,
    totalNilai: v.totalNilai,
  }));

  // 4) Biaya pemeliharaan per kategori aset
  const biayaPerKat = new Map<string, number>();
  for (const p of pem) {
    const k = p.aset?.kategori ?? "LAINNYA";
    const biaya = num(p.biayaMaterial) + num(p.biayaJasa) + num(p.biaya);
    biayaPerKat.set(k, (biayaPerKat.get(k) ?? 0) + biaya);
  }
  const pemeliharaanPerKategoriAset = Array.from(biayaPerKat.entries()).map(([kategori, totalBiaya]) => ({
    kategori,
    totalBiaya,
  }));

  // 5) Penyusutan — ambil baris terakhir per aset
  const sampai = sampaiS ? new Date(sampaiS) : new Date();
  // @ts-ignore
  const peny = (await prisma.penyusutan.findMany({
    where: { periode: { lte: sampai } },
    select: {
      asetId: true,
      periode: true,
      akumulasi: true,
      nilaiAkhir: true,
      aset: { select: { kategori: true } },
    },
    orderBy: [{ asetId: "asc" }, { periode: "asc" }],
  })) as (Pick<Penyusutan, "asetId" | "periode" | "akumulasi" | "nilaiAkhir"> & {
    aset: Pick<Aset, "kategori"> | null;
  })[];

  const lastByAset = new Map<number, { kategori: string; akumulasi: number; nilaiAkhir: number }>();
  for (const r of peny) {
    lastByAset.set(r.asetId, {
      kategori: r.aset?.kategori ?? "LAINNYA",
      akumulasi: num(r.akumulasi),
      nilaiAkhir: num(r.nilaiAkhir),
    });
  }
  const penyKat = new Map<string, { akumulasi: number; nilaiBuku: number }>();
  for (const v of lastByAset.values()) {
    if (!penyKat.has(v.kategori)) penyKat.set(v.kategori, { akumulasi: 0, nilaiBuku: 0 });
    const cur = penyKat.get(v.kategori)!;
    cur.akumulasi += v.akumulasi;
    cur.nilaiBuku += v.nilaiAkhir;
  }
  const penyusutanPerKategori = Array.from(penyKat.entries()).map(([kategori, v]) => ({
    kategori,
    akumulasi: v.akumulasi,
    nilaiBuku: v.nilaiBuku,
  }));

  // 6) Downtime
  const dtArr = pem.filter((p) => p.downtimeJam != null);
  const totalJam = dtArr.reduce((s, p) => s + num(p.downtimeJam), 0);
  const rataJam = dtArr.length ? +(totalJam / dtArr.length).toFixed(1) : 0;

  // 7) Suku cadang agregat
  type SC = { nama: string; qty: number; satuan: string; harga?: number };
  const scAgg = new Map<string, { nama: string; qty: number; satuan: string; total: number }>();
  for (const p of pem) {
    const list = (p.sukuCadang as unknown as SC[]) ?? [];
    for (const it of list) {
      const key = it.nama;
      const subtotal = Number(it.qty ?? 0) * Number(it.harga ?? 0);
      if (!scAgg.has(key)) scAgg.set(key, { nama: key, qty: 0, satuan: it.satuan || "-", total: 0 });
      const cur = scAgg.get(key)!;
      cur.qty += Number(it.qty ?? 0);
      cur.total += subtotal;
    }
  }
  const sukuCadangAgg = Array.from(scAgg.values());

  return NextResponse.json({
    periode: { dari: dariS, sampai: sampaiS },
    statusSummary,
    asetPerKategori,
    pemeliharaanPerKategoriAset,
    penyusutanPerKategori,
    downtime: { totalJam, rataJam },
    sukuCadangAgg,
  });
}
