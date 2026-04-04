import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { CoursePayload, CourseRecord } from "@/lib/types";
import { getCourses, upsertCourse } from "@/lib/storage";

function makeId(source: string) {
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") + "-" + Date.now();
}

function normalizeTitle(payload: CoursePayload, title?: string) {
  if (title?.trim()) return title.trim();

  if (!Array.isArray(payload) && typeof payload?.grade === "string" && payload.grade.trim()) {
    return payload.grade.trim();
  }

  return "Untitled Course";
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const courses = await getCourses();
  return NextResponse.json({ courses });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { title?: string; payload?: CoursePayload };
  if (!body?.payload) {
    return NextResponse.json({ error: "payload is required" }, { status: 400 });
  }

  const title = normalizeTitle(body.payload, body.title);

  const course: CourseRecord = {
    id: makeId(title),
    title,
    grade: title,
    payload: body.payload,
    published: false,
    uploadedAt: new Date().toISOString(),
  };

  await upsertCourse(course);
  return NextResponse.json({ course }, { status: 201 });
}
