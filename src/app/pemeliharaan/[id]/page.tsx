"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Barcode,
  CalendarDays,
  ClipboardList,
  Coins,
  Package,
  Pencil,
  PlusCircle,
  ShieldCheck,
  StickyNote,
  Trash2,
  UserCog,
  Boxes,
  Calculator,
  Timer,
} from "lucide-react";

/* ================== Types ================== */
type UserLocal = { nama: string; role: string } | null;

type Strategi = "PREVENTIF" | "KOREKTIF" | "PREDIKTIF" | string;

interface AsetLite {
  nama: string;
  nia: string;
}

interface SukuCadangRow {
  nama: string;
  qty: number | string;
  satuan: string;
  harga: number | string;
}

interface PemeliharaanDetail {
  id: number;
  aset?: AsetLite | null;
  tanggal: string;
  jenis: string;
  biaya?: number | string | null;
  pelaksana: string;
  catatan?: string | null;
  status: "Terjadwal" | "Dalam Proses" | "Selesai" | string;

  // opsional (kalau schema & API sudah diupgrade)
  strategi?: Strategi | null;
  jenisPekerjaan?: string | null; // enum code
  downtimeJam?: number | string | null;
  biayaMaterial?: number | string | null;
  biayaJasa?: number | string | null;
  sukuCadang?: SukuCadangRow[] | null;
}

/* ================== Helpers ================== */
const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toRupiah = (v?: number | string | null) =>
  v == null || v === "" ? "-" : `Rp ${new Intl.NumberFormat("id-ID").format(num(v))}`;

const StatusPill = ({ status }: { status: string }) => {
  const base = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium";
  switch (status) {
    case "Selesai":
      return (
        <span className={`${base} bg-green-100 text-green-700`}>
          <BadgeCheck className="w-4 h-4" /> Selesai
        </span>
      );
    case "Dalam Proses":
      return (
        <span className={`${base} bg-amber-100 text-amber-700`}>
          <ClipboardList className="w-4 h-4" /> Dalam Proses
        </span>
      );
    default:
      return (
        <span className={`${base} bg-blue-100 text-blue-700`}>
          <ShieldCheck className="w-4 h-4" /> Terjadwal
        </span>
      );
  }
};

const labelJenisPekerjaan = (code?: string | null) => {
  if (!code) return "-";
  const MAP: Record<string, string> = {
    INSPEKSI: "Inspeksi",
    PELUMASAN: "Pelumasan",
    KALIBRASI: "Kalibrasi",
    GANTI_SPAREPART: "Ganti Sparepart",
    PERBAIKAN_RINGAN: "Perbaikan Ringan",
    PERBAIKAN_BESAR: "Perbaikan Besar",
    OVERHAUL: "Overhaul",
    TESTING: "Testing",
  };
  return MAP[code] ?? code.replace(/_/g, " ");
};

const labelStrategi = (s?: string | null) => (s ? s.replace(/_/g, " ").toUpperCase() : "-");

/* ================== Page ================== */
export default function DetailPemeliharaan() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [user, setUser] = useState<UserLocal>(null);
  const [item, setItem] = useState<PemeliharaanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // guard login
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    setUser(JSON.parse(raw));
  }, [router]);

  // fetch detail
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/pemeliharaan/${id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Data tidak ditemukan");
        setItem(data as PemeliharaanDetail);
      } catch (e: any) {
        setErr(e?.message || "Terjadi kesalahan koneksi ke server");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ❗ Semua hook di atas early return
  const tanggalID = useMemo(
    () =>
      item?.tanggal
        ? new Date(item.tanggal).toLocaleDateString("id-ID", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "-",
    [item?.tanggal]
  );

  // ✅ Total suku cadang — diletakkan sebelum early return
  const partsTotal = useMemo(() => {
    if (!item?.sukuCadang || item.sukuCadang.length === 0) return 0;
    return item.sukuCadang.reduce((acc, s) => acc + num(s.qty) * num(s.harga), 0);
  }, [item?.sukuCadang]);

  // --- Early returns aman (tidak ada hook setelah ini) ---
  if (loading || !user) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-slate-600">⏳ Memuat detail pemeliharaan…</p>
      </main>
    );
  }

  if (err) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-red-600 font-semibold">{err}</p>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="flex justify-center items-center min-h-screen">
        <p className="text-red-600">❌ Data pemeliharaan tidak ditemukan</p>
      </main>
    );
  }

  const canEdit = ["ADMIN", "TEKNISI"].includes((user as any)?.role || "");

  // subtotal & total (fallback header)
  const subtotal = num(item.biayaMaterial) + num(item.biayaJasa);
  const totalBiayaHeader = item.biaya != null && item.biaya !== "" ? num(item.biaya) : subtotal;

  const hasDetailTeknis =
    (item.strategi && item.strategi !== "") ||
    (item.jenisPekerjaan && item.jenisPekerjaan !== "") ||
    item.downtimeJam != null ||
    item.biayaMaterial != null ||
    item.biayaJasa != null ||
    (item.sukuCadang && item.sukuCadang.length > 0);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> Detail Pemeliharaan
          </h1>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-blue-700 hover:underline text-sm"
            title="Kembali"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
        </div>

        {/* ===== Card 1 — Ringkasan & Aset terkait ===== */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Info kiri */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500">Aset Terkait</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div className="inline-flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">{item.aset?.nama || "-"}</span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-slate-500" />
                  <span className="font-mono">{item.aset?.nia || "-"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm mt-2">
                <div className="inline-flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Tanggal:</span> {tanggalID}
                </div>
                <div className="inline-flex items-center gap-2">
                  <Coins className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Total Biaya:</span> {toRupiah(totalBiayaHeader)}
                </div>
                <div className="inline-flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  <StatusPill status={item.status} />
                </div>
              </div>
            </div>

            {/* Aksi cepat */}
            <div className="flex flex-wrap gap-2">
              {item.aset?.nia && (
                <Link
                  href={`/inventarisasi/${item.aset.nia}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded border hover:bg-slate-50 text-sm"
                  title="Buka detail aset"
                >
                  <Package className="w-4 h-4" /> Lihat Aset
                </Link>
              )}
              {item.aset?.nia && canEdit && (
                <Link
                  href={`/pemeliharaan/tambah?nia=${encodeURIComponent(item.aset.nia)}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded border hover:bg-slate-50 text-sm"
                  title="Tambah pemeliharaan baru untuk aset ini"
                >
                  <PlusCircle className="w-4 h-4" /> Tambah Pemeliharaan
                </Link>
              )}
              {canEdit && (
                <>
                  <Link
                    href={`/pemeliharaan/${item.id}/edit`}
                    className="inline-flex items-center gap-2 bg-amber-600 text-white px-3 py-2 rounded hover:bg-amber-700 text-sm"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </Link>
                  <button
                    onClick={async () => {
                      if (!confirm("Yakin ingin menghapus jadwal ini?")) return;
                      try {
                        const res = await fetch(`/api/pemeliharaan/${item.id}`, { method: "DELETE" });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data?.error || "Gagal menghapus jadwal");
                        alert("✅ Jadwal berhasil dihapus");
                        router.push("/pemeliharaan");
                      } catch (e: any) {
                        alert(`❌ ${e?.message || "Terjadi kesalahan server"}`);
                      }
                    }}
                    className="inline-flex items-center gap-2 bg-rose-600 text-white px-3 py-2 rounded hover:bg-rose-700 text-sm"
                  >
                    <Trash2 className="w-4 h-4" /> Hapus
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ===== Card 2 — Detail Pemeliharaan ===== */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold">Detail Pemeliharaan</h2>
            <p className="text-xs text-slate-500 mt-1">Informasi utama & rincian teknis (jika diinput).</p>
          </div>

          <div className="p-5 space-y-8">
            {/* Utama */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="text-slate-500 w-5 h-5" />
                  <span className="font-medium text-slate-700">Jenis Kegiatan:</span>
                </div>
                <p className="pl-7">{item.jenis}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserCog className="text-slate-500 w-5 h-5" />
                  <span className="font-medium text-slate-700">Pelaksana:</span>
                </div>
                <p className="pl-7">{item.pelaksana || "-"}</p>
              </div>

              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center gap-2">
                  <StickyNote className="text-slate-500 w-5 h-5" />
                  <span className="font-medium text-slate-700">Catatan:</span>
                </div>
                <p className="pl-7 whitespace-pre-wrap">{item.catatan || "-"}</p>
              </div>
            </div>

            {/* Teknis (opsional) */}
            {hasDetailTeknis ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Detail Teknis</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">Strategi</div>
                    <div className="font-medium">{labelStrategi(item.strategi)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">Jenis Pekerjaan</div>
                    <div className="font-medium">{labelJenisPekerjaan(item.jenisPekerjaan)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <Timer size={14} /> Downtime (jam)
                    </div>
                    <div className="font-medium">
                      {item.downtimeJam != null && item.downtimeJam !== "" ? num(item.downtimeJam) : "-"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">Biaya Material</div>
                    <div className="font-medium">{toRupiah(item.biayaMaterial)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">Biaya Jasa</div>
                    <div className="font-medium">{toRupiah(item.biayaJasa)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <Calculator size={14} /> Subtotal (Material + Jasa)
                    </div>
                    <div className="font-medium">{toRupiah(subtotal)}</div>
                  </div>
                </div>

                {/* Suku cadang */}
                {item.sukuCadang && item.sukuCadang.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <Boxes size={16} /> Suku Cadang
                    </div>
                    <div className="overflow-auto rounded border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                          <tr>
                            <th className="px-3 py-2 text-left">Nama</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-left">Satuan</th>
                            <th className="px-3 py-2 text-right">Harga</th>
                            <th className="px-3 py-2 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.sukuCadang.map((s, i) => {
                            const sub = num(s.qty) * num(s.harga);
                            return (
                              <tr key={`${s.nama}-${i}`} className="border-t">
                                <td className="px-3 py-2">{s.nama || "-"}</td>
                                <td className="px-3 py-2 text-right">{s.qty ?? "-"}</td>
                                <td className="px-3 py-2">{s.satuan || "-"}</td>
                                <td className="px-3 py-2 text-right">{toRupiah(s.harga)}</td>
                                <td className="px-3 py-2 text-right">{toRupiah(sub)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-slate-50 font-semibold">
                            <td className="px-3 py-2 text-right" colSpan={4}>
                              Total Suku Cadang
                            </td>
                            <td className="px-3 py-2 text-right">{toRupiah(partsTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                Rincian teknis belum diisi. Jika diperlukan, klik <b>Edit</b> untuk menambahkan
                strategi, jenis pekerjaan, downtime, biaya material/jasa, dan suku cadang.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
