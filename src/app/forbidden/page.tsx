"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LockClosedIcon } from "@heroicons/react/24/solid"; // ✅ import heroicon

export default function ForbiddenPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const goToDefaultPage = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    switch (user.role) {
      case "ADMIN":
        router.push("/dashboard");
        break;
      case "PETUGAS":
        router.push("/inventarisasi");
        break;
      case "TEKNISI":
        router.push("/pemeliharaan");
        break;
      case "PIMPINAN":
        router.push("/laporan");
        break;
      default:
        router.push("/profil");
    }
  };

  return (
    <main className="flex h-screen items-center justify-center bg-gradient-to-br from-red-100 to-red-200">
      <div className="bg-white p-10 rounded-xl shadow-xl text-center max-w-md">
        <LockClosedIcon className="w-16 h-16 text-red-500 mx-auto mb-4" /> 
        <h1 className="text-6xl font-bold text-red-600 mb-6">403</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Akses Ditolak
        </h2>
        <p className="text-gray-600 mb-6">
          Anda tidak memiliki hak untuk mengakses halaman ini.
        </p>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => router.back()}
            className="bg-gray-300 text-gray-800 px-5 py-2 rounded-lg hover:bg-gray-400"
          >
            Kembali
          </button>
          <button
            onClick={goToDefaultPage}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
          >
            Halaman Utama
          </button>
        </div>

        {user && (
          <p className="mt-6 text-sm text-gray-500">
            Masuk sebagai: <span className="font-semibold">{user.role}</span>
          </p>
        )}
      </div>
    </main>
  );
}
