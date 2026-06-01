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
    return <main className="page-wrap">Memuat...</main>;
  }

  return (
    <main className="page-wrap available-page">
      <header className="available-header">
        <div className="top-row">
          <div>
            <p className="onboarding-kicker">Reviewer Guru</p>
            <h1>Mata pelajaran tersedia</h1>
          </div>
          <button className="btn-outline" onClick={logout}>Keluar</button>
        </div>
        <p className="muted available-subtitle">
          Pilih validasi yang ingin dilanjutkan. Fase 1 memeriksa KG per mata pelajaran, sedangkan fase 2 memeriksa
          relasi completion lintas-buku.
        </p>
      </header>

      <section className="onboarding-box onboarding-box-compact" aria-label="Panduan onboarding reviewer">
        <div className="onboarding-summary">
          <div>
            <p className="phase-inline-label">Alur validasi</p>
            <h2>Validasi KG dan completion lintas-buku</h2>
            <p className="onboarding-brief">
              Terima kasih telah berpartisipasi sebagai reviewer. Bapak/Ibu diminta memeriksa apakah keterkaitan
              antarkonsep sudah tepat, relevan, dan sesuai dengan konteks pembelajaran.
            </p>
          </div>
        </div>

        <div className="onboarding-phases">
          <article className="onboarding-phase-card active">
            <p className="phase-status">Fase 1</p>
            <h3>Validasi per mapel</h3>
            <p>Pastikan node, arah relasi, dan makna hubungan sudah sesuai konteks kurikulum pada mapel yang dipilih.</p>
          </article>
          <article className="onboarding-phase-card active">
            <p className="phase-status">Fase 2</p>
            <h3>Completion lintas-buku</h3>
            <p>Nilai validitas, tipe, dan arah relasi antarmapel dari survei completion Fisika, Kimia, dan Biologi.</p>
          </article>
        </div>
      </section>

      <section className="course-section" aria-label="Validasi fase 2">
        <div className="course-section-head">
          <div>
            <h2>Fase 2 - Validasi completion lintas-buku</h2>
            <p className="muted small">117 relasi lintas-buku dari folder completion_survey.</p>
          </div>
        </div>

        <div className="course-card available-course-card">
          <div className="course-card-copy">
            <p className="course-card-label">Siap direview</p>
            <h3>Survei validasi relasi lintas-buku</h3>
            <p className="muted small">Periksa apakah relasi, tipe relasi, dan arah relasi completion sudah tepat.</p>
          </div>
          <button className="btn-primary" onClick={() => router.push("/review/phase-2")}>
            Mulai fase 2
          </button>
        </div>
      </section>

      <section className="course-section" aria-label="Daftar mata pelajaran">
        <div className="course-section-head">
          <div>
            <h2>Daftar mata pelajaran</h2>
            <p className="muted small">Aksi utama dimulai dari sini.</p>
          </div>
          <span className="course-count">{courses.length} tersedia</span>
        </div>

        <div className="course-list">
          {courses.map((course) => (
            <div className="course-card available-course-card" key={course.id}>
              <div className="course-card-copy">
                <p className="course-card-label">{course.published ? "Siap direview" : "Belum dipublikasikan"}</p>
                <h3>{course.title}</h3>
                <p className="muted small">Pilih untuk mulai meninjau keterkaitan konsep pada mata pelajaran ini.</p>
              </div>
              <button className="btn-primary" onClick={() => router.push(`/review/${course.id}`)}>
                Mulai review
              </button>
            </div>
          ))}
          {courses.length === 0 ? (
            <p className="muted">Belum ada mata pelajaran yang bisa direview. Minta admin untuk mempublikasikannya.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
