"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseRecord } from "@/lib/types";

type SessionPayload = { user: { username: string; role: "admin" | "expert" } };

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [experts, setExperts] = useState<string[]>([]);
  const [selectedExpertByCourse, setSelectedExpertByCourse] = useState<Record<string, string>>({});
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

    const [coursesRes, expertsRes] = await Promise.all([
      fetch("/api/admin/courses", { cache: "no-store" }),
      fetch("/api/admin/experts", { cache: "no-store" }),
    ]);

    if (!coursesRes.ok) {
      setError("Gagal memuat mata pelajaran.");
      setLoading(false);
      return;
    }

    const data = (await coursesRes.json()) as { courses: CourseRecord[] };
    setCourses(data.courses);

    if (expertsRes.ok) {
      const expertData = (await expertsRes.json()) as { experts: string[] };
      const nextExperts = expertData.experts || [];
      setExperts(nextExperts);
      setSelectedExpertByCourse((prev) => {
        const next = { ...prev };
        for (const course of data.courses) {
          if (!next[course.id] && nextExperts[0]) {
            next[course.id] = nextExperts[0];
          }
        }
        return next;
      });
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Mengunggah...");
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
        throw new Error("Unggah gagal");
      }

      setStatus("Unggah selesai.");
      await load();
    } catch {
      setError("JSON tidak valid atau unggahan gagal.");
      setStatus("");
    } finally {
      event.target.value = "";
    }
  };

  const togglePublish = async (course: CourseRecord) => {
    setStatus("Menyimpan visibilitas...");

    const res = await fetch(`/api/admin/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !course.published }),
    });

    if (!res.ok) {
      setError("Gagal memperbarui visibilitas mata pelajaran.");
      setStatus("");
      return;
    }

    setStatus("Visibilitas berhasil diperbarui.");
    await load();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const openExpertResponse = (courseId: string) => {
    const selected = selectedExpertByCourse[courseId] || experts[0];
    if (!selected) {
      setError("Belum ada akun expert yang tersedia.");
      return;
    }

    router.push(`/admin/review/${courseId}/${encodeURIComponent(selected)}`);
  };

  if (loading) {
    return <main className="page-wrap">Memuat...</main>;
  }

  return (
    <main className="page-wrap">
      <div className="top-row">
        <h1>Panel admin</h1>
        <button className="btn-outline" onClick={logout}>Keluar</button>
      </div>

      <p className="muted">Unggah JSON mata pelajaran dan atur mata pelajaran mana yang bisa direview oleh expert.</p>

      <label className="file-upload">
        Unggah JSON mata pelajaran
        <input type="file" accept=".json" onChange={onFile} />
      </label>

      {status ? <p className="status-ok">{status}</p> : null}
      {error ? <p className="status-error">{error}</p> : null}

      <div className="course-list">
        {courses.map((course) => (
          <div className="course-card" key={course.id}>
            <div>
              <h3>{course.title}</h3>
              <p className="muted small">Diunggah: {new Date(course.uploadedAt).toLocaleString("id-ID")}</p>
            </div>
            <div className="row-actions">
              <button className="btn-outline" onClick={() => router.push(`/review/${course.id}`)}>
                Buka
              </button>
              <button className="btn-primary" onClick={() => togglePublish(course)}>
                {course.published ? "Batalkan publikasi" : "Publikasikan"}
              </button>
              <div className="expert-view-controls">
                <select
                  className="expert-select"
                  value={selectedExpertByCourse[course.id] || experts[0] || ""}
                  onChange={(event) =>
                    setSelectedExpertByCourse((prev) => ({
                      ...prev,
                      [course.id]: event.target.value,
                    }))
                  }
                  disabled={experts.length === 0}
                >
                  {experts.length === 0 ? <option value="">Tidak ada expert</option> : null}
                  {experts.map((username) => (
                    <option key={username} value={username}>{username}</option>
                  ))}
                </select>
                <button className="btn-outline" onClick={() => openExpertResponse(course.id)}>
                  Lihat respons expert
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
