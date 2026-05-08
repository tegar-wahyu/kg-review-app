"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractTriples } from "@/lib/extract";
import LatexText from "@/components/LatexText";
import {
  CourseRecord,
  ExtractedTriple,
  MissingTriple,
  ReviewProgress,
  ReviewRating,
} from "@/lib/types";

type ReviewPayload = {
  course: CourseRecord;
  progress: ReviewProgress | null;
  progressOwner?: string;
};

type SessionPayload = {
  user: {
    username: string;
    role: "admin" | "expert";
  };
};

const ratingOptions: Array<{ value: ReviewRating; label: string; symbol: string; tone: string }> = [
  { value: "correct", label: "Benar", symbol: "✓", tone: "correct" },
  { value: "partial", label: "Sebagian benar", symbol: "~", tone: "partial" },
  { value: "wrong", label: "Salah", symbol: "✗", tone: "wrong" },
  { value: "missing", label: "Kurang konteks", symbol: "+", tone: "missing" },
];

export default function ReviewApp({
  courseId,
  readOnly = false,
  expertUsername,
}: {
  courseId: string;
  readOnly?: boolean;
  expertUsername?: string;
}) {
  const router = useRouter();
  const tripleRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triples, setTriples] = useState<ExtractedTriple[]>([]);
  const [ratings, setRatings] = useState<Record<string, ReviewRating>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [missingTriples, setMissingTriples] = useState<MissingTriple[]>([]);
  const [currentFilter, setCurrentFilter] = useState<"all" | "unrated" | "flagged">("all");
  const [currentSubtopic, setCurrentSubtopic] = useState("all");
  const [chapterOrder, setChapterOrder] = useState<string[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [datasetTitle, setDatasetTitle] = useState("Validasi ahli graf pengetahuan");
  const [saveState, setSaveState] = useState("Belum disimpan");
  const [readyToSave, setReadyToSave] = useState(false);
  const [role, setRole] = useState<"admin" | "expert">("expert");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [progressOwner, setProgressOwner] = useState("");
  const [finishWarning, setFinishWarning] = useState("");

  useEffect(() => {
    const load = async () => {
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (!me.ok) {
        router.replace("/login");
        return;
      }

      const meData = (await me.json()) as SessionPayload;
      setRole(meData.user.role);

      const query = readOnly && expertUsername ? `?expert=${encodeURIComponent(expertUsername)}` : "";
      const res = await fetch(`/api/review/${courseId}${query}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Gagal memuat data review.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as ReviewPayload;
      const extracted = extractTriples(data.course.payload);
      const chapters = Array.from(new Set(extracted.map((item) => item.chapter || "Tanpa Kategori")));

      setDatasetTitle(data.course.title || "Validasi ahli graf pengetahuan");
      setProgressOwner(data.progressOwner || "");
      setTriples(extracted);
      setChapterOrder(chapters.length ? chapters : ["Tanpa Kategori"]);
      setCurrentChapterIndex(0);

      if (data.progress) {
        setRatings(data.progress.ratings || {});
        setComments(data.progress.comments || {});
        setMissingTriples(data.progress.missingTriples || []);
      }

      setLoading(false);
      setReadyToSave(!readOnly);
      setSaveState(readOnly ? "Mode lihat (read-only)" : "Dimuat");
    };

    load();
  }, [courseId, router, readOnly, expertUsername]);

  useEffect(() => {
    if (!readyToSave || readOnly) return;

    const timer = setTimeout(async () => {
      setSaveState("Menyimpan...");

      const res = await fetch(`/api/review/${courseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings, comments, missingTriples }),
      });

      if (!res.ok) {
        setSaveState("Gagal menyimpan");
        return;
      }

      setSaveState(`Tersimpan ${new Date().toLocaleTimeString()}`);
    }, 700);

    return () => clearTimeout(timer);
  }, [ratings, comments, missingTriples, readyToSave, courseId, readOnly]);

  const currentChapterName = chapterOrder[currentChapterIndex] || chapterOrder[0] || "";
  const atFirstChapter = currentChapterIndex <= 0;
  const atLastChapter = currentChapterIndex >= chapterOrder.length - 1;
  const isExpert = role === "expert";

  const saveTone = useMemo(() => {
    if (readOnly) return "readonly";
    if (saveState.startsWith("Menyimpan")) return "saving";
    if (saveState.startsWith("Tersimpan")) return "saved";
    if (saveState.startsWith("Gagal")) return "error";
    return "idle";
  }, [saveState, readOnly]);

  const chapterTriples = useMemo(() => {
    return triples.filter((triple) => (triple.chapter || "Tanpa Kategori") === currentChapterName);
  }, [triples, currentChapterName]);

  const subtopicOptions = useMemo(() => {
    const order = Array.from(
      new Set(chapterTriples.map((triple) => triple.subtopic?.trim() || "Tanpa Subbab")),
    );
    return order;
  }, [chapterTriples]);

  const visibleTriples = useMemo(() => {
    let next = chapterTriples;

    if (currentSubtopic !== "all") {
      next = next.filter((triple) => (triple.subtopic?.trim() || "Tanpa Subbab") === currentSubtopic);
    }

    if (currentFilter === "unrated") {
      return next.filter((triple) => !ratings[String(triple.id)]);
    }

    if (currentFilter === "flagged") {
      return next.filter((triple) => !triple.glossary_validated);
    }

    return next;
  }, [chapterTriples, currentFilter, currentSubtopic, ratings]);

  const groupedVisibleTriples = useMemo(() => {
    const groups = new Map<string, ExtractedTriple[]>();

    for (const triple of visibleTriples) {
      const subtopic = triple.subtopic?.trim() || "Tanpa Subbab";
      const existing = groups.get(subtopic) || [];
      existing.push(triple);
      groups.set(subtopic, existing);
    }

    return Array.from(groups.entries()).map(([subtopic, items]) => ({ subtopic, items }));
  }, [visibleTriples]);

  const tripleOrderInChapter = useMemo(() => {
    const lookup: Record<number, number> = {};

    chapterTriples.forEach((triple, index) => {
      lookup[triple.id] = index + 1;
    });

    return lookup;
  }, [chapterTriples]);

  const chapterRatings = useMemo(() => {
    const ids = new Set(chapterTriples.map((triple) => String(triple.id)));
    return Object.entries(ratings)
      .filter(([id]) => ids.has(String(id)))
      .map(([, value]) => value);
  }, [chapterTriples, ratings]);

  const metrics = useMemo(() => {
    const total = chapterTriples.length;
    const reviewed = chapterRatings.length;
    const correct = chapterRatings.filter((value) => value === "correct").length;
    const partial = chapterRatings.filter((value) => value === "partial").length;
    const wrong = chapterRatings.filter((value) => value === "wrong").length;
    const missing = missingTriples.filter((item) => item.chapter === currentChapterName).length;
    const unrated = total - reviewed;

    const precision = reviewed > 0 ? (correct + partial * 0.5) / reviewed : 0;
    const recallBase = reviewed + missing;
    const recall = recallBase > 0 ? (correct + partial * 0.5) / recallBase : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      total,
      reviewed,
      correct,
      partial,
      wrong,
      missing,
      unrated,
      precision,
      recall,
      f1,
    };
  }, [chapterTriples, chapterRatings, missingTriples, currentChapterName]);

  useEffect(() => {
    setCurrentSubtopic("all");
  }, [currentChapterName]);

  const remainingOverall = useMemo(() => {
    return triples.reduce((count, triple) => (ratings[String(triple.id)] ? count : count + 1), 0);
  }, [triples, ratings]);

  const missingTriplesInCurrentChapter = useMemo(() => {
    return missingTriples
      .map((triple, index) => ({ triple, index }))
      .filter(({ triple }) => triple.chapter === currentChapterName);
  }, [missingTriples, currentChapterName]);

  const rate = (id: number, value: ReviewRating) => {
    if (readOnly) return;
    setRatings((prev) => ({ ...prev, [id]: value }));
  };

  const addMissing = () => {
    if (readOnly) return;

    const subjectInput = document.getElementById("m-subject") as HTMLInputElement | null;
    const relationInput = document.getElementById("m-relation") as HTMLInputElement | null;
    const targetInput = document.getElementById("m-target") as HTMLInputElement | null;
    const descInput = document.getElementById("m-desc") as HTMLInputElement | null;

    const subject = subjectInput?.value.trim() || "";
    const relation = relationInput?.value.trim() || "";
    const target = targetInput?.value.trim() || "";
    const description = descInput?.value.trim() || "";

    if (!subject || !relation || !target) {
      alert("Subjek, relasi, dan target wajib diisi.");
      return;
    }

    setMissingTriples((prev) => [
      ...prev,
      {
        chapter: currentChapterName,
        subject,
        relation,
        target,
        description,
      },
    ]);

    if (subjectInput) subjectInput.value = "";
    if (relationInput) relationInput.value = "";
    if (targetInput) targetInput.value = "";
    if (descInput) descInput.value = "";
  };

  const updateMissingTriple = (index: number, field: keyof MissingTriple, value: string) => {
    if (readOnly) return;

    setMissingTriples((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return {
          ...item,
          [field]: value,
        };
      }),
    );
  };

  const removeMissingTriple = (index: number) => {
    if (readOnly) return;
    setMissingTriples((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const exportResults = () => {
    const output = {
      summary: {
        total_triples: triples.length,
        reviewed: Object.keys(ratings).length,
        missing_added: missingTriples.length,
      },
      rated_triples: triples.map((triple) => ({
        ...triple,
        rating: ratings[String(triple.id)] || "unrated",
        comment: comments[String(triple.id)] || "",
      })),
      missing_triples: missingTriples,
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kg_review_results_${courseId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const goToPreviousChapter = () => {
    setCurrentChapterIndex((prev) => Math.max(0, prev - 1));
  };

  const goToNextChapter = () => {
    setCurrentChapterIndex((prev) => Math.min(chapterOrder.length - 1, prev + 1));
  };

  const handleNextAction = () => {
    if (atLastChapter) {
      if (readOnly) return;
      if (remainingOverall > 0) {
        setFinishWarning(`Review belum selesai. Masih ada ${remainingOverall} triple yang belum tervalidasi di seluruh bab.`);
        return;
      }

      setFinishWarning("");
      router.push(`/review/${courseId}/complete`);
      return;
    }

    setFinishWarning("");
    goToNextChapter();
  };

  const nextButtonLabel = atLastChapter && !readOnly ? "Selesaikan validasi" : "Bab berikutnya";
  const nextButtonDisabled = readOnly && atLastChapter;

  const jumpToTriple = (id: number) => {
    const target = tripleRefs.current[id];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (loading) {
    return <main className="page-wrap">Memuat review...</main>;
  }

  if (error) {
    return <main className="page-wrap">{error}</main>;
  }

  return (
    <div id="app">
      <div className="header">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <button
            className="breadcrumb-link"
            onClick={() => router.push(role === "admin" ? "/admin" : "/review/available")}
          >
            {role === "admin" ? "Panel admin" : "Daftar mata pelajaran"}
          </button>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{datasetTitle}</span>
        </nav>

        <div className="top-row">
          <h1>{datasetTitle}</h1>
          <div className="row-actions">
            <button className="btn-outline" onClick={() => setShowLogoutModal(true)}>Keluar</button>
          </div>
        </div>
        <div className="review-status-row">
          <p>Tinjau setiap triple, progres akan tersimpan otomatis.</p>
          <span className={`autosave-pill autosave-${saveTone}`} aria-live="polite">
            {saveState}
          </span>
        </div>
        {readOnly ? (
          <p className="readonly-note">
            Mode lihat respons expert: <strong>{progressOwner || expertUsername || "expert"}</strong>. Penilaian tidak dapat diubah dari halaman admin.
          </p>
        ) : null}
      </div>

      {showLogoutModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowLogoutModal(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="logout-title">Keluar dari sesi review?</h3>
            <p>Progress yang sudah tersimpan akan tetap aman, tetapi kamu harus masuk lagi untuk melanjutkan.</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowLogoutModal(false)}>
                Batal
              </button>
              <button className="btn-primary" onClick={logout}>
                Ya, keluar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="review-toolbar">
        <div className="chapter-nav">
          <div className="chapter-info">
            <div className="chapter-title-row">
              <span className="chapter-index">Bab {currentChapterIndex + 1}/{chapterOrder.length}</span>
              <span className="chapter-name">{currentChapterName || "-"}</span>
              <span className={`chapter-remaining ${metrics.unrated === 0 ? "is-complete" : ""}`}>
                {metrics.unrated === 0 ? "Bab selesai" : `${metrics.unrated} tersisa`}
              </span>
            </div>
          </div>
          <div className="nav-actions">
            <button
              className="btn-outline"
              disabled={atFirstChapter}
              onClick={goToPreviousChapter}
            >
              Bab sebelumnya
            </button>
            <button
              className="btn-primary"
              disabled={nextButtonDisabled}
              onClick={handleNextAction}
            >
              {nextButtonLabel}
            </button>
          </div>
        </div>

        <div className="tab-row" id="filter-tabs">
          <button className={`tab ${currentFilter === "all" ? "active" : ""}`} onClick={() => setCurrentFilter("all")}>Semua</button>
          <button className={`tab ${currentFilter === "unrated" ? "active" : ""}`} onClick={() => setCurrentFilter("unrated")}>Belum dinilai</button>
          {!isExpert ? (
            <button className={`tab ${currentFilter === "flagged" ? "active" : ""}`} onClick={() => setCurrentFilter("flagged")}>Perlu dicek</button>
          ) : null}
        </div>

        <div className="review-filter-row">
          <div className="review-filter-group">
            <label className="review-filter-label" htmlFor="subtopic-filter">Filter subbab</label>
            <select
              id="subtopic-filter"
              className="review-filter-select"
              value={currentSubtopic}
              onChange={(event) => setCurrentSubtopic(event.target.value)}
            >
              <option value="all">Semua subbab</option>
              {subtopicOptions.map((subtopic) => (
                <option key={subtopic} value={subtopic}>{subtopic}</option>
              ))}
            </select>
          </div>
          <span className="review-filter-summary">
            {visibleTriples.length} triple ditampilkan
          </span>
        </div>

        <div className={`stats-row stats-row-with-jump ${isExpert ? "stats-row-compact" : ""}`}>
          <div className="jump-triple" aria-label="Lompat ke triple">
            <div className="jump-triple-head">
              <span className="jump-triple-label">Lompat triple</span>
              <span className="jump-triple-summary">{visibleTriples.length} tampil</span>
            </div>
            <div className="jump-triple-buttons">
              {visibleTriples.map((triple, index) => {
                const ratingValue = ratings[String(triple.id)];
                const orderNumber = tripleOrderInChapter[triple.id] || index + 1;
                return (
                  <button
                    key={triple.id}
                    className={`jump-btn ${ratingValue ? `is-${ratingValue}` : ""}`}
                    onClick={() => jumpToTriple(triple.id)}
                    title={`Triple ${orderNumber}${ratingValue ? ` (${ratingValue})` : " (belum dinilai)"}`}
                    type="button"
                  >
                    {orderNumber}
                  </button>
                );
              })}
            </div>
          </div>
          {!isExpert ? <div className="stat"><div className="stat-label">Presisi</div><div className="stat-val green">{Math.round(metrics.precision * 100)}%</div></div> : null}
          {!isExpert ? <div className="stat"><div className="stat-label">Recall</div><div className="stat-val amber">{Math.round(metrics.recall * 100)}%</div></div> : null}
          {!isExpert ? <div className="stat"><div className="stat-label">Skor F1</div><div className="stat-val">{Math.round(metrics.f1 * 100)}%</div></div> : null}
        </div>

        {finishWarning ? <p className="finish-warning">{finishWarning}</p> : null}
      </div>

      <div id="triples-container">
        {groupedVisibleTriples.map((group) => (
          <section className="subtopic-section" key={group.subtopic}>
            <div className="subtopic-section-head">
              <div>
                <p className="subtopic-section-kicker">Subbab</p>
                <h2>{group.subtopic}</h2>
              </div>
              <span className="subtopic-section-count">{group.items.length} triple</span>
            </div>

            <div className="subtopic-section-list">
              {group.items.map((triple) => {
                const rating = ratings[String(triple.id)];
                const orderNumber = tripleOrderInChapter[triple.id] || 0;

                return (
                  <div
                    className={`triple-card ${rating ? "done" : ""}`}
                    data-rating={rating || "unrated"}
                    key={triple.id}
                    ref={(element) => {
                      tripleRefs.current[triple.id] = element;
                    }}
                  >
                    <div className="triple-meta">
                      {!isExpert && !triple.glossary_validated ? (
                        <span className="badge" style={{ background: "#FAEEDA", color: "#854F0B", fontSize: "10px", padding: "2px 7px", borderRadius: "99px" }}>
                          belum divalidasi
                        </span>
                      ) : (
                        <span className="triple-position">Triple {orderNumber}</span>
                      )}
                    </div>

                    <div className="triple-body">
                      <LatexText as="span" className="node" text={triple.subject} />
                      <span className="arrow">→</span>
                      <LatexText as="span" className="rel-badge" text={triple.relation} />
                      <span className="arrow">→</span>
                      <LatexText as="span" className="node" text={triple.target} />
                    </div>

                    <LatexText as="div" className="triple-desc" text={triple.description} />

                    <div className="rating-group">
                      <div className="rating-label-row">
                        <span className="rating-label">Penilaian</span>
                        <span className="rating-hint">Pilih satu status yang paling sesuai</span>
                      </div>

                      <div className="rating-row" role="group" aria-label="Pilihan penilaian">
                        {ratingOptions.map((option) => {
                          const isSelected = rating === option.value;

                          return (
                            <button
                              key={option.value}
                              aria-pressed={isSelected}
                              className={`rating-btn ${isSelected ? `selected-${option.tone}` : ""}`}
                              disabled={readOnly}
                              onClick={() => rate(triple.id, option.value)}
                            >
                              <span className="rating-symbol">{option.symbol}</span>
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <textarea
                      className="comment-input"
                      placeholder={readOnly ? "Komentar expert (read-only)" : "Komentar opsional..."}
                      value={comments[String(triple.id)] || ""}
                      readOnly={readOnly}
                      onChange={(event) =>
                        setComments((prev) => ({
                          ...prev,
                          [triple.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {groupedVisibleTriples.length === 0 ? (
          <div className="empty-filter-state">
            Tidak ada triple yang cocok dengan filter saat ini untuk bab ini.
          </div>
        ) : null}

        {currentFilter === "all" && !readOnly ? (
          <div className="triple-card" style={{ borderStyle: "dashed" }}>
            <div className="missing-title">Tambah triple yang belum ada</div>
            <div className="missing-form">
              <div className="missing-graph">
                <div className="missing-field missing-subject">
                  <label htmlFor="m-subject">Subjek</label>
                  <input type="text" id="m-subject" placeholder="cth. Enzim" />
                </div>
                <span className="missing-arrow" aria-hidden="true">→</span>
                <div className="missing-field missing-relation">
                  <label htmlFor="m-relation">Relasi</label>
                  <input type="text" id="m-relation" placeholder="cth. MEMBUTUHKAN" />
                </div>
                <span className="missing-arrow" aria-hidden="true">→</span>
                <div className="missing-field missing-target">
                  <label htmlFor="m-target">Target</label>
                  <input type="text" id="m-target" placeholder="cth. Air" />
                </div>
              </div>

              <div className="missing-note-row">
                <div className="missing-field missing-desc">
                  <label htmlFor="m-desc">Deskripsi tambahan</label>
                  <input type="text" id="m-desc" placeholder="Opsional, jelaskan relasi ini bila perlu" />
                </div>
                <button className="btn-primary missing-submit" onClick={addMissing}>
                  Tambah triple
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {missingTriplesInCurrentChapter.length > 0 ? (
          <div className={`triple-card ${readOnly ? "missing-readonly-card" : ""}`}>
            <div className="missing-list-title">Triple tambahan di bab ini</div>
            <div className="missing-list-body">
              {missingTriplesInCurrentChapter.map(({ triple, index }, itemNumber) => (
                <div className="missing-item" key={`${index}-${triple.subject}-${triple.relation}-${triple.target}`}>
                  <div className="missing-item-head">
                    <span className="missing-item-index">Triple tambahan {itemNumber + 1}</span>
                    {!readOnly ? (
                      <button
                        className="btn-outline missing-item-delete"
                        type="button"
                        onClick={() => removeMissingTriple(index)}
                      >
                        Hapus
                      </button>
                    ) : null}
                  </div>

                  <div className="missing-graph">
                    <div className="missing-field missing-subject">
                      <label htmlFor={`m-edit-subject-${index}`}>Subjek</label>
                      <input
                        type="text"
                        id={`m-edit-subject-${index}`}
                        value={triple.subject}
                        readOnly={readOnly}
                        onChange={(event) => updateMissingTriple(index, "subject", event.target.value)}
                      />
                    </div>
                    <span className="missing-arrow" aria-hidden="true">→</span>
                    <div className="missing-field missing-relation">
                      <label htmlFor={`m-edit-relation-${index}`}>Relasi</label>
                      <input
                        type="text"
                        id={`m-edit-relation-${index}`}
                        value={triple.relation}
                        readOnly={readOnly}
                        onChange={(event) => updateMissingTriple(index, "relation", event.target.value)}
                      />
                    </div>
                    <span className="missing-arrow" aria-hidden="true">→</span>
                    <div className="missing-field missing-target">
                      <label htmlFor={`m-edit-target-${index}`}>Target</label>
                      <input
                        type="text"
                        id={`m-edit-target-${index}`}
                        value={triple.target}
                        readOnly={readOnly}
                        onChange={(event) => updateMissingTriple(index, "target", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="missing-note-row">
                    <div className="missing-field missing-desc">
                      <label htmlFor={`m-edit-desc-${index}`}>Deskripsi tambahan</label>
                      <input
                        type="text"
                        id={`m-edit-desc-${index}`}
                        value={triple.description}
                        readOnly={readOnly}
                        onChange={(event) => updateMissingTriple(index, "description", event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="chapter-nav chapter-nav-bottom">
        <div className="nav-actions">
          <button
            className="btn-outline"
            disabled={atFirstChapter}
            onClick={goToPreviousChapter}
          >
            Bab sebelumnya
          </button>
          <button
            className="btn-primary"
            disabled={nextButtonDisabled}
            onClick={handleNextAction}
          >
            {nextButtonLabel}
          </button>
        </div>
      </div>

      {!isExpert ? (
        <div className="actions-row">
          <button className="btn-primary" onClick={exportResults}>Ekspor hasil JSON</button>
        </div>
      ) : null}

      <div className="results-panel" style={{ display: "block" }}>
        {!isExpert ? <h3>Ringkasan validasi</h3> : null}
        {!isExpert ? (
          <div className="metric-grid">
            <div className="metric"><div className="metric-num green">{Math.round(metrics.precision * 100)}%</div><div className="metric-lbl">Presisi</div></div>
            <div className="metric"><div className="metric-num amber">{Math.round(metrics.recall * 100)}%</div><div className="metric-lbl">Recall</div></div>
            <div className="metric"><div className="metric-num">{Math.round(metrics.f1 * 100)}%</div><div className="metric-lbl">Skor F1</div></div>
          </div>
        ) : null}
        <div className="error-breakdown">
          <div className="section-label">Rincian hasil</div>
          <div className="error-row"><span>Benar</span><span className="badge" style={{ background: "#E1F5EE", color: "#0F6E56" }}>{metrics.correct}</span></div>
          <div className="error-row"><span>Sebagian benar</span><span className="badge" style={{ background: "#FAEEDA", color: "#854F0B" }}>{metrics.partial}</span></div>
          <div className="error-row"><span>Salah</span><span className="badge" style={{ background: "#FAECE7", color: "#993C1D" }}>{metrics.wrong}</span></div>
          <div className="error-row"><span>Kurang konteks (ditambahkan expert)</span><span className="badge" style={{ background: "#E6F1FB", color: "#185FA5" }}>{metrics.missing}</span></div>
          <div className="error-row"><span>Belum dinilai</span><span className="badge" style={{ background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}>{metrics.unrated}</span></div>
        </div>
      </div>
    </div>
  );
}
