import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { SessionUser, UserRole } from "@/lib/types";

export const SESSION_COOKIE = "kg_session";

type AuthUser = {
  username: string;
  password: string;
  role: UserRole;
};

const EXPERT_ENV_KEYS = [
  { usernameEnv: "EXPERT_KIMIA_1_USERNAME", passwordEnv: "EXPERT_KIMIA_1_PASSWORD" },
  { usernameEnv: "EXPERT_KIMIA_2_USERNAME", passwordEnv: "EXPERT_KIMIA_2_PASSWORD" },
  { usernameEnv: "EXPERT_KIMIA_3_USERNAME", passwordEnv: "EXPERT_KIMIA_3_PASSWORD" },
  { usernameEnv: "EXPERT_KIMIA_4_USERNAME", passwordEnv: "EXPERT_KIMIA_4_PASSWORD" },
  { usernameEnv: "EXPERT_KIMIA_5_USERNAME", passwordEnv: "EXPERT_KIMIA_5_PASSWORD" },
  { usernameEnv: "EXPERT_KIMIA_6_USERNAME", passwordEnv: "EXPERT_KIMIA_6_PASSWORD" },
  { usernameEnv: "EXPERT_FISIKA_1_USERNAME", passwordEnv: "EXPERT_FISIKA_1_PASSWORD" },
  { usernameEnv: "EXPERT_FISIKA_2_USERNAME", passwordEnv: "EXPERT_FISIKA_2_PASSWORD" },
  { usernameEnv: "EXPERT_FISIKA_3_USERNAME", passwordEnv: "EXPERT_FISIKA_3_PASSWORD" },
  { usernameEnv: "EXPERT_FISIKA_4_USERNAME", passwordEnv: "EXPERT_FISIKA_4_PASSWORD" },
  { usernameEnv: "EXPERT_FISIKA_5_USERNAME", passwordEnv: "EXPERT_FISIKA_5_PASSWORD" },
  { usernameEnv: "EXPERT_FISIKA_6_USERNAME", passwordEnv: "EXPERT_FISIKA_6_PASSWORD" },
  { usernameEnv: "EXPERT_BIOLOGI_1_USERNAME", passwordEnv: "EXPERT_BIOLOGI_1_PASSWORD" },
  { usernameEnv: "EXPERT_BIOLOGI_2_USERNAME", passwordEnv: "EXPERT_BIOLOGI_2_PASSWORD" },
  { usernameEnv: "EXPERT_BIOLOGI_3_USERNAME", passwordEnv: "EXPERT_BIOLOGI_3_PASSWORD" },
  { usernameEnv: "EXPERT_BIOLOGI_4_USERNAME", passwordEnv: "EXPERT_BIOLOGI_4_PASSWORD" },
  { usernameEnv: "EXPERT_BIOLOGI_5_USERNAME", passwordEnv: "EXPERT_BIOLOGI_5_PASSWORD" },
  { usernameEnv: "EXPERT_BIOLOGI_6_USERNAME", passwordEnv: "EXPERT_BIOLOGI_6_PASSWORD" },
] as const;

function getExpertUsers(): AuthUser[] {
  return EXPERT_ENV_KEYS.flatMap(({ usernameEnv, passwordEnv }) => {
    const username = process.env[usernameEnv]?.trim();
    const password = process.env[passwordEnv];

    if (!username || !password) {
      return [];
    }

    return [{ username, password, role: "expert" as const }];
  });
}

function getDummyUser(): AuthUser[] {
  const username = process.env.DUMMY_EXPERT_USERNAME?.trim();
  const password = process.env.DUMMY_EXPERT_PASSWORD;

  if (!username || !password) {
    return [];
  }

  return [{ username, password, role: "expert" as const }];
}

function getUsers(): AuthUser[] {
  return [
    {
      username: process.env.ADMIN_USERNAME || "admin",
      password: process.env.ADMIN_PASSWORD || "admin123",
      role: "admin" as const,
    },
    ...getExpertUsers(),
    ...getDummyUser(),
  ];
}

export function getConfiguredExpertUsernames() {
  return getExpertUsers().map((user) => user.username);
}

export type ExpertInfo = { username: string; subject: string };

export function getConfiguredExperts(): ExpertInfo[] {
  return EXPERT_ENV_KEYS.map(({ usernameEnv }) => {
    const match = usernameEnv.match(/^EXPERT_(\w+?)_\d+_USERNAME$/);
    const subject = match ? match[1].charAt(0) + match[1].slice(1).toLowerCase() : "Unknown";
    const username = process.env[usernameEnv]?.trim();
    return username ? { username, subject } : null;
  }).filter((e): e is ExpertInfo => e !== null);
}

const USERS = getUsers();

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
