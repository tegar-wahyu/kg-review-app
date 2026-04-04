import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { updateCoursePublished } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { published?: boolean };
  if (typeof body?.published !== "boolean") {
    return NextResponse.json({ error: "published must be boolean" }, { status: 400 });
  }

  const { courseId } = await context.params;
  const updated = await updateCoursePublished(courseId, body.published);

  if (!updated) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json({ course: updated });
}
