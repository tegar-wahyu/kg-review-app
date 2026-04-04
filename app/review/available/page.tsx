"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseRecord } from "@/lib/types";

export default function AvailableCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (!me.ok) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/courses", { cache: "no-store" });
      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { courses: CourseRecord[]; role: "admin" | "expert" };
      setCourses(data.courses);
      setLoading(false);
    };

    run();
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (loading) {
    return <main className="page-wrap">Loading...</main>;
  }

  return (
    <main className="page-wrap">
      <div className="top-row">
        <h1>Available courses</h1>
        <button className="btn-outline" onClick={logout}>Logout</button>
      </div>
      <p className="muted">Select a published course to continue your review.</p>

      <div className="course-list">
        {courses.map((course) => (
          <div className="course-card" key={course.id}>
            <div>
              <h3>{course.title}</h3>
              <p className="muted small">{course.published ? "Published" : "Draft"}</p>
            </div>
            <button className="btn-primary" onClick={() => router.push(`/review/${course.id}`)}>
              Start review
            </button>
          </div>
        ))}
        {courses.length === 0 ? <p className="muted">No reviewable course yet. Ask admin to publish one.</p> : null}
      </div>
    </main>
  );
}
