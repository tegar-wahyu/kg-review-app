import { CourseRecord, ReviewProgress } from "@/lib/types";

const COURSES_KEY = "kg:courses";
const memoryCourses = new Map<string, CourseRecord>();
const memoryProgress = new Map<string, ReviewProgress>();

function kvEnabled() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCommand(args: string[]) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("KV env vars are missing");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`KV command failed: ${response.status}`);
  }

  const data = (await response.json()) as { result?: string };
  return data.result;
}

async function readCoursesFromKV(): Promise<CourseRecord[]> {
  const raw = await kvCommand(["GET", COURSES_KEY]);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CourseRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeCoursesToKV(courses: CourseRecord[]) {
  await kvCommand(["SET", COURSES_KEY, JSON.stringify(courses)]);
}

function memoryKey(username: string, courseId: string) {
  return `${username}:${courseId}`;
}

export async function getCourses(): Promise<CourseRecord[]> {
  if (kvEnabled()) {
    return readCoursesFromKV();
  }

  return Array.from(memoryCourses.values()).sort((a, b) =>
    b.uploadedAt.localeCompare(a.uploadedAt),
  );
}

export async function getCourseById(courseId: string): Promise<CourseRecord | null> {
  const courses = await getCourses();
  return courses.find((course) => course.id === courseId) || null;
}

export async function upsertCourse(course: CourseRecord): Promise<void> {
  if (kvEnabled()) {
    const courses = await readCoursesFromKV();
    const next = [course, ...courses.filter((item) => item.id !== course.id)];
    await writeCoursesToKV(next);
    return;
  }

  memoryCourses.set(course.id, course);
}

export async function updateCoursePublished(courseId: string, published: boolean): Promise<CourseRecord | null> {
  if (kvEnabled()) {
    const courses = await readCoursesFromKV();
    let updated: CourseRecord | null = null;

    const next = courses.map((course) => {
      if (course.id !== courseId) return course;
      updated = { ...course, published };
      return updated;
    });

    if (!updated) return null;
    await writeCoursesToKV(next);
    return updated;
  }

  const course = memoryCourses.get(courseId);
  if (!course) return null;

  const updated = { ...course, published };
  memoryCourses.set(courseId, updated);
  return updated;
}

export async function getProgress(username: string, courseId: string): Promise<ReviewProgress | null> {
  const key = `kg:progress:${username}:${courseId}`;

  if (kvEnabled()) {
    const raw = await kvCommand(["GET", key]);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as ReviewProgress;
    } catch {
      return null;
    }
  }

  return memoryProgress.get(memoryKey(username, courseId)) || null;
}

export async function saveProgress(username: string, courseId: string, progress: ReviewProgress): Promise<void> {
  const key = `kg:progress:${username}:${courseId}`;

  if (kvEnabled()) {
    await kvCommand(["SET", key, JSON.stringify(progress)]);
    return;
  }

  memoryProgress.set(memoryKey(username, courseId), progress);
}
