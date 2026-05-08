"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseRecord } from "@/lib/types";

type SessionPayload = { user: { username: string; role: "admin" | "expert" } };

type CourseSummary = {
  courseId: string;
  courseTitle: string;
  published: boolean;
  totalTriples: number;
  ratedCount: number;
  completed: boolean;
};

type ExpertSummary = {
  username: string;
  subject: string;
  courses: CourseSummary[];
};

type UnassignedCourse = {
  courseId: string;
  courseTitle: string;
  published: boolean;
};

type SummaryData = {
  experts: ExpertSummary[];
  unassignedCourses: UnassignedCourse[];
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [experts, setExperts] = useState<string[]>([]);
  const [selectedExpertByCourse, setSelectedExpertByCourse] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<SummaryData | null>(null);

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

    const [coursesRes, expertsRes, summaryRes] = await Promise.all([
      fetch("/api/admin/courses", { cache: "no-store" }),
      fetch("/api/admin/experts", { cache: "no-store" }),
      fetch("/api/admin/summary", { cache: "no-store" }),
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
          if (course.assignedExpert) {
            next[course.id] = course.assignedExpert;
          } else if (!next[course.id] && nextExperts[0]) {
            next[course.id] = nextExperts[0];
          }
        }
        return next;
      });
    }

    if (summaryRes.ok) {
      setSummary((await summaryRes.json()) as SummaryData);
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
    const nextPublished = !course.published;
    const assignedExpert = selectedExpertByCourse[course.id]?.trim() || "";
    if (nextPublished && !assignedExpert) {
      setError("Pilih akun expert sebelum mempublikasikan mata pelajaran.");
      setStatus("");
      return;
    }

    setStatus("Menyimpan visibilitas...");
    setError("");

    const res = await fetch(`/api/admin/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        published: nextPublished,
        assignedExpert: nextPublished
          ? assignedExpert
          : (course.assignedExpert || assignedExpert || null),
      }),
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
    const course = courses.find((item) => item.id === courseId);
    const selected = course?.assignedExpert || selectedExpertByCourse[courseId] || experts[0];
    if (!selected) {
      setError("Belum ada akun expert yang tersedia.");
      return;
    }

    router.push(`/admin/review/${courseId}/${encodeURIComponent(selected)}`);
  };

  const subjectBadgeClass = (subject: string) => {
    const lower = subject.toLowerCase();
    if (lower === "kimia") return "kimia";
    if (lower === "fisika") return "fisika";
    if (lower === "biologi") return "biologi";
    return "";
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

      {summary && (
        <div className="summary-section">
          <h2>Ringkasan Akun Expert</h2>
          {summary.experts.length === 0 ? (
            <p className="summary-empty">Belum ada akun expert yang dikonfigurasi.</p>
          ) : (
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Expert</th>
                  <th>Mata Pelajaran</th>
                  <th>Kursus Ditugaskan</th>
                </tr>
              </thead>
              <tbody>
                {summary.experts.map((expert) => (
                  <tr key={expert.username}>
                    <td style={{ fontWeight: 500 }}>{expert.username}</td>
                    <td>
                      <span className={`summary-subject-badge ${subjectBadgeClass(expert.subject)}`}>
                        {expert.subject}
                      </span>
                    </td>
                    <td>
                      {expert.courses.length === 0 ? (
                        <span className="summary-empty">Belum ditugaskan</span>
                      ) : (
                        expert.courses.map((c) => {
                          const pct = c.totalTriples > 0
                            ? Math.round((c.ratedCount / c.totalTriples) * 100)
                            : 0;
                          const barClass = c.completed
                            ? ""
                            : c.ratedCount > 0
                              ? "incomplete"
                              : "not-started";
                          const statusLabel = c.completed
                            ? "Selesai"
                            : c.ratedCount > 0
                              ? `${c.ratedCount}/${c.totalTriples}`
                              : "Belum mulai";
                          const statusClass = c.completed
                            ? "completed"
                            : c.ratedCount > 0
                              ? "in-progress"
                              : "not-started";

                          return (
                            <div className="summary-course-row" key={c.courseId}>
                              <span className="summary-course-title">{c.courseTitle}</span>
                              <div className="summary-progress-bar">
                                <div
                                  className={`summary-progress-fill ${barClass}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`summary-status ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {summary.unassignedCourses.length > 0 && (
            <div className="summary-unassigned">
              <strong>Tanpa expert:</strong>
              <ul>
                {summary.unassignedCourses.map((c) => (
                  <li key={c.courseId}>
                    {c.courseTitle}
                    {!c.published && <span className="summary-unassigned-tag">Belum dipublikasi</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
                  disabled={experts.length === 0 || course.published}
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
