import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getConfiguredExpertUsernames } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const experts = getConfiguredExpertUsernames();
  return NextResponse.json({ experts });
}
