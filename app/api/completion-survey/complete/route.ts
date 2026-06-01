import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCompletionSurveyItems } from "@/lib/completionSurvey";
import { getCompletionSurveyProgress, saveCompletionSurveyProgress } from "@/lib/storage";
import { CompletionSurveyAnswer, CompletionSurveyProgress } from "@/lib/types";

function isCompleteAnswer(answer: CompletionSurveyAnswer | undefined) {
  if (!answer?.relationValid || !answer.relationTypeCorrect || !answer.directionCorrect) {
    return false;
  }

  if (answer.relationTypeCorrect === "Salah" && !answer.correctedRelationType?.trim()) {
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  if (user.role !== "expert") {
    return NextResponse.json({ error: "Hanya expert yang dapat menyelesaikan validasi fase 2" }, { status: 403 });
  }

  const existing = await getCompletionSurveyProgress(user.username);
  const items = await getCompletionSurveyItems();
  const answers = existing?.answers || {};
  const remaining = items.filter((item) => !isCompleteAnswer(answers[item.id])).length;

  if (remaining > 0) {
    return NextResponse.json(
      { error: `Validasi fase 2 belum selesai. Masih ada ${remaining} relasi yang belum lengkap.` },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const progress: CompletionSurveyProgress = {
    answers,
    completedAt: now,
    updatedAt: now,
  };

  await saveCompletionSurveyProgress(user.username, progress);
  return NextResponse.json({ ok: true, completedAt: now });
}
