"use client";

import { useState } from "react";
import { UserRound, Mail, Lock, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const [form, setForm] = useState({
    nama: "",
    email: "",
    password: "",
    role: "PETUGAS",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (form.password.length < 6) {
      setMessage("❌ Password minimal 6 karakter");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`❌ ${data.error || "Registrasi gagal"}`);
        return;
      }

      setMessage("✅ Registrasi berhasil, silakan login!");
      setForm({ nama: "", email: "", password: "", role: "PETUGAS" });
    } catch (error) {
      setMessage("❌ Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-gray-800">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-6">
          <ShieldCheck className="mx-auto w-10 h-10 text-blue-600" />
          <h1 className="text-2xl font-bold text-blue-700 mt-2">
            Daftar Akun Baru
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nama */}
          <div>
            <label className="block font-semibold mb-1">Nama Lengkap</label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="nama"
                value={form.nama}
                onChange={handleChange}
                required
                placeholder="Masukkan nama lengkap"
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block font-semibold mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="contoh@email.com"
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block font-semibold mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block font-semibold mb-1">Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              <option value="ADMIN">Admin</option>
              <option value="PETUGAS">Petugas</option>
              <option value="PIMPINAN">Pimpinan</option>
              <option value="TEKNISI">Teknisi</option>
            </select>
          </div>

          {/* Tombol */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Mendaftarkan..." : "Daftar"}
          </button>
        </form>

        {/* Message */}
        {message && (
          <p
            className={`mt-6 text-center font-semibold text-sm ${
              message.startsWith("✅")
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
