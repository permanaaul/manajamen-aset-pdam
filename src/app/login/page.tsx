"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { LogIn, UserRound, Lock } from "lucide-react";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("⏳ Sedang memproses...");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`❌ ${data.error || "Login gagal"}`);
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      Cookies.set("token", data.token, { expires: 1 });

      setMessage("✅ Login berhasil!");

      setTimeout(() => {
        if (data.user.role === "ADMIN") {
          window.location.href = "/dashboard";
        } else if (data.user.role === "PIMPINAN") {
          window.location.href = "/laporan";
        } else if (data.user.role === "TEKNISI") {
          window.location.href = "/pemeliharaan";
        } else {
          window.location.href = "/inventarisasi";
        }
      }, 1200);
    } catch (error) {
      setMessage("❌ Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen items-center justify-center bg-gradient-to-br from-sky-600 to-indigo-800 text-gray-800">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
        <div className="text-center mb-6">
          <LogIn className="mx-auto w-10 h-10 text-blue-600" />
          <h1 className="text-2xl font-bold text-blue-700 mt-2">
            Login Sistem Aset PDAM
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Email</label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="Masukkan email"
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Masukkan password"
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? (
              <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center font-semibold text-sm text-gray-700">
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-gray-600 text-sm">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="text-blue-600 font-semibold hover:underline"
          >
            Daftar
          </Link>
        </p>
      </div>
    </main>
  );
}
