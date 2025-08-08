"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import {
  Home,
  Package,
  Settings,
  ClipboardList,
  BarChart3,
  LogOut,
  User,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  if (!user) return null;

  const menus = [
    { name: "Dashboard", path: "/dashboard", icon: <Home size={18} />, roles: ["ADMIN"] },
    {
      name: "Inventarisasi",
      path: "/inventarisasi",
      icon: <Package size={18} />,
      roles: ["ADMIN", "PETUGAS"],
    },
    {
      name: "Pemeliharaan",
      path: "/pemeliharaan",
      icon: <ClipboardList size={18} />,
      roles: ["ADMIN", "TEKNISI"],
    },
    {
      name: "Laporan",
      path: "/laporan",
      icon: <BarChart3 size={18} />,
      roles: ["ADMIN", "PIMPINAN"],
    },
    {
      name: "Profil",
      path: "/profil",
      icon: <User size={18} />,
      roles: ["ADMIN", "PETUGAS", "TEKNISI", "PIMPINAN"],
    },
  ];

  const handleLogout = () => {
    Cookies.remove("token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <aside className="w-64 bg-blue-800 text-white min-h-screen flex flex-col p-6 shadow-lg">
      {/* Header */}
      <div className="mb-8 border-b border-blue-600 pb-4">
        <h2 className="text-2xl font-bold tracking-tight">🔧 PDAM Aset</h2>
        <p className="mt-1 text-sm text-blue-100">
          👤 {user.nama} <br />
          🔑 {user.role}
        </p>
      </div>

      {/* Menu */}
      <nav className="flex flex-col gap-1">
        {menus
          .filter((menu) => menu.roles.includes(user.role))
          .map((menu) => (
            <Link
              key={menu.path}
              href={menu.path}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition font-medium ${
                pathname === menu.path
                  ? "bg-blue-600 text-white shadow"
                  : "hover:bg-blue-700 text-blue-100"
              }`}
            >
              {menu.icon}
              <span>{menu.name}</span>
            </Link>
          ))}
      </nav>

      {/* Logout */}
      <div className="mt-auto pt-6 border-t border-blue-600">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
