"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import {
  Home,
  Package,
  ClipboardList,
  BarChart3,
  LogOut,
  User,
  ChevronDown,
  NotebookText,  // Jurnal
  Tags,          // Kategori Biaya
  Building2,     // Unit Biaya
  PiggyBank,
  Layers,        // Anggaran
  ScrollText,    // Jurnal Umum (GL)
  History,       // Posting GL
  ReceiptText,   // <-- baru: Voucher
  Scale          // <-- baru: Neraca (Balance Sheet)
} from "lucide-react";

type Role = "ADMIN" | "PETUGAS" | "TEKNISI" | "PIMPINAN" | "GUEST";
type UserLocal = { nama: string; role: Exclude<Role, "GUEST"> } | null;

export default function Sidebar() {
  const pathname = usePathname();

  // ---- hooks selalu dipanggil di top-level (tidak ada early return) ----
  const [user, setUser] = useState<UserLocal>(null);
  const [akOpen, setAkOpen] = useState(false);

  // baca user dari localStorage
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  // auto-expand grup Akuntansi kalau sedang di rutenya
  useEffect(() => {
    if (pathname?.startsWith("/akuntansi")) setAkOpen(true);
  }, [pathname]);

  // fallback role saat user belum ada -> tidak menampilkan menu apapun
  const role: Role = (user?.role as Role) ?? "GUEST";

  const can = (roles: Role[]) => roles.includes(role);
  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + "/");

  // top menus
  const topMenus = [
    { name: "Dashboard", path: "/dashboard", icon: <Home size={18} />, roles: ["ADMIN"] as Role[] },
    { name: "Inventarisasi", path: "/inventarisasi", icon: <Package size={18} />, roles: ["ADMIN", "PETUGAS"] as Role[] },
    { name: "Pemeliharaan", path: "/pemeliharaan", icon: <ClipboardList size={18} />, roles: ["ADMIN", "TEKNISI"] as Role[] },
    { name: "Laporan", path: "/laporan", icon: <BarChart3 size={18} />, roles: ["ADMIN", "PIMPINAN"] as Role[] },
  ];

  // grup Akuntansi (submenu)
  const akChildren = [
    { name: "Ringkasan", path: "/akuntansi/ringkasan", icon: <BarChart3 size={16} />, roles: ["ADMIN","PIMPINAN","PETUGAS"] as Role[] },
    { name: "Jurnal Biaya", path: "/akuntansi/jurnal", icon: <NotebookText size={16} />, roles: ["ADMIN","PIMPINAN","PETUGAS"] as Role[] },

    // ==== GL / General Ledger ====
    { name: "Posting GL", path: "/akuntansi/gl/posting", icon: <History size={16} />, roles: ["ADMIN","PIMPINAN"] as Role[] },
    { name: "Jurnal Umum (GL)", path: "/akuntansi/gl", icon: <ScrollText size={16} />, roles: ["ADMIN","PIMPINAN"] as Role[] },

    // ==== Voucher & Laporan Posisi (Neraca) ====
    { name: "Voucher", path: "/akuntansi/voucher", icon: <ReceiptText size={16} />, roles: ["ADMIN","PIMPINAN"] as Role[] },
    { name: "Neraca", path: "/akuntansi/neraca", icon: <Scale size={16} />, roles: ["ADMIN","PIMPINAN"] as Role[] },

    { name: "Akun (COA)", path: "/akuntansi/akun", icon: <Layers size={16} />, roles: ["ADMIN","PIMPINAN"] as Role[] },
    { name: "Kategori Biaya", path: "/akuntansi/kategori-biaya", icon: <Tags size={16} />, roles: ["ADMIN","PIMPINAN"] as Role[] },
    { name: "Unit Biaya", path: "/akuntansi/unit-biaya", icon: <Building2 size={16} />, roles: ["ADMIN","PIMPINAN"] as Role[] },
    { name: "Anggaran", path: "/akuntansi/anggaran", icon: <PiggyBank size={16} />, roles: ["ADMIN","PIMPINAN"] as Role[] },
  ];

  const akVisibleChildren = useMemo(
    () => akChildren.filter((m) => can(m.roles)),
    // depend hanya pada role supaya stabil
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role]
  );

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
          👤 {user?.nama ?? "—"} <br />
          🔑 {user?.role ?? "GUEST"}
        </p>
      </div>

      {/* Menus */}
      <nav className="flex flex-col gap-1">
        {/* Top menus */}
        {topMenus
          .filter((m) => can(m.roles))
          .map((m) => (
            <Link
              key={m.path}
              href={m.path}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition font-medium ${
                isActive(m.path)
                  ? "bg-blue-600 text-white shadow"
                  : "hover:bg-blue-700 text-blue-100"
              }`}
            >
              {m.icon}
              <span>{m.name}</span>
            </Link>
          ))}

        {/* Grup Akuntansi */}
        {akVisibleChildren.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setAkOpen((v) => !v)}
              className={`w-full flex items-center justify-between px-4 py-2 rounded-lg font-medium transition ${
                pathname?.startsWith("/akuntansi")
                  ? "bg-blue-600 text-white shadow"
                  : "hover:bg-blue-700 text-blue-100"
              }`}
            >
              <span className="flex items-center gap-3">
                <BarChart3 size={18} />
                Akuntansi
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${akOpen ? "rotate-180" : ""}`}
              />
            </button>

            {akOpen && (
              <div className="mt-1 ml-3 flex flex-col gap-1">
                {akVisibleChildren.map((m) => (
                  <Link
                    key={m.path}
                    href={m.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                      isActive(m.path)
                        ? "bg-blue-600 text-white shadow"
                        : "hover:bg-blue-700 text-blue-100"
                    }`}
                  >
                    {m.icon}
                    <span>{m.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profil */}
        {can(["ADMIN", "PETUGAS", "TEKNISI", "PIMPINAN"]) && (
          <Link
            href="/profil"
            className={`mt-2 flex items-center gap-3 px-4 py-2 rounded-lg transition font-medium ${
              isActive("/profil")
                ? "bg-blue-600 text-white shadow"
                : "hover:bg-blue-700 text-blue-100"
            }`}
          >
            <User size={18} />
            <span>Profil</span>
          </Link>
        )}
      </nav>

      {/* Logout */}
      <div className="mt-auto pt-6 border-t border-blue-600">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition"
          disabled={!user}
          title={user ? "Logout" : "Memuat pengguna…"}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
