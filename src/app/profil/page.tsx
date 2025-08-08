"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  nama: string;
  email: string;
  role: string;
  hp?: string;
}

export default function Profil() {
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const router = useRouter();

  // 🔐 Ambil data dari localStorage dan fetch dari backend
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.replace("/login");
      return;
    }

    const parsed = JSON.parse(stored);
    const id = parsed?.id;

    fetch(`/api/profil/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal mengambil data pengguna");
        }
        const data = await res.json();
        setUser(data);
        setForm(data);
      })
      .catch((err) => {
        console.error(err);
        setMessage("❌ Gagal memuat profil");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    Cookies.remove("token");
    localStorage.clear();
    router.push("/login");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!form) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    try {
      const res = await fetch(`/api/profil/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal update profil");
      }

      const updated = await res.json();
      setUser(updated);
      setForm(updated);
      localStorage.setItem("user", JSON.stringify(updated));
      setMessage("✅ Profil berhasil diperbarui");
      setEditMode(false);
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ ${err.message}`);
    }
  };

  if (loading) {
    return (
      <main className="flex justify-center items-center min-h-screen bg-gray-100">
        <p className="text-gray-600 animate-pulse">⏳ Memuat data profil...</p>
      </main>
    );
  }

  if (!user || !form) {
    return (
      <main className="flex justify-center items-center min-h-screen bg-red-50">
        <p className="text-red-600 font-semibold">
          ❌ Gagal memuat profil pengguna
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-gray-800">
      <div className="max-w-2xl mx-auto py-10 px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">Profil Pengguna</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          {!editMode ? (
            <>
              <div className="flex items-center gap-5">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.nama
                  )}&background=0D8ABC&color=fff`}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full border"
                />
                <div>
                  <h2 className="text-xl font-semibold">{user.nama}</h2>
                  <p className="text-gray-600">{user.email}</p>
                  <p className="text-sm text-gray-500">Role: {user.role}</p>
                </div>
              </div>

              <p className="text-sm">
                <strong>Nomor HP:</strong> {user.hp || "-"}
              </p>

              <button
                onClick={() => setEditMode(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Edit Profil
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-medium text-sm">Nama</label>
                <input
                  type="text"
                  name="nama"
                  value={form.nama}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 mt-1"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-sm">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 mt-1"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-sm">Nomor HP</label>
                <input
                  type="text"
                  name="hp"
                  value={form.hp || ""}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 mt-1"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setForm(user);
                  }}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {message && (
            <p
              className={`text-center font-semibold ${
                message.startsWith("✅")
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
