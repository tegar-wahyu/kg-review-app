import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { SessionUser, UserRole } from "@/lib/types";

export const SESSION_COOKIE = "kg_session";

const USERS = [
  {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin123",
    role: "admin" as const,
  },
  {
    username: process.env.EXPERT_USERNAME || "expert",
    password: process.env.EXPERT_PASSWORD || "expert123",
    role: "expert" as const,
  },
];

function secretKey() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || "dev-secret-change-in-production",
  );
}

export function validateCredentials(username: string, password: string): SessionUser | null {
  const user = USERS.find((item) => item.username === username && item.password === password);
  if (!user) return null;

  return { username: user.username, role: user.role };
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const username = typeof payload.username === "string" ? payload.username : null;
    const role = payload.role === "admin" || payload.role === "expert" ? payload.role : null;

    if (!username || !role) return null;
    return { username, role };
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getUserFromCookieStore(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function isRole(user: SessionUser | null, role: UserRole) {
  return user?.role === role;
}
