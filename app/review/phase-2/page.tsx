"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LatexText from "@/components/LatexText";
import {
  CompletionSurveyAnswer,
  CompletionSurveyDirection,
  CompletionSurveyItem,
} from "@/lib/types";

type SurveyPayload = {
  items: CompletionSurveyItem[];
  progress: {
    answers: Record<string, CompletionSurveyAnswer>;
    completedAt?: string;
  } | null;
};

const relationValidOptions: Array<NonNullable<CompletionSurveyAnswer["relationValid"]>> = ["Ya", "Tidak"];
const relationTypeOptions: Array<NonNullable<CompletionSurveyAnswer["relationTypeCorrect"]>> = ["Benar", "Salah"];
const directionOptions: CompletionSurveyDirection[] = ["Benar", "Terbalik", "NA"];

function isCompleteAnswer(answer: CompletionSurveyAnswer | undefined) {
  if (!answer?.relationValid || !answer.relationTypeCorrect || !answer.directionCorrect) {
    return false;
  }

  if (answer.relationTypeCorrect === "Salah" && !answer.correctedRelationType?.trim()) {
    return false;
  }

  return true;
}

export default function PhaseTwoReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<CompletionSurveyItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, CompletionSurveyAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("Belum disimpan");
  const [readyToSave, setReadyToSave] = useState(false);
  const [currentPair, setCurrentPair] = useState("all");
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  const [finishWarning, setFinishWarning] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (!me.ok) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/completion-survey", { cache: "no-store" });
      if (!res.ok) {
        setError("Gagal memuat validasi fase 2.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as SurveyPayload;
      setItems(data.items);
      setAnswers(data.progress?.answers || {});
      setSubmitted(Boolean(data.progress?.completedAt));
      setLoading(false);
      setReadyToSave(true);
      setSaveState("Dimuat");
    };

    load();
  }, [router]);

  useEffect(() => {
    if (!readyToSave || submitted) return;

    const timer = window.setTimeout(async () => {
      setSaveState("Menyimpan...");

      const res = await fetch("/api/completion-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) {
        setSaveState("Gagal menyimpan");
        return;
      }

      setSaveState(`Tersimpan ${new Date().toLocaleTimeString()}`);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [answers, readyToSave, submitted]);

  const pairOptions = useMemo(() => Array.from(new Set(items.map((item) => item.pair))), [items]);

  const visibleItems = useMemo(() => {
    let next = items;

    if (currentPair !== "all") {
      next = next.filter((item) => item.pair === currentPair);
    }

    if (showOnlyIncomplete) {
      next = next.filter((item) => !isCompleteAnswer(answers[item.id]));
    }

    return next;
  }, [answers, currentPair, items, showOnlyIncomplete]);

  const completedCount = useMemo(
    () => items.filter((item) => isCompleteAnswer(answers[item.id])).length,
    [answers, items],
  );
  const remaining = Math.max(0, items.length - completedCount);
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const saveTone = useMemo(() => {
    if (saveState.startsWith("Menyimpan")) return "saving";
    if (saveState.startsWith("Tersimpan")) return "saved";
    if (saveState.startsWith("Gagal")) return "error";
    return "idle";
  }, [saveState]);

  const updateAnswer = (id: string, patch: CompletionSurveyAnswer) => {
    if (submitted) return;
    setAnswers((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  };

  const submitSurvey = async () => {
    if (remaining > 0) {
      setFinishWarning(`Validasi fase 2 belum selesai. Masih ada ${remaining} relasi yang belum lengkap.`);
      setShowOnlyIncomplete(true);
      return;
    }

    setFinishWarning("");
    const res = await fetch("/api/completion-survey/complete", { method: "POST" });
    const data = (await res.json()) as { ok?: boolean; error?: string };

    if (!res.ok || !data.ok) {
      setFinishWarning(data.error || "Gagal menyelesaikan validasi fase 2.");
      return;
    }

    setSubmitted(true);
    setSaveState("Validasi fase 2 selesai");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (loading) {
    return <main className="page-wrap">Memuat validasi fase 2...</main>;
  }

  if (error) {
    return <main className="page-wrap">{error}</main>;
  }

  return (
    <main className="phase-two-page" id="app">
      <header className="header">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <button className="breadcrumb-link" onClick={() => router.push("/review/available")}>
            Daftar mata pelajaran
          </button>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Fase 2</span>
        </nav>
        <div className="top-row">
          <div>
            <p className="onboarding-kicker">Fase 2</p>
            <h1>Validasi relasi lintas-buku</h1>
          </div>
          <div className="row-actions">
            <button className="btn-outline" onClick={logout}>Keluar</button>
          </div>
        </div>
        <div className="review-status-row">
          <p>Nilai keterkaitan konsep lintas Fisika, Kimia, dan Biologi. Progres tersimpan otomatis.</p>
          <span className={`autosave-pill autosave-${saveTone}`} aria-live="polite">
            {saveState}
          </span>
        </div>
      </header>

      <section className="review-toolbar phase-two-toolbar">
        <div className="chapter-nav">
          <div className="chapter-info">
            <div className="chapter-title-row">
              <span className="chapter-index">{completedCount}/{items.length} selesai</span>
              <span className="chapter-name">Survei completion</span>
              <span className={`chapter-remaining ${remaining === 0 ? "is-complete" : ""}`}>
                {remaining === 0 ? "Lengkap" : `${remaining} tersisa`}
              </span>
            </div>
            <div className="phase-two-progress" aria-label={`Progres ${progressPercent}%`}>
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <button className="btn-primary" onClick={submitSurvey} disabled={submitted}>
            {submitted ? "Sudah selesai" : "Selesaikan fase 2"}
          </button>
        </div>

        <div className="review-filter-row">
          <div className="review-filter-group">
            <label className="review-filter-label" htmlFor="pair-filter">Filter pasangan mapel</label>
            <select
              id="pair-filter"
              className="review-filter-select"
              value={currentPair}
              onChange={(event) => setCurrentPair(event.target.value)}
            >
              <option value="all">Semua pasangan</option>
              {pairOptions.map((pair) => (
                <option key={pair} value={pair}>{pair}</option>
              ))}
            </select>
          </div>
          <label className="phase-two-toggle">
            <input
              type="checkbox"
              checked={showOnlyIncomplete}
              onChange={(event) => setShowOnlyIncomplete(event.target.checked)}
            />
            Hanya yang belum lengkap
          </label>
          <span className="review-filter-summary">{visibleItems.length} relasi ditampilkan</span>
        </div>
        {finishWarning ? <p className="finish-warning">{finishWarning}</p> : null}
        {submitted ? <p className="review-complete-success">Validasi fase 2 sudah dikirim. Terima kasih.</p> : null}
      </section>

      <section className="phase-two-list" aria-label="Daftar relasi lintas-buku">
        {visibleItems.map((item) => {
          const answer = answers[item.id] || {};
          const complete = isCompleteAnswer(answer);

          return (
            <article className={`triple-card phase-two-card ${complete ? "done" : ""}`} key={item.id}>
              <div className="triple-meta">
                <span className="triple-position">{item.id}</span>
                <span className="badge phase-two-pair">{item.pair}</span>
              </div>

              <div className="triple-body">
                <span className="node">
                  <LatexText as="span" text={item.conceptA} /> <span className="phase-two-subject">({item.subjectA})</span>
                </span>
                <span className="arrow">{"->"}</span>
                <span className="rel-badge">{item.proposedRelation}</span>
                <span className="arrow">{"->"}</span>
                <span className="node">
                  <LatexText as="span" text={item.conceptB} /> <span className="phase-two-subject">({item.subjectB})</span>
                </span>
              </div>

              <LatexText as="div" className="triple-desc" text={item.explanation} />

              <div className="phase-two-question-grid">
                <div className="phase-two-field">
                  <span className="rating-label">Relasi valid?</span>
                  <div className="rating-row">
                    {relationValidOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`rating-btn ${answer.relationValid === option ? "selected-correct" : ""}`}
                        aria-pressed={answer.relationValid === option}
                        disabled={submitted}
                        onClick={() => updateAnswer(item.id, { relationValid: option })}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="phase-two-field">
                  <span className="rating-label">Tipe relasi benar?</span>
                  <div className="rating-row">
                    {relationTypeOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`rating-btn ${answer.relationTypeCorrect === option ? "selected-partial" : ""}`}
                        aria-pressed={answer.relationTypeCorrect === option}
                        disabled={submitted}
                        onClick={() => updateAnswer(item.id, { relationTypeCorrect: option })}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="phase-two-field">
                  <label className="rating-label" htmlFor={`corrected-${item.id}`}>Jika salah, tipe yang benar</label>
                  <input
                    id={`corrected-${item.id}`}
                    className="phase-two-input"
                    value={answer.correctedRelationType || ""}
                    disabled={submitted}
                    onChange={(event) => updateAnswer(item.id, { correctedRelationType: event.target.value })}
                    placeholder="Contoh: MEMPERDALAM"
                  />
                </div>

                <div className="phase-two-field">
                  <span className="rating-label">Arah benar?</span>
                  <div className="rating-row">
                    {directionOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`rating-btn ${answer.directionCorrect === option ? "selected-missing" : ""}`}
                        aria-pressed={answer.directionCorrect === option}
                        disabled={submitted}
                        onClick={() => updateAnswer(item.id, { directionCorrect: option })}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea
                className="comment-input"
                placeholder="Komentar opsional..."
                value={answer.comment || ""}
                disabled={submitted}
                onChange={(event) => updateAnswer(item.id, { comment: event.target.value })}
              />
            </article>
          );
        })}

        {visibleItems.length === 0 ? (
          <div className="empty-filter-state">Tidak ada relasi yang cocok dengan filter saat ini.</div>
        ) : null}
      </section>
    </main>
  );
}
