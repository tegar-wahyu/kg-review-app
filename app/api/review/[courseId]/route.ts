import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCourseById, getProgress, saveProgress } from "@/lib/storage";
import { ReviewProgress } from "@/lib/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  const { courseId } = await context.params;
  const course = await getCourseById(courseId);

  if (!course) {
    return NextResponse.json({ error: "Mata pelajaran tidak ditemukan" }, { status: 404 });
  }

  if (user.role !== "admin" && !course.published) {
    return NextResponse.json({ error: "Mata pelajaran belum dipublikasikan" }, { status: 403 });
  }

  const progress = await getProgress(user.username, courseId);
  return NextResponse.json({ course, progress });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  const { courseId } = await context.params;
  const course = await getCourseById(courseId);

  if (!course) {
    return NextResponse.json({ error: "Mata pelajaran tidak ditemukan" }, { status: 404 });
  }

  if (user.role !== "admin" && !course.published) {
    return NextResponse.json({ error: "Mata pelajaran belum dipublikasikan" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<ReviewProgress>;
  const progress: ReviewProgress = {
    ratings: body.ratings || {},
    comments: body.comments || {},
    missingTriples: body.missingTriples || [],
    updatedAt: new Date().toISOString(),
  };

  await saveProgress(user.username, courseId, progress);
  return NextResponse.json({ ok: true, updatedAt: progress.updatedAt });
}
