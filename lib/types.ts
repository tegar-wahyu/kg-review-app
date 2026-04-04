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
  updatedAt: string;
};

export type SessionUser = {
  username: string;
  role: UserRole;
};
