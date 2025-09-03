"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Cookies from "js-cookie";
import {
  Home,
  Boxes,
  Package,
  ClipboardList,
  Calculator,
  BarChart3,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
} from "lucide-react";

/** ====== Types ====== */
type Role = "ADMIN" | "PETUGAS" | "TEKNISI" | "PIMPINAN";

type NavItem = {
  name: string;
  path: string;
  icon: ReactNode;
  roles: Role[];
};

type NavGroup = {
  key: string;
  title: string;
  icon: ReactNode;
  items: NavItem[];
};

/** ====== Helpers ====== */
const cx = (...cls: Array<string | false | null | undefined>) =>
  cls.filter(Boolean).join(" ");

const canSee = (role: Role, item: { roles: Role[] }) => item.roles.includes(role);

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ nama: string; role: Role } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const s = localStorage.getItem("user");
      if (s) setUser(JSON.parse(s));
    } catch {}
  }, []);

  // Fallback supaya sidebar tampil walau belum login
  const effectiveRole: Role = (user?.role as Role) ?? "ADMIN";
  const displayName = user?.nama ?? "Tamu";

  /** ====== Single item (Dashboard saja) ====== */
  const topNav: NavItem[] = useMemo(
    () => [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: <Home size={16} />,
        roles: ["ADMIN", "PETUGAS", "TEKNISI", "PIMPINAN"],
      },
    ],
    []
  );

  /** ====== Dropdown groups ====== */
  const groups: NavGroup[] = useMemo(
    () => [
      {
        key: "aset",
        title: "Manajemen Aset",
        icon: <Package size={18} />,
        items: [
          // GUDANG digabung: 1 menu, nanti tab di dalam halaman /gudang
          { name: "Gudang", path: "/gudang", icon: <Boxes size={16} />, roles: ["ADMIN", "PETUGAS"] },
          { name: "Aset", path: "/aset", icon: <Package size={16} />, roles: ["ADMIN", "PETUGAS"] },
          { name: "Pemeliharaan", path: "/pemeliharaan", icon: <ClipboardList size={16} />, roles: ["ADMIN", "TEKNISI"] },
          { name: "Penyusutan", path: "/penyusutan", icon: <Calculator size={16} />, roles: ["ADMIN", "PIMPINAN"] },
          // LAPORAN dipindah ke dalam Manajemen Aset
          { name: "Laporan", path: "/laporan", icon: <BarChart3 size={16} />, roles: ["ADMIN", "PIMPINAN"] },
        ],
      },
      {
        key: "akun",
        title: "Akun",
        icon: <User size={18} />,
        items: [
          { name: "Profil", path: "/profil", icon: <User size={16} />, roles: ["ADMIN", "PETUGAS", "TEKNISI", "PIMPINAN"] },
        ],
      },
    ],
    []
  );

  // Auto-expand group yang punya route aktif
  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        next[g.key] = prev[g.key] ?? g.items.some((it) => pathname.startsWith(it.path));
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = () => {
    Cookies.remove("token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <aside className="w-72 bg-slate-900 text-slate-100 min-h-screen flex flex-col shadow-xl">
      {/* Brand / User */}
      <div className="px-5 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 grid place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-sm">🔧</div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">PDAM • Aset</h1>
            <p className="text-xs text-slate-400">{displayName} · {effectiveRole}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {/* Single items (Dashboard) */}
        <div className="space-y-1">
          {topNav
            .filter((it) => canSee(effectiveRole, it))
            .map((it) => {
              const active = pathname === it.path;
              return (
                <Link
                  key={it.path}
                  href={it.path}
                  className={cx(
                    "flex items-center gap-3 px-4 py-2 rounded-lg transition font-medium",
                    active ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <span className={cx("shrink-0", active ? "text-white" : "text-slate-400")}>{it.icon}</span>
                  <span>{it.name}</span>
                </Link>
              );
            })}
        </div>

        {/* Groups */}
        {groups.map((group) => {
          const visible = group.items.filter((it) => canSee(effectiveRole, it));
          if (!visible.length) return null;
          const isOpen = !!open[group.key];

          return (
            <div key={group.key} className="rounded-lg bg-slate-900/40">
              <button
                onClick={() => setOpen((o) => ({ ...o, [group.key]: !o[group.key] }))}
                className={cx(
                  "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition",
                  "hover:bg-slate-800/60 border border-transparent hover:border-slate-800"
                )}
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-3">
                  <span className="text-slate-300">{group.icon}</span>
                  <span className="font-medium">{group.title}</span>
                </span>
                {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              </button>

              {isOpen && (
                <ul className="mt-1 pb-2">
                  {visible.map((it) => {
                    const active = pathname.startsWith(it.path);
                    return (
                      <li key={it.path}>
                        <Link
                          href={it.path}
                          className={cx(
                            "flex items-center gap-3 px-4 py-2 rounded-md mx-2 mt-1 text-sm transition",
                            active ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          <span className={cx("shrink-0", active ? "text-white" : "text-slate-400")}>{it.icon}</span>
                          <span className="truncate">{it.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-700 transition font-medium"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
