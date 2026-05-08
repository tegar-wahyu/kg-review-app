import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getConfiguredExperts } from "@/lib/auth";
import { getCourses, getProgress } from "@/lib/storage";
import { extractTriples } from "@/lib/extract";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const experts = getConfiguredExperts();
  const courses = await getCourses();

  const expertsWithAssignments = await Promise.all(
    experts.map(async (expert) => {
      const assignedCourses = courses.filter(
        (c) => c.assignedExpert === expert.username,
      );

      const courseSummaries = await Promise.all(
        assignedCourses.map(async (course) => {
          const triples = extractTriples(course.payload);
          const total = triples.length;
          const progress = await getProgress(expert.username, course.id);

          const ratedCount = progress
            ? Object.keys(progress.ratings).length
            : 0;
          const completed = Boolean(progress?.completedAt);

          return {
            courseId: course.id,
            courseTitle: course.title,
            published: course.published,
            totalTriples: total,
            ratedCount,
            completed,
          };
        }),
      );

      return {
        username: expert.username,
        subject: expert.subject,
        courses: courseSummaries,
      };
    }),
  );

  const unassignedCourses = courses.filter(
    (c) => !c.assignedExpert || !experts.some((e) => e.username === c.assignedExpert),
  ).map((c) => ({
    courseId: c.id,
    courseTitle: c.title,
    published: c.published,
  }));

  return NextResponse.json({
    experts: expertsWithAssignments,
    unassignedCourses,
  });
}
