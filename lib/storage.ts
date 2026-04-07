import { CourseRecord, ReviewProgress } from "@/lib/types";

const COURSES_KEY = "kg:courses";

type MemoryStore = {
  courses: Map<string, CourseRecord>;
  progress: Map<string, ReviewProgress>;
};

declare global {
  var __kgReviewMemoryStore: MemoryStore | undefined;
  var __kgReviewStorageModeLogged: boolean | undefined;
}

function getMemoryStore(): MemoryStore {
  if (!globalThis.__kgReviewMemoryStore) {
    globalThis.__kgReviewMemoryStore = {
      courses: new Map<string, CourseRecord>(),
      progress: new Map<string, ReviewProgress>(),
    };
  }

  return globalThis.__kgReviewMemoryStore;
}

function resolveKVConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const enabled = Boolean(url && token);

  if (!globalThis.__kgReviewStorageModeLogged) {
    console.info(`[storage] mode=${enabled ? "kv" : "memory"}`);
    globalThis.__kgReviewStorageModeLogged = true;
  }

  return { enabled, url, token };
}

function kvEnabled() {
  return resolveKVConfig().enabled;
}

async function kvCommand(args: string[]) {
  const { url, token } = resolveKVConfig();

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

  const store = getMemoryStore();
  return Array.from(store.courses.values()).sort((a, b) =>
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

  const store = getMemoryStore();
  store.courses.set(course.id, course);
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

  const store = getMemoryStore();
  const course = store.courses.get(courseId);
  if (!course) return null;

  const updated = { ...course, published };
  store.courses.set(courseId, updated);
  return updated;
}

export async function updateCourseAssignment(
  courseId: string,
  assignedExpert: string | null,
): Promise<CourseRecord | null> {
  if (kvEnabled()) {
    const courses = await readCoursesFromKV();
    let updated: CourseRecord | null = null;

    const next = courses.map((course) => {
      if (course.id !== courseId) return course;
      updated = { ...course, assignedExpert };
      return updated;
    });

    if (!updated) return null;
    await writeCoursesToKV(next);
    return updated;
  }

  const store = getMemoryStore();
  const course = store.courses.get(courseId);
  if (!course) return null;

  const updated = { ...course, assignedExpert };
  store.courses.set(courseId, updated);
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

  const store = getMemoryStore();
  return store.progress.get(memoryKey(username, courseId)) || null;
}

export async function saveProgress(username: string, courseId: string, progress: ReviewProgress): Promise<void> {
  const key = `kg:progress:${username}:${courseId}`;

  if (kvEnabled()) {
    await kvCommand(["SET", key, JSON.stringify(progress)]);
    return;
  }

  const store = getMemoryStore();
  store.progress.set(memoryKey(username, courseId), progress);
}
