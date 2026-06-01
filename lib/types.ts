export type UserRole = "admin" | "expert";

export type ReviewRating = "correct" | "partial" | "wrong" | "missing";

export type RelationNode = {
  type?: string;
  target?: string;
  description?: string;
};

export type ConceptNode = {
  name?: string;
  description?: string;
  glossary_validated?: boolean;
  relations?: RelationNode[];
};

export type SubtopicNode = {
  name?: string;
  concepts?: ConceptNode[];
};

export type ChapterNode = {
  chapter?: string;
  subtopics?: SubtopicNode[];
};

export type CoursePayload = {
  grade?: string;
  chapters?: ChapterNode[];
  chapter?: string;
  subtopics?: SubtopicNode[];
} | ChapterNode[];

export type CourseRecord = {
  id: string;
  title: string;
  grade: string;
  published: boolean;
  assignedExpert?: string | null;
  uploadedAt: string;
  payload: CoursePayload;
};

export type ExtractedTriple = {
  id: number;
  chapter: string;
  subtopic: string;
  subject: string;
  relation: string;
  target: string;
  description: string;
  glossary_validated: boolean;
};

export type MissingTriple = {
  chapter: string;
  subject: string;
  relation: string;
  target: string;
  description: string;
};

export type ReviewProgress = {
  ratings: Record<string, ReviewRating>;
  comments: Record<string, string>;
  missingTriples: MissingTriple[];
  generalFeedback?: string;
  completedAt?: string;
  updatedAt: string;
};

export type CompletionSurveyDirection = "Benar" | "Terbalik" | "NA";

export type CompletionSurveyAnswer = {
  relationValid?: "Ya" | "Tidak";
  relationTypeCorrect?: "Benar" | "Salah";
  correctedRelationType?: string;
  directionCorrect?: CompletionSurveyDirection;
  comment?: string;
};

export type CompletionSurveyProgress = {
  answers: Record<string, CompletionSurveyAnswer>;
  completedAt?: string;
  updatedAt: string;
};

export type CompletionSurveyItem = {
  id: string;
  pair: string;
  conceptA: string;
  subjectA: string;
  proposedRelation: string;
  conceptB: string;
  subjectB: string;
  explanation: string;
};

export type SessionUser = {
  username: string;
  role: UserRole;
};
