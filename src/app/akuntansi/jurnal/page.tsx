"use client";
import React from "react";
import Link from "next/link";
import { Search, BookOpen, Plus } from "lucide-react";
import AkShell, { glass } from "@/components/AkShell";

type Row = {
  id: number;
  nomor: string;
  tanggal: string;
  status: string;
  sumber: string;
  memo: string | null;
  refId: number | null;
  _count: { lines: number };
};

export default function Page() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const data: Row[] = await fetch("/api/akuntansi/jurnal?limit=50").then((r) => r.json());
      setRows(data);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(
   (r) =>
      !q ||
      r.nomor.toLowerCase().includes(q.toLowerCase()) ||
      (r.memo || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AkShell title="Jurnal" subtitle="Daftar jurnal terbaru" full>
      <div className={`${glass} p-4`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-96">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nomor/memo…"
              className="h-10 w-full rounded-lg border border-white/10 bg-white/10 pl-9 pr-3 text-sm placeholder:text-slate-300/60 outline-none"
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300/70" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/akuntansi/jurnal/tambah"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-400/20 px-3 py-2 text-sm text-indigo-100 hover:bg-indigo-400/30"
              title="Buat Jurnal"
            >
              <Plus className="h-4 w-4" />
              Tambah Jurnal
            </Link>

            <Link
              href="/akuntansi/laporan"
              className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
              Ke Laporan
            </Link>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          {loading ? (
            <div className="h-24 animate-pulse bg-white/5" />
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-300/80">Tidak ada data.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left">Nomor</th>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Sumber</th>
                  <th className="px-3 py-2 text-left">Memo</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-white/10 hover:bg-white/[0.03]">
                    <td className="px-3 py-2 font-medium">{r.nomor}</td>
                    <td className="px-3 py-2">
                      {new Date(r.tanggal).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                    </td>
                    <td className="px-3 py-2">{r.sumber}</td>
                    <td className="px-3 py-2">{r.memo || "—"}</td>
                    <td className="px-3 py-2 text-right">{r._count.lines}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/akuntansi/jurnal/${r.id}`}
                          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
                          title="Detail jurnal"
                        >
                          <BookOpen className="h-4 w-4" />
                          Detail
                        </Link>

                        {r.sumber === "GUDANG" && r.refId ? (
                          <Link
                            href={`/gudang/transaksi/${r.refId}`}
                            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
                            title="Buka sumber transaksi"
                          >
                            <BookOpen className="h-4 w-4" />
                            Sumber
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AkShell>
  );
}
