"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login" || pathname === "/register";

  return (
    <div className="flex min-h-screen bg-gray-100">
      {!hideSidebar && <Sidebar />}
      <main className={`flex-1 p-6 ${hideSidebar ? "w-full" : ""}`}>
        {children}
      </main>
    </div>
  );
}
