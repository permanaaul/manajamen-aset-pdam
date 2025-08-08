import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  // Jika belum login
  if (!token) {
    if (
      req.nextUrl.pathname !== "/login" &&
      req.nextUrl.pathname !== "/register"
    ) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded: any = jwt.verify(token, secret);

    const role = decoded.role;
    const path = req.nextUrl.pathname;

    // Aturan akses berdasarkan role
    if (role === "ADMIN") {
      return NextResponse.next();
    }

    if (role === "PETUGAS") {
      if (!path.startsWith("/inventarisasi") && !path.startsWith("/profil")) {
        return NextResponse.redirect(new URL("/forbidden", req.url));
      }
    }

    if (role === "TEKNISI") {
      if (!path.startsWith("/pemeliharaan") && !path.startsWith("/profil")) {
        return NextResponse.redirect(new URL("/forbidden", req.url));
      }
    }

    if (role === "PIMPINAN") {
      if (
        !path.startsWith("/laporan") &&
        !path.startsWith("/dashboard") &&
        !path.startsWith("/profil")
      ) {
        return NextResponse.redirect(new URL("/forbidden", req.url));
      }
    }

    return NextResponse.next();
  } catch (err) {
    console.error("JWT Error:", err);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

// Proteksi halaman berikut
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventarisasi/:path*",
    "/pemeliharaan/:path*",
    "/laporan/:path*",
    "/profil/:path*",
  ],
};
