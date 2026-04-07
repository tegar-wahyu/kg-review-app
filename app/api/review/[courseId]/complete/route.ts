import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { extractTriples } from "@/lib/extract";
import { getCourseById, getProgress, saveProgress } from "@/lib/storage";
import { ReviewProgress } from "@/lib/types";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  if (user.role !== "expert") {
    return NextResponse.json({ error: "Hanya expert yang dapat menyelesaikan validasi" }, { status: 403 });
  }

  const { courseId } = await context.params;
  const course = await getCourseById(courseId);

  if (!course) {
    return NextResponse.json({ error: "Mata pelajaran tidak ditemukan" }, { status: 404 });
  }

  if (!course.published) {
    return NextResponse.json({ error: "Mata pelajaran belum dipublikasikan" }, { status: 403 });
  }

  const existing = await getProgress(user.username, courseId);
  const totalTriples = extractTriples(course.payload).length;
  const ratedCount = Object.keys(existing?.ratings || {}).length;
  const remaining = Math.max(0, totalTriples - ratedCount);

  if (remaining > 0) {
    return NextResponse.json(
      { error: `Review belum selesai. Masih ada ${remaining} triple yang belum tervalidasi.` },
      { status: 400 },
    );
  }

  const body = (await request.json()) as { generalFeedback?: string };
  const generalFeedback = (body.generalFeedback || "").trim().slice(0, 5000);

  const now = new Date().toISOString();
  const progress: ReviewProgress = {
    ratings: existing?.ratings || {},
    comments: existing?.comments || {},
    missingTriples: existing?.missingTriples || [],
    generalFeedback,
    completedAt: now,
    updatedAt: now,
  };

  await saveProgress(user.username, courseId, progress);

  return NextResponse.json({ ok: true, completedAt: now });
}
