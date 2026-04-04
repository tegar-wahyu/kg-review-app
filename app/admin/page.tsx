"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseRecord } from "@/lib/types";

type SessionPayload = { user: { username: string; role: "admin" | "expert" } };

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const me = await fetch("/api/auth/me", { cache: "no-store" });
    if (!me.ok) {
      router.replace("/login");
      return;
    }

    const session = (await me.json()) as SessionPayload;
    if (session.user.role !== "admin") {
      router.replace("/review/available");
      return;
    }

    const res = await fetch("/api/admin/courses", { cache: "no-store" });
    if (!res.ok) {
      setError("Failed to load courses.");
      setLoading(false);
      return;
    }

    const data = (await res.json()) as { courses: CourseRecord[] };
    setCourses(data.courses);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Uploading...");
    setError("");

    try {
      const content = await file.text();
      const payload = JSON.parse(content);

      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, title: file.name.replace(".json", "") }),
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      setStatus("Upload complete.");
      await load();
    } catch {
      setError("Invalid JSON or upload failed.");
      setStatus("");
    } finally {
      event.target.value = "";
    }
  };

  const togglePublish = async (course: CourseRecord) => {
    setStatus("Saving visibility...");

    const res = await fetch(`/api/admin/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !course.published }),
    });

    if (!res.ok) {
      setError("Failed to update course visibility.");
      setStatus("");
      return;
    }

    setStatus("Visibility updated.");
    await load();
  };

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
        <h1>Admin panel</h1>
        <button className="btn-outline" onClick={logout}>Logout</button>
      </div>

      <p className="muted">Upload course JSON and set which course is reviewable by experts.</p>

      <label className="file-upload">
        Upload course JSON
        <input type="file" accept=".json" onChange={onFile} />
      </label>

      {status ? <p className="status-ok">{status}</p> : null}
      {error ? <p className="status-error">{error}</p> : null}

      <div className="course-list">
        {courses.map((course) => (
          <div className="course-card" key={course.id}>
            <div>
              <h3>{course.title}</h3>
              <p className="muted small">Uploaded: {new Date(course.uploadedAt).toLocaleString()}</p>
            </div>
            <div className="row-actions">
              <button className="btn-outline" onClick={() => router.push(`/review/${course.id}`)}>
                Open
              </button>
              <button className="btn-primary" onClick={() => togglePublish(course)}>
                {course.published ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
