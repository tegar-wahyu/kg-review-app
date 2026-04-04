import { ChapterNode, CoursePayload, ExtractedTriple } from "@/lib/types";

function normalizeChapters(payload: CoursePayload): ChapterNode[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.chapters)) {
    return payload.chapters;
  }

  return [payload as ChapterNode];
}

export function extractTriples(payload: CoursePayload): ExtractedTriple[] {
  const result: ExtractedTriple[] = [];
  const chapters = normalizeChapters(payload);

  chapters.forEach((chapter) => {
    (chapter?.subtopics || []).forEach((subtopic) => {
      (subtopic?.concepts || []).forEach((concept) => {
        (concept?.relations || []).forEach((relation) => {
          result.push({
            id: result.length,
            chapter: chapter?.chapter || "Uncategorized",
            subtopic: subtopic?.name || "",
            subject: concept?.name || "",
            relation: relation?.type || "",
            target: relation?.target || "",
            description: relation?.description || "",
            glossary_validated: Boolean(concept?.glossary_validated),
          });
        });
      });
    });
  });

  return result;
}
