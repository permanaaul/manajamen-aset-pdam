"use client";
import React, { useEffect, useMemo, useState } from "react";

/* ========= Types ========= */
type Pelanggan = {
  kode: string;
  nama: string;
  tipe: "SOSIAL" | "NIAGA" | "INSTANSI" | "LAINNYA";
  hp: string;
  email: string;
  alamatJalan: string;
  rt: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  kota: string;
  aktif: boolean;
};

type Sambungan = {
  noSambungan: string;
  golonganTarifId: string; // value di-select (string angka)
  diameterMm: string;
  alamatSambungan: string;
  ruteId: string;
  tanggalPasang: string; // from <input type="datetime-local">
  lat: string;
  lng: string;
};

type TarifOpt = {
  id: number;
  kode: string;
  nama: string;
};

/* ========= Small UI helpers ========= */
const L = ({ children }: { children: React.ReactNode }) => (
  <label className="text-sm text-gray-700">{children}</label>
);

const I: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    autoComplete="off"
    className={`border rounded w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${props.className || ""}`}
  />
);

/* ========= Initial ========= */
const initialPelanggan: Pelanggan = {
  kode: "",
  nama: "",
  tipe: "SOSIAL",
  hp: "",
  email: "",
  alamatJalan: "",
  rt: "",
  rw: "",
  kelurahan: "",
  kecamatan: "",
  kota: "",
  aktif: true,
};

const initialSambungan: Sambungan = {
  noSambungan: "",
  golonganTarifId: "",
  diameterMm: "",
  alamatSambungan: "",
  ruteId: "",
  tanggalPasang: "",
  lat: "",
  lng: "",
};

/* ========= Utils ========= */
const toIsoLocal = (s: string | undefined) => {
  if (!s) return undefined;
  let v = s.trim();
  const m1 = v.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})$/);
  if (m1) {
    const [, dd, mm, yyyy, HH, MM] = m1;
    return `${yyyy}-${mm}-${dd}T${HH}:${MM}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) v = v.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v = v + ":00";
  return v;
};

/* ========= Page ========= */
export default function PageMasterPelangganSambungan() {
  const [pelanggan, setPelanggan] = useState<Pelanggan>(initialPelanggan);
  const [sambungan, setSambungan] = useState<Sambungan>(initialSambungan);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // daftar tarif utk dropdown
  const [tarifList, setTarifList] = useState<TarifOpt[]>([]);
  const [loadingTarif, setLoadingTarif] = useState(false);

  // Load daftar golongan tarif (nama/kode) untuk dropdown
  useEffect(() => {
    const load = async () => {
      setLoadingTarif(true);
      try {
        const res = await fetch("/api/hublang/tarif?limit=1000&sort=id_asc");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal memuat tarif");
        // Expect: { items: [{id,kode,nama,...}], total: n }
        const items = (data.items || []) as any[];
        setTarifList(
          items.map((x) => ({
            id: x.id,
            kode: x.kode ?? "",
            nama: x.nama ?? "",
          }))
        );
      } catch (e: any) {
        setTarifList([]);
        console.error(e);
        setMsg(`❌ ${e.message}`);
      } finally {
        setLoadingTarif(false);
      }
    };
    load();
  }, []);

  // Validasi
  useEffect(() => {
    const e: Record<string, string> = {};
    if (!pelanggan.kode.trim()) e["pelanggan.kode"] = "Wajib diisi";
    if (!pelanggan.nama.trim()) e["pelanggan.nama"] = "Wajib diisi";
    if (!sambungan.noSambungan.trim()) e["sambungan.noSambungan"] = "Wajib diisi";
    if (!sambungan.golonganTarifId.trim()) e["sambungan.golonganTarifId"] = "Wajib dipilih";
    if (!sambungan.diameterMm.trim()) e["sambungan.diameterMm"] = "Wajib diisi";
    setErrors(e);
  }, [pelanggan, sambungan]);

  const requiredOk = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const handleReset = (keepMsg = false) => {
    setPelanggan(initialPelanggan);
    setSambungan(initialSambungan);
    if (!keepMsg) setMsg("");
    setErrors({});
  };

  const submit = async () => {
    if (saving) return;
    setMsg("");

    if (!requiredOk) {
      setMsg("Periksa kembali field wajib yang belum diisi.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        pelanggan,
        sambungan: {
          ...sambungan,
          golonganTarifId: Number(sambungan.golonganTarifId), // kirim ID (hasil pilih nama)
          diameterMm: Number(sambungan.diameterMm),
          ruteId: sambungan.ruteId ? Number(sambungan.ruteId) : undefined,
          lat: sambungan.lat ? Number(sambungan.lat) : undefined,
          lng: sambungan.lng ? Number(sambungan.lng) : undefined,
          tanggalPasang: toIsoLocal(sambungan.tanggalPasang),
        },
      };

      const res = await fetch("/api/hublang/pelanggan-sambungan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal simpan");

      setMsg(`✅ Tersimpan — pelanggan #${data.pelanggan?.id}, sambungan #${data.sambungan?.id}`);
      handleReset(true);
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const err = (k: string) =>
    errors[k] ? <p className="text-xs text-red-600 mt-1">{errors[k]}</p> : null;

  const onFormSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    submit();
  };

  return (
    <div className="p-6 space-y-5 text-gray-900">
      <div>
        <h1 className="text-2xl font-semibold">Pelanggan + Sambungan</h1>
        <p className="text-sm text-gray-600">
          Minimal: <b>Kode</b>, <b>Nama</b>, <b>No Sambungan</b>, <b>Golongan Tarif</b>, <b>Diameter</b>.
        </p>
      </div>

      <form onSubmit={onFormSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pelanggan */}
        <div className="bg-white p-5 rounded-2xl shadow border border-gray-200">
          <h2 className="font-semibold mb-3">Pelanggan</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <L>Kode <span className="text-red-600">*</span></L>
              <I
                name="kode"
                value={pelanggan.kode}
                onChange={(e) => setPelanggan((p) => ({ ...p, kode: e.target.value }))}
                placeholder="cth: CUST-001"
              />
              {err("pelanggan.kode")}
            </div>
            <div>
              <L>Nama <span className="text-red-600">*</span></L>
              <I
                name="nama"
                value={pelanggan.nama}
                onChange={(e) => setPelanggan((p) => ({ ...p, nama: e.target.value }))}
                placeholder="Nama pelanggan"
              />
              {err("pelanggan.nama")}
            </div>

            <div>
              <L>Tipe</L>
              <select
                name="tipe"
                className="border rounded w-full px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={pelanggan.tipe}
                onChange={(e) => setPelanggan((p) => ({ ...p, tipe: e.target.value as Pelanggan["tipe"] }))}
              >
                {["SOSIAL", "NIAGA", "INSTANSI", "LAINNYA"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Kategori tarif/non-air.</p>
            </div>
            <div>
              <L>HP</L>
              <I
                name="hp"
                inputMode="numeric"
                value={pelanggan.hp}
                onChange={(e) => setPelanggan((p) => ({ ...p, hp: e.target.value }))}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div>
              <L>Email</L>
              <I
                name="email"
                type="email"
                value={pelanggan.email}
                onChange={(e) => setPelanggan((p) => ({ ...p, email: e.target.value }))}
                placeholder="nama@email.com"
                autoComplete="email"
              />
            </div>
            <div className="col-span-2">
              <L>Alamat</L>
              <I
                name="alamatJalan"
                value={pelanggan.alamatJalan}
                onChange={(e) => setPelanggan((p) => ({ ...p, alamatJalan: e.target.value }))}
                placeholder="Nama jalan & nomor"
                autoComplete="address-line1"
              />
            </div>
            <div>
              <L>RT</L>
              <I name="rt" value={pelanggan.rt} onChange={(e) => setPelanggan((p) => ({ ...p, rt: e.target.value }))} />
            </div>
            <div>
              <L>RW</L>
              <I name="rw" value={pelanggan.rw} onChange={(e) => setPelanggan((p) => ({ ...p, rw: e.target.value }))} />
            </div>
            <div>
              <L>Kelurahan</L>
              <I name="kelurahan" value={pelanggan.kelurahan} onChange={(e) => setPelanggan((p) => ({ ...p, kelurahan: e.target.value }))} />
            </div>
            <div>
              <L>Kecamatan</L>
              <I name="kecamatan" value={pelanggan.kecamatan} onChange={(e) => setPelanggan((p) => ({ ...p, kecamatan: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <L>Kota</L>
              <I name="kota" value={pelanggan.kota} onChange={(e) => setPelanggan((p) => ({ ...p, kota: e.target.value }))} />
            </div>
            <label className="col-span-2 flex items-center gap-2 mt-1 select-none">
              <input
                type="checkbox"
                checked={pelanggan.aktif}
                onChange={(e) => setPelanggan((p) => ({ ...p, aktif: e.target.checked }))}
              />
              <span className="text-sm">Aktif</span>
            </label>
          </div>
        </div>

        {/* Sambungan */}
        <div className="bg-white p-5 rounded-2xl shadow border border-gray-200">
          <h2 className="font-semibold mb-3">Sambungan</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <L>No Sambungan <span className="text-red-600">*</span></L>
              <I
                name="noSambungan"
                value={sambungan.noSambungan}
                onChange={(e) => setSambungan((p) => ({ ...p, noSambungan: e.target.value }))}
                placeholder="cth: NS-0003"
              />
              {err("sambungan.noSambungan")}
            </div>

            {/* Ganti: pilih berdasarkan NAMA/KODE, value = ID */}
            <div>
              <L>Golongan Tarif <span className="text-red-600">*</span></L>
              <select
                name="golonganTarifId"
                className="border rounded w-full px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={sambungan.golonganTarifId}
                onChange={(e) => setSambungan((p) => ({ ...p, golonganTarifId: e.target.value }))}
                disabled={loadingTarif}
              >
                <option value="">{loadingTarif ? "Memuat..." : "— Pilih golongan —"}</option>
                {tarifList.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.kode ? `${t.kode} — ${t.nama}` : t.nama}
                  </option>
                ))}
              </select>
              {err("sambungan.golonganTarifId")}
              <p className="text-xs text-gray-500 mt-1">
                Pilih berdasarkan nama/kode. Sistem menyimpan ID secara otomatis.
              </p>
            </div>

            <div>
              <L>Diameter (mm) <span className="text-red-600">*</span></L>
              <I
                name="diameterMm"
                inputMode="numeric"
                value={sambungan.diameterMm}
                onChange={(e) => setSambungan((p) => ({ ...p, diameterMm: e.target.value }))}
                placeholder="15"
              />
              {err("sambungan.diameterMm")}
            </div>

            <div>
              <L>Rute ID</L>
              <I
                name="ruteId"
                inputMode="numeric"
                value={sambungan.ruteId}
                onChange={(e) => setSambungan((p) => ({ ...p, ruteId: e.target.value }))}
                placeholder="opsional"
              />
            </div>

            <div className="col-span-2">
              <L>Alamat Sambungan</L>
              <I
                name="alamatSambungan"
                value={sambungan.alamatSambungan}
                onChange={(e) => setSambungan((p) => ({ ...p, alamatSambungan: e.target.value }))}
              />
            </div>

            <div>
              <L>Tanggal Pasang</L>
              <I
                name="tanggalPasang"
                type="datetime-local"
                value={sambungan.tanggalPasang}
                onChange={(e) => setSambungan((p) => ({ ...p, tanggalPasang: e.target.value }))}
              />
            </div>
            <div>
              <L>Lat</L>
              <I
                name="lat"
                inputMode="decimal"
                value={sambungan.lat}
                onChange={(e) => setSambungan((p) => ({ ...p, lat: e.target.value }))}
                placeholder="-6.9…"
              />
            </div>
            <div>
              <L>Lng</L>
              <I
                name="lng"
                inputMode="decimal"
                value={sambungan.lng}
                onChange={(e) => setSambungan((p) => ({ ...p, lng: e.target.value }))}
                placeholder="107.6…"
              />
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
          <button
            type="button"
            onClick={() => handleReset()}
            disabled={saving}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-60 text-gray-900"
          >
            Reset
          </button>
          {msg && (
            <p className="text-sm text-gray-800" aria-live="polite">
              {msg}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
