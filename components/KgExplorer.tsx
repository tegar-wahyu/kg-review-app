"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Node as NvlNode, Relationship as NvlRel } from "@neo4j-nvl/base";
import type { GraphCanvasHandle } from "@/components/GraphCanvas";
import LatexText from "@/components/LatexText";

const GraphCanvas = dynamic(() => import("@/components/GraphCanvas"), {
  ssr: false,
  loading: () => <div className="kgx-loading">memuat grafik…</div>,
});

// --- data shapes (match scripts/build-kg-data.mjs output) ------------------
type GraphNode = {
  id: string;
  name: string;
  grade: string;
  description: string;
  stub: boolean;
  kind: "concept" | "chapter" | "subtopic" | "grade";
};
type GraphRel = {
  id: string;
  from: string;
  to: string;
  type: string;
  description: string;
  confidence: number | null;
  crossBook: boolean;
  structural: boolean;
};
type GraphData = {
  step: number;
  label: string;
  nodes: GraphNode[];
  relationships: GraphRel[];
};

type StepDef = { step: number; key: string; label: string; sub: string };

const STEPS: StepDef[] = [
  { step: 1, key: "step1", label: "Ekstraksi", sub: "Topik mentah dari PDF" },
  { step: 2, key: "step2", label: "Konsensus", sub: "Multi-judge + repair" },
  { step: 3, key: "step3", label: "Completion", sub: "Edge lintas-buku" },
  { step: 4, key: "step4", label: "Final", sub: "KG gabungan" },
];

// --- book palette ----------------------------------------------------------
type Book = { key: string; label: string; color: string };
const BOOKS: Book[] = [
  { key: "Biologi", label: "Biologi", color: "#3a9d6b" },
  { key: "Fisika", label: "Fisika", color: "#c08a2d" },
  { key: "Kimia", label: "Kimia", color: "#8b5cb8" },
];
const STUB_COLOR = "#c4c7cd";
const GRADE_COLOR = "#18181b";
const CHAPTER_COLOR = "#3f3f46";
const SUBTOPIC_COLOR = "#71717a";
const CROSS_COLOR = "#2563eb";
const INTRA_COLOR = "#cbd0d8";
const STRUCT_COLOR = "#d4d4d4";
const MATCH_COLOR = "#1f2328";

function bookOf(grade: string): Book | null {
  return BOOKS.find((b) => grade?.includes(b.key)) ?? null;
}

type EdgeScope = "all" | "intra" | "cross";
type Source = "yhoga" | "canonical";

// Steps that only exist as canonical file snapshots (never lived in yhoga).
const CANONICAL_ONLY = new Set(["step1", "step2"]);

export default function KgExplorer() {
  const [source, setSource] = useState<Source>("yhoga");
  const [stepKey, setStepKey] = useState("step4");
  const [cache, setCache] = useState<Record<string, GraphData>>({});
  const [fellBack, setFellBack] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeBooks, setActiveBooks] = useState<Set<string>>(
    () => new Set(BOOKS.map((b) => b.key)),
  );
  const [activeTypes, setActiveTypes] = useState<Set<string> | null>(null);
  const [edgeScope, setEdgeScope] = useState<EdgeScope>("all");
  const [showStubs, setShowStubs] = useState(true);
  const [showStructure, setShowStructure] = useState(true);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"forceDirected" | "hierarchical">(
    "forceDirected",
  );

  const [selected, setSelected] = useState<
    { kind: "node" | "rel"; id: string } | null
  >(null);

  const controlsRef = useRef<GraphCanvasHandle | null>(null);

  // For canonical-only steps, yhoga transparently falls back to canonical.
  const effectiveSource: Source =
    source === "yhoga" && CANONICAL_ONLY.has(stepKey) ? "canonical" : source;
  const cacheKey = `${effectiveSource}:${stepKey}`;
  const graph = cache[cacheKey];

  // Load the active step's graph on demand, with fallback to canonical when a
  // yhoga file is missing (e.g. only step3/step4 are dumped from the DB).
  useEffect(() => {
    if (cache[cacheKey]) {
      setLoading(false);
      setFellBack(effectiveSource !== source);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const tryFetch = async (src: Source) => {
        const res = await fetch(`/kg-data/${src}/${stepKey}.json`, {
          cache: "force-cache",
        });
        if (!res.ok) throw new Error(`${res.status}`);
        return (await res.json()) as GraphData;
      };

      try {
        let used = effectiveSource;
        let data: GraphData;
        try {
          data = await tryFetch(effectiveSource);
        } catch {
          if (effectiveSource === "yhoga") {
            used = "canonical";
            data = await tryFetch("canonical");
          } else {
            throw new Error("unavailable");
          }
        }
        if (cancelled) return;
        setCache((c) => ({ ...c, [`${used}:${stepKey}`]: data }));
        setFellBack(used !== source);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, stepKey, effectiveSource, source, cache]);

  // Reset relationship-type filter when the step changes.
  useEffect(() => {
    setActiveTypes(null);
    setSelected(null);
  }, [stepKey]);

  // Available relationship types for the current graph.
  const relTypes = useMemo(() => {
    if (!graph) return [];
    const counts = new Map<string, number>();
    for (const r of graph.relationships) {
      counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  const typeSet = useMemo(() => {
    if (activeTypes) return activeTypes;
    return new Set(relTypes.map(([t]) => t));
  }, [activeTypes, relTypes]);

  // Book counts for the rail.
  const bookCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (graph) {
      for (const n of graph.nodes) {
        if (n.kind !== "concept" || n.stub) continue;
        const b = bookOf(n.grade);
        if (b) counts.set(b.key, (counts.get(b.key) ?? 0) + 1);
      }
    }
    return counts;
  }, [graph]);

  // Build the filtered NVL graph.
  const { nvlNodes, nvlRels, visibleNodeCount, visibleRelCount, matchCount } =
    useMemo(() => {
      if (!graph) {
        return {
          nvlNodes: [] as NvlNode[],
          nvlRels: [] as NvlRel[],
          visibleNodeCount: 0,
          visibleRelCount: 0,
          matchCount: 0,
        };
      }
      const q = search.trim().toLowerCase();
      const visible = new Set<string>();
      const nodes: NvlNode[] = [];
      let matches = 0;

      for (const n of graph.nodes) {
        const book = bookOf(n.grade);
        const bookKey = book?.key ?? "__other";
        if (book && !activeBooks.has(bookKey)) continue;
        if (n.kind === "concept" && n.stub && !showStubs) continue;
        if (n.kind !== "concept" && !showStructure) continue;
        visible.add(n.id);

        const isMatch =
          q.length > 0 && n.kind === "concept" && n.name.toLowerCase().includes(q);
        if (isMatch) matches += 1;

        let color: string;
        let size: number;
        if (n.kind === "grade") {
          color = GRADE_COLOR;
          size = 40;
        } else if (n.kind === "chapter") {
          color = CHAPTER_COLOR;
          size = 32;
        } else if (n.kind === "subtopic") {
          color = SUBTOPIC_COLOR;
          size = 24;
        } else if (n.stub) {
          color = STUB_COLOR;
          size = 16;
        } else {
          color = book?.color ?? "#7c8db5";
          size = 22;
        }
        if (isMatch) {
          color = MATCH_COLOR;
          size = 34;
        }

        nodes.push({
          id: n.id,
          caption: n.name,
          color,
          size,
          selected: selected?.kind === "node" && selected.id === n.id,
        });
      }

      const rels: NvlRel[] = [];
      for (const r of graph.relationships) {
        if (!visible.has(r.from) || !visible.has(r.to)) continue;
        if (!typeSet.has(r.type)) continue;
        if (edgeScope === "intra" && r.crossBook) continue;
        if (edgeScope === "cross" && !r.crossBook) continue;
        let color = INTRA_COLOR;
        let width = 1;
        if (r.crossBook) {
          color = CROSS_COLOR;
          width = 2.4;
        } else if (r.structural) {
          color = STRUCT_COLOR;
          width = 1;
        }
        rels.push({
          id: r.id,
          from: r.from,
          to: r.to,
          color,
          width,
          selected: selected?.kind === "rel" && selected.id === r.id,
        });
      }

      return {
        nvlNodes: nodes,
        nvlRels: rels,
        visibleNodeCount: nodes.length,
        visibleRelCount: rels.length,
        matchCount: matches,
      };
    }, [graph, activeBooks, typeSet, edgeScope, showStubs, showStructure, search, selected]);

  const selectedNode = useMemo(() => {
    if (!graph || selected?.kind !== "node") return null;
    return graph.nodes.find((n) => n.id === selected.id) ?? null;
  }, [graph, selected]);

  const selectedRel = useMemo(() => {
    if (!graph || selected?.kind !== "rel") return null;
    const rel = graph.relationships.find((r) => r.id === selected.id);
    if (!rel) return null;
    const from = graph.nodes.find((n) => n.id === rel.from);
    const to = graph.nodes.find((n) => n.id === rel.to);
    return { rel, from, to };
  }, [graph, selected]);

  const toggleBook = (key: string) =>
    setActiveBooks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleType = (type: string) =>
    setActiveTypes(() => {
      const base = new Set(typeSet);
      if (base.has(type)) base.delete(type);
      else base.add(type);
      return base;
    });

  const hasCross = relTypes.some(([t]) => t.startsWith("LINTAS_BUKU"));

  return (
    <div className="kgx">
      <header className="kgx-top">
        <div className="kgx-brand">
          <h1>
            Peta <em>Pengetahuan</em> Kurikulum
          </h1>
          <span>LLM-Assisted Knowledge Graph Completion</span>
        </div>
        <div className="kgx-steps" role="group" aria-label="Tahap pipeline">
          {STEPS.map((s) => (
            <button
              key={s.key}
              className="kgx-step"
              aria-pressed={s.key === stepKey}
              onClick={() => setStepKey(s.key)}
              title={s.sub}
            >
              <span className="num">{s.step}</span>
              {s.label}
            </button>
          ))}
        </div>
        <div className="kgx-source" role="group" aria-label="Sumber data">
          {(
            [
              ["yhoga", "Neo4j"],
              ["canonical", "Kanonik"],
            ] as [Source, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              className="kgx-src-btn"
              aria-pressed={source === val}
              onClick={() => {
                setSource(val);
                setSelected(null);
              }}
              title={
                val === "yhoga"
                  ? "Dump langsung dari basis data yhoga (sesuai Neo4j Browser)"
                  : "Rekonstruksi dari berkas kanonik per tahap pipeline"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="kgx-body">
        <aside className="kgx-rail">
          <h2>Cari konsep</h2>
          <input
            className="kgx-search"
            placeholder="ketik nama konsep…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.trim() && (
            <div className="kgx-count" style={{ marginTop: "0.4rem" }}>
              {matchCount} kecocokan
            </div>
          )}

          <h2>Buku / Mata pelajaran</h2>
          {BOOKS.map((b) => (
            <label key={b.key} className="kgx-check">
              <input
                type="checkbox"
                checked={activeBooks.has(b.key)}
                onChange={() => toggleBook(b.key)}
              />
              <span
                className="kgx-swatch"
                style={{ background: b.color, color: b.color }}
              />
              {b.label}
              <span className="kgx-count">{bookCounts.get(b.key) ?? 0}</span>
            </label>
          ))}

          {hasCross && (
            <>
              <h2>Cakupan relasi</h2>
              {(
                [
                  ["all", "Semua"],
                  ["intra", "Dalam buku"],
                  ["cross", "Lintas buku"],
                ] as [EdgeScope, string][]
              ).map(([val, label]) => (
                <label key={val} className="kgx-check">
                  <input
                    type="radio"
                    name="scope"
                    checked={edgeScope === val}
                    onChange={() => setEdgeScope(val)}
                  />
                  {label}
                </label>
              ))}
            </>
          )}

          <h2>Tipe relasi</h2>
          {relTypes.map(([type, count]) => (
            <label key={type} className="kgx-check">
              <input
                type="checkbox"
                checked={typeSet.has(type)}
                onChange={() => toggleType(type)}
              />
              <span style={{ fontSize: "0.78rem" }}>
                {type.replace(/^LINTAS_BUKU_/, "↔ ")}
              </span>
              <span className="kgx-count">{count}</span>
            </label>
          ))}

          <h2>Tampilan</h2>
          <label className="kgx-check">
            <input
              type="checkbox"
              checked={showStructure}
              onChange={() => setShowStructure((v) => !v)}
            />
            Tampilkan bab &amp; subbab
          </label>
          <label className="kgx-check">
            <input
              type="checkbox"
              checked={showStubs}
              onChange={() => setShowStubs((v) => !v)}
            />
            Tampilkan konsep rujukan
          </label>
          <label className="kgx-check">
            <input
              type="checkbox"
              checked={layout === "hierarchical"}
              onChange={() =>
                setLayout((l) =>
                  l === "hierarchical" ? "forceDirected" : "hierarchical",
                )
              }
            />
            Tata letak hierarkis
          </label>
        </aside>

        <main className="kgx-stage">
          <div className="kgx-stat">
            <b>{visibleNodeCount}</b> node · <b>{visibleRelCount}</b> relasi
            {source === "yhoga" && !fellBack && graph ? (
              <span className="kgx-badge">● yhoga</span>
            ) : null}
            {fellBack ? (
              <span className="kgx-badge fb">
                tahap ini hanya tersedia dari berkas kanonik
              </span>
            ) : null}
          </div>

          {loading || !graph ? (
            <div className="kgx-loading">memuat tahap…</div>
          ) : (
            <div className="kgx-canvas">
              <GraphCanvas
                key={stepKey}
                nodes={nvlNodes}
                rels={nvlRels}
                layout={layout}
                controlsRef={controlsRef}
                onSelectNode={(id) => setSelected({ kind: "node", id })}
                onSelectRel={(id) => setSelected({ kind: "rel", id })}
                onBackground={() => setSelected(null)}
              />
            </div>
          )}

          <div className="kgx-legend">
            {BOOKS.map((b) => (
              <div className="row" key={b.key}>
                <span
                  className="kgx-swatch"
                  style={{ background: b.color, color: b.color }}
                />
                {b.label}
              </div>
            ))}
            {showStructure && (
              <>
                <div className="row">
                  <span
                    className="kgx-swatch"
                    style={{ background: CHAPTER_COLOR, color: CHAPTER_COLOR }}
                  />
                  Bab
                </div>
                <div className="row">
                  <span
                    className="kgx-swatch"
                    style={{ background: SUBTOPIC_COLOR, color: SUBTOPIC_COLOR }}
                  />
                  Subbab
                </div>
              </>
            )}
            {hasCross && (
              <div className="row">
                <span className="line" /> Relasi lintas buku
              </div>
            )}
          </div>

          <div className="kgx-tools">
            <button
              className="kgx-tool"
              title="Paskan ke layar"
              onClick={() => controlsRef.current?.fit()}
            >
              ⤢
            </button>
            <button
              className="kgx-tool"
              title="Perbesar"
              onClick={() => controlsRef.current?.zoomIn()}
            >
              +
            </button>
            <button
              className="kgx-tool"
              title="Perkecil"
              onClick={() => controlsRef.current?.zoomOut()}
            >
              −
            </button>
          </div>

          <aside className={`kgx-detail${selected ? " open" : ""}`}>
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>

            {selectedNode && (
              <>
                <div className="kgx-kind">
                  {selectedNode.kind === "grade"
                    ? "Mata Pelajaran"
                    : selectedNode.kind === "chapter"
                      ? "Bab"
                      : selectedNode.kind === "subtopic"
                        ? "Subbab"
                        : "Konsep"}
                </div>
                <h3>{selectedNode.name}</h3>
                <span
                  className="kgx-pill"
                  style={{
                    color: bookOf(selectedNode.grade)?.color ?? undefined,
                    borderColor: bookOf(selectedNode.grade)?.color ?? undefined,
                  }}
                >
                  {selectedNode.grade}
                </span>
                {selectedNode.kind === "concept" && selectedNode.stub && (
                  <span className="kgx-pill">konsep rujukan</span>
                )}
                {selectedNode.description ? (
                  <LatexText
                    as="div"
                    className="desc"
                    text={selectedNode.description}
                  />
                ) : (
                  <div className="desc empty">
                    Tidak ada deskripsi tersimpan untuk konsep ini.
                  </div>
                )}
                <p className="kgx-hint">
                  Klik relasi untuk melihat penjelasan hubungan. Seret node untuk
                  menata ulang; gulir untuk zoom.
                </p>
              </>
            )}

            {selectedRel && (
              <>
                <div className="kgx-kind">
                  {selectedRel.rel.crossBook ? "Relasi lintas buku" : "Relasi"}
                </div>
                <h3>{selectedRel.rel.type.replace(/_/g, " ")}</h3>
                <div className="kgx-endpoints">
                  <span>{selectedRel.from?.name ?? selectedRel.rel.from}</span>
                  <span className="arrow">→</span>
                  <span>{selectedRel.to?.name ?? selectedRel.rel.to}</span>
                </div>
                {selectedRel.from && selectedRel.to && (
                  <div className="kgx-meta-row">
                    <span>arah</span>
                    <span>
                      {selectedRel.from.grade} → {selectedRel.to.grade}
                    </span>
                  </div>
                )}
                {typeof selectedRel.rel.confidence === "number" && (
                  <div className="kgx-meta-row" style={{ display: "block" }}>
                    <span>confidence</span>
                    <div className="kgx-conf">
                      <i
                        style={{
                          width: `${Math.round(selectedRel.rel.confidence * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {selectedRel.rel.description ? (
                  <LatexText
                    as="div"
                    className="desc"
                    text={selectedRel.rel.description}
                  />
                ) : (
                  <div className="desc empty">
                    Tidak ada penjelasan hubungan.
                  </div>
                )}
              </>
            )}

            {!selected && null}
          </aside>
        </main>
      </div>
    </div>
  );
}
