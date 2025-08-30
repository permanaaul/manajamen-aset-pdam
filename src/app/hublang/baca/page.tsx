// app/hublang/baca/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type Bacaan = {
  id: number;
  sambunganId: number;
  angkaLalu: number;
  angkaKini?: number;
  pakaiM3?: number;
  anomali?: boolean;
  status?: "DRAFT" | "TERVERIFIKASI";
  tanggalBaca?: string | null; // untuk <input type="datetime-local">
  catatan?: string | null;     // tetap ada di state, tapi tidak ditampilkan di tabel
  pelangganNama?: string | null;
  noSambungan?: string | null;
  golonganTarifId?: number | null;
  golonganTarifKode?: string | null;
};

function fmtMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function extractDigits(text: string, minLen = 1): number | null {
  if (!text) return null;
  const matches = text.replace(/[^\d]/g, " ").match(/\d+/g) || [];
  if (matches.length === 0) return null;
  let best = "";
  for (const s of matches) if (s.length > best.length && s.length >= minLen) best = s;
  if (!best) return null;
  const n = parseInt(best, 10);
  return Number.isFinite(n) ? n : null;
}

const toIsoLocal = (s?: string | null) => {
  if (!s) return undefined;
  let v = s.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) v = v.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v = v + ":00";
  return v;
};

const isoToLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function PageBaca() {
  const [periode, setPeriode] = useState<string>(fmtMonth());
  const [ruteId, setRuteId] = useState<string>("");
  const [rows, setRows] = useState<Bacaan[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [ocr, setOcr] = useState<Record<number, {
    imageUrl?: string;
    reading?: boolean;
    progress?: number;
    text?: string;
    digits?: number | null;
    confidence?: number;
  }>>({});

  const urlBag = useRef<string[]>([]);
  const hasSelection = selectedIds.length > 0;

  const handleInit = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/hublang/baca/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periode,
          ruteId: ruteId ? Number(ruteId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal init");

      setRows(
        (data.data ?? []).map((x: any): Bacaan => ({
          id: x.id,
          sambunganId: x.sambunganId,
          angkaLalu: x.angkaLalu ?? 0,
          angkaKini: x.angkaKini ?? undefined,
          pakaiM3: x.pakaiM3 ?? undefined,
          anomali: x.anomali ?? undefined,
          status: x.status,
          tanggalBaca: isoToLocalInput(x.tanggalBaca),
          catatan: x.catatan ?? "", // tetap diterima, tapi tidak diedit di UI
          noSambungan: x.noSambungan ?? null,
          pelangganNama: x.pelangganNama ?? null,
          golonganTarifId: x.golonganTarifId ?? null,
          golonganTarifKode: x.golonganTarifKode ?? null,
        }))
      );
      setSelectedIds([]);
      setMsg(`OK, ${data.count} bacaan siap.`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const patchRow = async (row: Bacaan) => {
    const { id, angkaKini, tanggalBaca, catatan } = row;
    const res = await fetch(`/api/hublang/baca/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        angkaKini: Number(angkaKini ?? 0),
        tanggalBaca: toIsoLocal(tanggalBaca),
        catatan, // masih dikirim agar kompatibel dengan API lama (tidak tampil di UI)
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Gagal simpan");
    return data as { id: number; pakaiM3: number; anomali: boolean };
  };

  const handleSave = async (id: number) => {
    setLoading(true);
    setMsg("");
    try {
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error("Baris tidak ditemukan");
      const result = await patchRow(row);
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, pakaiM3: result.pakaiM3, anomali: result.anomali } : r
        )
      );
      setMsg("Tersimpan.");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!hasSelection) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/hublang/baca/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal verifikasi");
      setRows((prev) =>
        prev.map((r) =>
          selectedIds.includes(r.id) ? { ...r, status: "TERVERIFIKASI" } : r
        )
      );
      setSelectedIds([]);
      setMsg(`Terverifikasi: ${data.updated} baris.`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onPickImage = (id: number, file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    urlBag.current.push(url);
    setOcr((prev) => ({
      ...prev,
      [id]: { ...prev[id], imageUrl: url, progress: 0, text: "", digits: null },
    }));
    setTimeout(() => runOCR(id), 0);
  };

  const clearImage = (id: number) => {
    const url = ocr[id]?.imageUrl;
    if (url) {
      URL.revokeObjectURL(url);
      urlBag.current = urlBag.current.filter((u) => u !== url);
    }
    setOcr((prev) => ({
      ...prev,
      [id]: { imageUrl: undefined, progress: 0, text: "", digits: null, reading: false },
    }));
  };

  const runOCR = async (id: number) => {
    const cur = ocr[id];
    if (!cur?.imageUrl || cur.reading) return;

    setOcr((prev) => ({ ...prev, [id]: { ...prev[id], reading: true, progress: 0 } }));

    try {
      const { createWorker } = await import("tesseract.js");

      const worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m?.status === "recognizing text" && typeof m.progress === "number") {
            setOcr((prev) => ({
              ...prev,
              [id]: { ...prev[id], progress: m.progress },
            }));
          }
        },
      });

      await worker.setParameters({ tessedit_char_whitelist: "0123456789" });

      const { data } = await worker.recognize(cur.imageUrl);

      const digits = extractDigits(data?.text || "");
      const confidence =
        typeof (data as any)?.confidence === "number"
          ? (data as any).confidence
          : Array.isArray((data as any)?.words) && (data as any).words.length
          ? Math.round(
              (((data as any).words.reduce(
                (s: number, w: any) => s + (w.confidence || 0),
                0
              ) / (data as any).words.length) as number) * 10
            ) / 10
          : undefined;

      setOcr((prev) => ({
        ...prev,
        [id]: { ...prev[id], text: data?.text, digits: digits ?? null, confidence, reading: false, progress: 1 },
      }));

      if (digits != null) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, angkaKini: digits } : r)));
        setMsg("OCR berhasil → Angka Kini terisi.");
      } else {
        setMsg("OCR tidak menemukan angka valid. Input manual atau ambil foto lebih fokus/terang.");
      }

      await worker.terminate();
    } catch {
      setOcr((prev) => ({ ...prev, [id]: { ...prev[id], reading: false } }));
      setMsg("OCR gagal dijalankan.");
    }
  };

  useEffect(() => {
    return () => {
      urlBag.current.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch {}
      });
      urlBag.current = [];
    };
  }, []);

  useEffect(() => {
    handleInit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, ruteId]);

  const totalSelected = selectedIds.length;

  return (
    <div className="p-6 space-y-4 text-gray-900">
      <h1 className="text-2xl font-semibold">Baca Meter</h1>

      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl p-4 shadow border border-gray-200">
        <div>
          <label className="block text-sm text-gray-700">Periode</label>
          <input
            type="month"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Rute (opsional)</label>
          <input
            type="number"
            placeholder="ruteId"
            value={ruteId}
            onChange={(e) => setRuteId(e.target.value)}
            className="border rounded px-3 py-2 w-40 text-sm"
          />
        </div>
        <button
          onClick={handleInit}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
        >
          {loading ? "Memuat..." : "Init / Refresh"}
        </button>
        <button
          onClick={handleVerify}
          disabled={!hasSelection || loading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          title={hasSelection ? `Verifikasi ${totalSelected} baris` : "Pilih baris dulu"}
        >
          Verifikasi (Selected)
        </button>
        {msg && <p className="text-sm text-gray-800">{msg}</p>}
      </div>

      <div className="overflow-auto bg-white rounded-xl shadow border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 w-10">✔</th>
              <th className="p-3">No</th>
              <th className="p-3">Pelanggan</th>
              <th className="p-3">No Sambungan</th>
              <th className="p-3">Angka Lalu</th>
              <th className="p-3">Angka Kini</th>
              <th className="p-3">Foto Meter & OCR</th>
              <th className="p-3">Pakai (m³)</th>
              <th className="p-3">Anomali</th>
              <th className="p-3">Tanggal Baca</th>
              {/* << ganti kolom Catatan dengan Golongan Tarif >> */}
              <th className="p-3">Golongan Tarif</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-6 text-center text-gray-500">
                  Belum ada data. Klik "Init / Refresh".
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const o = ocr[r.id] ?? {};
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        disabled={r.status === "TERVERIFIKASI"}
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)
                          )
                        }
                      />
                    </td>
                    <td className="p-3">{idx + 1}</td>
                    <td className="p-3">{r.pelangganNama ?? "—"}</td>
                    <td className="p-3">{r.noSambungan ?? "—"}</td>
                    <td className="p-3">{r.angkaLalu}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        className="border rounded px-2 py-1 w-28"
                        value={r.angkaKini ?? ""}
                        disabled={r.status === "TERVERIFIKASI"}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id
                                ? {
                                    ...x,
                                    angkaKini:
                                      e.target.value === "" ? undefined : Number(e.target.value),
                                  }
                                : x
                            )
                          )
                        }
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="text-xs"
                          disabled={r.status === "TERVERIFIKASI"}
                          onChange={(e) => onPickImage(r.id, e.target.files?.[0])}
                        />
                        {o.imageUrl ? (
                          <div className="flex items-start gap-3">
                            <img src={o.imageUrl} alt="preview" className="w-28 h-16 object-cover rounded border" />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => runOCR(r.id)}
                                  disabled={o.reading}
                                  className="px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                                >
                                  {o.reading ? "Membaca…" : "Baca OCR"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearImage(r.id)}
                                  disabled={o.reading}
                                  className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                                >
                                  Hapus
                                </button>
                              </div>
                              {typeof o.progress === "number" && o.reading && (
                                <div className="w-40 h-2 bg-gray-200 rounded">
                                  <div className="h-2 rounded bg-indigo-600" style={{ width: `${Math.round((o.progress || 0) * 100)}%` }} />
                                </div>
                              )}
                              {o.digits != null && (
                                <div className="text-xs text-emerald-700">
                                  OCR: <b>{o.digits}</b>
                                  {typeof o.confidence === "number" && (
                                    <span className="text-gray-500"> (conf {o.confidence}%)</span>
                                  )}
                                </div>
                              )}
                              {!o.digits && o.text && (
                                <div className="text-xs text-gray-600 break-all max-w-xs">Raw: {o.text}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">Unggah foto display meter, lalu klik “Baca OCR”.</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{r.pakaiM3 ?? "—"}</td>
                    <td className="p-3">
                      {r.anomali == null ? (
                        "—"
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            r.anomali ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {r.anomali ? "Anomali" : "Normal"}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <input
                        type="datetime-local"
                        className="border rounded px-2 py-1"
                        value={r.tanggalBaca ?? ""}
                        disabled={r.status === "TERVERIFIKASI"}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id ? { ...x, tanggalBaca: e.target.value } : x
                            )
                          )
                        }
                      />
                    </td>

                    {/* Kolom baru: Golongan Tarif */}
                    <td className="p-3">
                      {r.golonganTarifId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                          <span className="font-mono">{r.golonganTarifId}</span>
                          <span className="text-gray-600">—</span>
                          <span className="font-semibold">{r.golonganTarifKode ?? "—"}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="p-3">{r.status ?? "DRAFT"}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleSave(r.id)}
                        disabled={loading || r.status === "TERVERIFIKASI"}
                        className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
