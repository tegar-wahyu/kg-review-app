import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { updateCourseAssignment, updateCoursePublished } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const body = (await request.json()) as { published?: boolean; assignedExpert?: string | null };
  const hasPublished = typeof body?.published === "boolean";
  const hasAssignedExpert = typeof body?.assignedExpert === "string" || body?.assignedExpert === null;

  if (!hasPublished && !hasAssignedExpert) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim" }, { status: 400 });
  }

  const { courseId } = await context.params;
  let updated = null;

  if (hasPublished) {
    updated = await updateCoursePublished(courseId, Boolean(body.published));
  }

  if (hasAssignedExpert) {
    updated = await updateCourseAssignment(courseId, body.assignedExpert ?? null);
  }

  if (!updated) {
    return NextResponse.json({ error: "Mata pelajaran tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ course: updated });
}
