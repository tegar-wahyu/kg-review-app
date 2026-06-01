import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCompletionSurveyItems } from "@/lib/completionSurvey";
import { getCompletionSurveyProgress, saveCompletionSurveyProgress } from "@/lib/storage";
import { CompletionSurveyProgress } from "@/lib/types";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  const items = await getCompletionSurveyItems();
  const progress = await getCompletionSurveyProgress(user.username);

  return NextResponse.json({ items, progress, role: user.role });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  if (user.role !== "expert") {
    return NextResponse.json({ error: "Hanya expert yang dapat mengisi validasi fase 2" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<CompletionSurveyProgress>;
  const existing = await getCompletionSurveyProgress(user.username);
  const progress: CompletionSurveyProgress = {
    answers: body.answers || {},
    completedAt: body.completedAt ?? existing?.completedAt,
    updatedAt: new Date().toISOString(),
  };

  await saveCompletionSurveyProgress(user.username, progress);
  return NextResponse.json({ ok: true, updatedAt: progress.updatedAt });
}
