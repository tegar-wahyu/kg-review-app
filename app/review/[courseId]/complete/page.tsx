"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type CompleteResponse = {
  ok?: boolean;
  error?: string;
};

export default function ReviewCompletePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const confettiTimerRef = useRef<number | null>(null);

  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [showConfetti, setShowConfetti] = useState(true);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 32 }, (_, index) => ({
        id: index,
        left: `${(index * 7 + (index % 4) * 6) % 100}%`,
        delay: `${(index % 8) * 0.08}s`,
        duration: `${2 + (index % 5) * 0.18}s`,
        drift: `${-16 + (index % 9) * 4}px`,
        rotate: `${(index % 2 === 0 ? 1 : -1) * (180 + (index % 6) * 45)}deg`,
        hue: `${(index * 33) % 360}`,
      })),
    [],
  );

  useEffect(() => {
    confettiTimerRef.current = window.setTimeout(() => {
      setShowConfetti(false);
      confettiTimerRef.current = null;
    }, 2400);

    return () => {
      if (confettiTimerRef.current !== null) {
        window.clearTimeout(confettiTimerRef.current);
      }
    };
  }, []);

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
      {showConfetti ? (
        <div className="confetti-layer" aria-hidden="true">
          {confettiPieces.map((piece) => {
            const confettiStyle: CSSProperties & Record<string, string> = {
              left: piece.left,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              "--confetti-drift": piece.drift,
              "--confetti-rotate": piece.rotate,
              "--confetti-hue": piece.hue,
            };

            return <span key={piece.id} className="confetti-piece" style={confettiStyle} />;
          })}
        </div>
      ) : null}

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
