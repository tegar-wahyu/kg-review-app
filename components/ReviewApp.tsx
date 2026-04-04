"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { extractTriples } from "@/lib/extract";
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

export default function ReviewApp({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triples, setTriples] = useState<ExtractedTriple[]>([]);
  const [ratings, setRatings] = useState<Record<string, ReviewRating>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [missingTriples, setMissingTriples] = useState<MissingTriple[]>([]);
  const [currentFilter, setCurrentFilter] = useState<"all" | "unrated" | "flagged">("all");
  const [chapterOrder, setChapterOrder] = useState<string[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [datasetTitle, setDatasetTitle] = useState("Tinjauan ahli graf pengetahuan");
  const [saveState, setSaveState] = useState("Belum disimpan");
  const [readyToSave, setReadyToSave] = useState(false);
  const [role, setRole] = useState<"admin" | "expert">("expert");

  useEffect(() => {
    const load = async () => {
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (!me.ok) {
        router.replace("/login");
        return;
      }

      const meData = (await me.json()) as SessionPayload;
      setRole(meData.user.role);

      const res = await fetch(`/api/review/${courseId}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Gagal memuat data review.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as ReviewPayload;
      const extracted = extractTriples(data.course.payload);
      const chapters = Array.from(new Set(extracted.map((item) => item.chapter || "Tanpa Kategori")));

      setDatasetTitle(data.course.title || "Tinjauan ahli graf pengetahuan");
      setTriples(extracted);
      setChapterOrder(chapters.length ? chapters : ["Tanpa Kategori"]);
      setCurrentChapterIndex(0);

      if (data.progress) {
        setRatings(data.progress.ratings || {});
        setComments(data.progress.comments || {});
        setMissingTriples(data.progress.missingTriples || []);
      }

      setLoading(false);
      setReadyToSave(true);
      setSaveState("Dimuat");
    };

    load();
  }, [courseId, router]);

  useEffect(() => {
    if (!readyToSave) return;

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
  }, [ratings, comments, missingTriples, readyToSave, courseId]);

  const currentChapterName = chapterOrder[currentChapterIndex] || chapterOrder[0] || "";

  const chapterTriples = useMemo(() => {
    return triples.filter((triple) => (triple.chapter || "Tanpa Kategori") === currentChapterName);
  }, [triples, currentChapterName]);

  const visibleTriples = useMemo(() => {
    if (currentFilter === "unrated") {
      return chapterTriples.filter((triple) => !ratings[String(triple.id)]);
    }

    if (currentFilter === "flagged") {
      return chapterTriples.filter((triple) => !triple.glossary_validated);
    }

    return chapterTriples;
  }, [chapterTriples, currentFilter, ratings]);

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

  const rate = (id: number, value: ReviewRating) => {
    setRatings((prev) => ({ ...prev, [id]: value }));
  };

  const addMissing = () => {
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

  if (loading) {
    return <main className="page-wrap">Memuat review...</main>;
  }

  if (error) {
    return <main className="page-wrap">{error}</main>;
  }

  return (
    <div id="app">
      <div className="header">
        <div className="top-row">
          <h2>{datasetTitle}</h2>
          <div className="row-actions">
            <button className="btn-outline" onClick={() => router.push(role === "admin" ? "/admin" : "/review/available")}>Kembali</button>
            <button className="btn-outline" onClick={logout}>Keluar</button>
          </div>
        </div>
        <p>Tinjau setiap triple, progres akan tersimpan otomatis. {saveState}</p>
      </div>

      <div className="chapter-nav">
        <div className="meta">Bab {currentChapterIndex + 1}/{chapterOrder.length}: {currentChapterName || "-"}</div>
        <div className="nav-actions">
          <button
            className="btn-outline"
            disabled={currentChapterIndex <= 0}
            onClick={() => setCurrentChapterIndex((prev) => Math.max(0, prev - 1))}
          >
            Bab sebelumnya
          </button>
          <button
            className="btn-primary"
            disabled={currentChapterIndex >= chapterOrder.length - 1}
            onClick={() => setCurrentChapterIndex((prev) => Math.min(chapterOrder.length - 1, prev + 1))}
          >
            Bab berikutnya
          </button>
        </div>
      </div>

      <div className="tab-row" id="filter-tabs">
        <button className={`tab ${currentFilter === "all" ? "active" : ""}`} onClick={() => setCurrentFilter("all")}>Semua</button>
        <button className={`tab ${currentFilter === "unrated" ? "active" : ""}`} onClick={() => setCurrentFilter("unrated")}>Belum dinilai</button>
        <button className={`tab ${currentFilter === "flagged" ? "active" : ""}`} onClick={() => setCurrentFilter("flagged")}>Perlu dicek</button>
      </div>

      <div className="stats-row">
        <div className="stat"><div className="stat-label">Triple ditinjau</div><div className="stat-val">{metrics.reviewed}/{metrics.total}</div></div>
        <div className="stat"><div className="stat-label">Presisi</div><div className="stat-val green">{Math.round(metrics.precision * 100)}%</div></div>
        <div className="stat"><div className="stat-label">Recall</div><div className="stat-val amber">{Math.round(metrics.recall * 100)}%</div></div>
        <div className="stat"><div className="stat-label">Skor F1</div><div className="stat-val">{Math.round(metrics.f1 * 100)}%</div></div>
      </div>

      <div className="progress-bar"><div className="progress-fill" style={{ width: metrics.total > 0 ? `${Math.round((metrics.reviewed / metrics.total) * 100)}%` : "0%" }} /></div>

      <div id="triples-container">
        {visibleTriples.map((triple) => {
          const rating = ratings[String(triple.id)];
          const selectedRating = ratingOptions.find((option) => option.value === rating);

          return (
            <div className={`triple-card ${rating ? "done" : ""}`} data-rating={rating || "unrated"} key={triple.id}>
              <div className="triple-meta">
                <span className="chapter-tag">{triple.chapter}</span>
                <span className="subtopic-tag">{triple.subtopic}</span>
                <span className={`answer-status ${rating ? `status-${rating}` : "status-unrated"}`}>
                  {rating ? `Sudah dijawab: ${selectedRating?.label}` : "Belum dijawab"}
                </span>
                {!triple.glossary_validated ? (
                  <span className="badge" style={{ background: "#FAEEDA", color: "#854F0B", fontSize: "10px", padding: "2px 7px", borderRadius: "99px", marginLeft: "4px" }}>
                    belum divalidasi
                  </span>
                ) : null}
              </div>

              <div className="triple-body">
                <span className="node">{triple.subject}</span>
                <span className="arrow">→</span>
                <span className="rel-badge">{triple.relation}</span>
                <span className="arrow">→</span>
                <span className="node">{triple.target}</span>
              </div>

              <div className="triple-desc">{triple.description}</div>

              <div className="rating-row">
                {ratingOptions.map((option) => {
                  const isSelected = rating === option.value;

                  return (
                    <button
                      key={option.value}
                      aria-pressed={isSelected}
                      className={`rating-btn ${isSelected ? `selected-${option.tone}` : ""}`}
                      onClick={() => rate(triple.id, option.value)}
                    >
                      {option.symbol} {option.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                className="comment-input"
                placeholder="Komentar opsional..."
                value={comments[String(triple.id)] || ""}
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

        {currentFilter === "all" ? (
          <div className="triple-card" style={{ borderStyle: "dashed" }}>
            <div style={{ fontSize: "13px", fontWeight: 500, marginBottom: "10px" }}>Tambah triple yang belum ada</div>
            <div className="missing-form" style={{ display: "block" }}>
              <input type="text" id="m-subject" placeholder="Subjek (mis. Enzim)" />
              <input type="text" id="m-relation" placeholder="Relasi (mis. MEMBUTUHKAN)" />
              <input type="text" id="m-target" placeholder="Target (mis. Air)" />
              <input type="text" id="m-desc" placeholder="Deskripsi (opsional)" />
              <button className="btn-primary" onClick={addMissing} style={{ fontSize: "12px", padding: "6px 14px" }}>
                Tambah triple
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="actions-row">
        <button className="btn-primary" onClick={exportResults}>Ekspor hasil JSON</button>
      </div>

      <div className="results-panel" style={{ display: "block" }}>
        <h3>Ringkasan validasi</h3>
        <div className="metric-grid">
          <div className="metric"><div className="metric-num green">{Math.round(metrics.precision * 100)}%</div><div className="metric-lbl">Presisi</div></div>
          <div className="metric"><div className="metric-num amber">{Math.round(metrics.recall * 100)}%</div><div className="metric-lbl">Recall</div></div>
          <div className="metric"><div className="metric-num">{Math.round(metrics.f1 * 100)}%</div><div className="metric-lbl">Skor F1</div></div>
        </div>
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
