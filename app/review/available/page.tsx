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
    <main className="page-wrap">
      <div className="top-row">
        <h1>Mata pelajaran tersedia</h1>
        <button className="btn-outline" onClick={logout}>Keluar</button>
      </div>
      <p className="muted">Pilih mata pelajaran yang sudah dipublikasikan untuk melanjutkan review.</p>

      <section className="onboarding-box" aria-label="Panduan onboarding reviewer">
        <p className="onboarding-kicker">ONBOARDING REVIEWER GURU</p>
        <h2>LLM-Assisted Knowledge Graph Completion untuk Pemetaan Interkoneksi Materi Sains (Fisika, Kimia, Biologi) pada Kurikulum Merdeka Tingkat SMA</h2>
        <p>
          Terima kasih telah berpartisipasi sebagai reviewer. Peran Anda adalah memvalidasi keterkaitan konsep agar
          representasi pengetahuan antarmateri sains menjadi akurat, relevan, dan dapat dipertanggungjawabkan secara pedagogis.
        </p>
        <p className="phase-active-note">
          Fase aktif saat ini: <strong>Fase 1 - Validasi KG per Mata Pelajaran</strong>
        </p>
        <div className="onboarding-phases">
          <article className="onboarding-phase-card active">
            <p className="phase-status">Sedang Berjalan</p>
            <h3>Fase 1: Validasi KG per Mata Pelajaran</h3>
            <p>
              Tinjau relasi konsep di dalam satu mata pelajaran secara mandiri (Fisika/Kimia/Biologi). Pastikan node,
              arah relasi, dan makna hubungan sesuai konteks kurikulum.
            </p>
          </article>
          <article className="onboarding-phase-card inactive">
            <p className="phase-status">Tahap Berikutnya</p>
            <h3>Fase 2: KG Terinterkoneksi Antarmata Pelajaran</h3>
            <p>
              Setelah validasi per mata pelajaran selesai, lakukan penilaian interkoneksi lintas mapel untuk melihat
              kesinambungan konsep dan peluang integrasi pembelajaran sains secara utuh.
            </p>
          </article>
        </div>
      </section>

      <div className="course-list">
        {courses.map((course) => (
          <div className="course-card" key={course.id}>
            <div>
              <h3>{course.title}</h3>
              <p className="muted small">{course.published ? "Dipublikasikan" : "Draf"}</p>
            </div>
            <button className="btn-primary" onClick={() => router.push(`/review/${course.id}`)}>
              Mulai review
            </button>
          </div>
        ))}
        {courses.length === 0 ? <p className="muted">Belum ada mata pelajaran yang bisa direview. Minta admin untuk mempublikasikannya.</p> : null}
      </div>
    </main>
  );
}
