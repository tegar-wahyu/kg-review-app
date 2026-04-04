import { NextResponse } from "next/server";
import { getUserFromCookieStore } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromCookieStore();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user });
}
