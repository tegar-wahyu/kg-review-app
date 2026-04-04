import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { updateCoursePublished } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const body = (await request.json()) as { published?: boolean };
  if (typeof body?.published !== "boolean") {
    return NextResponse.json({ error: "published harus bernilai boolean" }, { status: 400 });
  }

  const { courseId } = await context.params;
  const updated = await updateCoursePublished(courseId, body.published);

  if (!updated) {
    return NextResponse.json({ error: "Mata pelajaran tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ course: updated });
}
