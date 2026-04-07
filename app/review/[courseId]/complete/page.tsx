"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type CompleteResponse = {
  ok?: boolean;
  error?: string;
};

export default function ReviewCompletePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseId || submitting) return;

    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/review/${courseId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generalFeedback: feedback }),
    });

    const data = (await res.json()) as CompleteResponse;

    if (!res.ok || !data.ok) {
      setError(data.error || "Gagal mengirim konfirmasi.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <main className="page-wrap review-complete-page">
      <section className="review-complete-card">
        <p className="review-complete-kicker">Validasi selesai</p>
        <h1>Review Anda telah tercatat</h1>
        <p className="review-complete-text">
          Jika penilaian sudah final, kirim konfirmasi dan sertakan catatan bila ada hal yang perlu ditindaklanjuti tim kami.
        </p>

        <form className="review-feedback-form" onSubmit={submitFeedback}>
          <label htmlFor="general-feedback">Catatan untuk tim kami (opsional)</label>
          <textarea
            id="general-feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Contoh: ada relasi yang masih ambigu di bab 3, perlu perbaikan penamaan konsep, dll."
            disabled={submitting || submitted}
            rows={6}
          />

          {error ? <p className="finish-warning">{error}</p> : null}
          {submitted ? <p className="review-complete-success">Konfirmasi berhasil dikirim. Terima kasih atas kontribusinya.</p> : null}

          <div className="review-complete-actions">
            <button className="btn-outline" type="button" onClick={() => router.push("/review/available")}>Kembali ke daftar mata pelajaran</button>
            <button className="btn-primary" type="submit" disabled={submitting || submitted}>
              {submitting ? "Mengirim..." : submitted ? "Terkirim" : "Kirim konfirmasi"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
