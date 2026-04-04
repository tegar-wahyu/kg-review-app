import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCourses } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  const courses = await getCourses();
  const visible = user.role === "admin" ? courses : courses.filter((course) => course.published);

  return NextResponse.json({ courses: visible, role: user.role });
}
