// src/lib/auth.ts
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export type Role = "ADMIN" | "PETUGAS" | "PIMPINAN" | "TEKNISI";
export type AuthUser = { id: number; nama: string; role: Role };

async function readToken(req?: Request): Promise<string | null> {
  // 1) Authorization: Bearer <token>
  const h = req?.headers.get("authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7);

  // 2) Cookie `token` (default login)
  try {
    const jar = await cookies();                // ⬅️ wajib await
    const c = jar.get("token")?.value;
    if (c) return c;
  } catch {}
  return null;
}

export async function getAuthOptional(req?: Request): Promise<AuthUser | null> {
  const token = await readToken(req);
  if (!token) {
    // (opsional, DEV) fallback ke cookie `user` bila ada
    try {
      const jar = await cookies();              // ⬅️ wajib await
      const raw = jar.get("user")?.value;
      if (raw) {
        const u = JSON.parse(decodeURIComponent(raw));
        const role = String(u.role ?? "").toUpperCase() as Role;
        if (role) return { id: Number(u.id ?? 0), nama: String(u.nama ?? ""), role };
      }
    } catch {}
    return null;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret") as any;
    const role = String(payload.role ?? payload.user?.role ?? "")
      .toUpperCase() as Role;
    const id = Number(payload.id ?? payload.userId ?? 0);
    const nama = String(payload.nama ?? payload.user?.nama ?? "");
    if (!role) return null;
    return { id, nama, role };
  } catch {
    return null;
  }
}

export async function assertRole(req: Request, allowed: Role[]): Promise<AuthUser> {
  const me = await getAuthOptional(req);        // ⬅️ wajib await
  if (!me) throw new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  if (!allowed.includes(me.role))
    throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
  return me;
}
