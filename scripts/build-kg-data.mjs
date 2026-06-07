// Build normalized graph JSON for the public KG explorer (/explore).
//
// Reads the canonical paper data from the PARENT repo (../data/canonical) and
// emits one graph file per pipeline step into public/kg-data/. The output is
// committed so the deployed app stays self-contained (the parent repo is not
// present on Vercel). Re-run with `npm run build:kg-data` whenever the
// canonical data changes.
//
// Output graph shape (per step):
//   { step, label, nodes: GraphNode[], relationships: GraphRel[] }
//   GraphNode = { id, name, grade, description, stub, kind }
//                kind = "concept" | "chapter" | "subtopic"
//   GraphRel  = { id, from, to, type, description, confidence, crossBook,
//                 structural }

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");
const CANONICAL = resolve(APP_ROOT, "..", "data", "canonical");
const OUT_DIR = join(APP_ROOT, "public", "kg-data", "canonical");

const BOOK_FILES = [
  "Biologi Kelas XII",
  "Fisika Kelas XII",
  "Kimia Kelas XII",
];

const conceptId = (grade, name) => `${grade}::C::${name}`.trim();
const chapterId = (grade, chapter) => `${grade}::B::${chapter}`.trim();
const subtopicId = (grade, chapter, sub) =>
  `${grade}::S::${chapter}::${sub}`.trim();

// --- intra-book graph (extraction / consensus share one shape) -------------
// Emits the full hierarchy as nodes + edges so the graph is well-connected:
//   Chapter -[MEMUAT]-> Subtopic -[MEMUAT]-> Concept
//   Chapter -[BERIKUTNYA]-> Chapter (sequence)
//   Concept -[<relation.type>]-> Concept (or stub Concept)
function buildIntraGraph(books) {
  const nodes = new Map();
  const rels = [];
  let relSeq = 0;

  const ensureConcept = (grade, name, description, stub) => {
    const id = conceptId(grade, name);
    const existing = nodes.get(id);
    if (existing) {
      if (existing.stub && !stub) {
        existing.stub = false;
        existing.description = description || existing.description;
      }
      return id;
    }
    nodes.set(id, {
      id,
      name,
      grade,
      description: description || "",
      stub,
      kind: "concept",
    });
    return id;
  };

  const ensureChapter = (grade, name, summary) => {
    const id = chapterId(grade, name);
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        name,
        grade,
        description: summary || "",
        stub: false,
        kind: "chapter",
      });
    }
    return id;
  };

  const ensureSubtopic = (grade, chapter, name) => {
    const id = subtopicId(grade, chapter, name);
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        name,
        grade,
        description: "",
        stub: false,
        kind: "subtopic",
      });
    }
    return id;
  };

  const addRel = (from, to, type, opts = {}) => {
    rels.push({
      id: `r${relSeq++}`,
      from,
      to,
      type,
      description: opts.description || "",
      confidence: null,
      crossBook: false,
      structural: opts.structural || false,
    });
  };

  for (const book of books) {
    const grade = book.grade;
    const chapters = book.chapters || [];

    // Chapter sequence (BERIKUTNYA).
    for (let i = 0; i < chapters.length - 1; i += 1) {
      const a = chapters[i];
      const b = chapters[i + 1];
      if (!a?.chapter || !b?.chapter) continue;
      const fromId = ensureChapter(grade, a.chapter, a.chapter_summary);
      const toId = ensureChapter(grade, b.chapter, b.chapter_summary);
      addRel(fromId, toId, "BERIKUTNYA", { structural: true });
    }

    for (const chapter of chapters) {
      if (!chapter?.chapter) continue;
      const chId = ensureChapter(grade, chapter.chapter, chapter.chapter_summary);

      for (const sub of chapter.subtopics || []) {
        if (!sub?.name) continue;
        const subId = ensureSubtopic(grade, chapter.chapter, sub.name);
        addRel(chId, subId, "MEMUAT", { structural: true });

        for (const concept of sub.concepts || []) {
          if (!concept?.name) continue;
          const fromId = ensureConcept(
            grade,
            concept.name,
            concept.description,
            false,
          );
          addRel(subId, fromId, "MEMUAT", { structural: true });

          for (const rel of concept.relations || []) {
            if (!rel?.target) continue;
            const toId = ensureConcept(grade, rel.target, "", true);
            addRel(fromId, toId, rel.type || "BERKAITAN_DENGAN", {
              description: rel.description || "",
            });
          }
        }
      }
    }
  }

  return { nodes: [...nodes.values()], relationships: rels };
}

// --- cross-book graph (completion step) ------------------------------------
function buildCrossGraph(payload, descLookup) {
  const nodes = new Map();
  const rels = [];
  let relSeq = 0;

  const ensureNode = (grade, name) => {
    const id = conceptId(grade, name);
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        name,
        grade,
        description: descLookup.get(id) || "",
        stub: false,
        kind: "concept",
      });
    }
    return id;
  };

  for (const edge of payload.edges || []) {
    const fromId = ensureNode(edge.source_grade, edge.source_name);
    const toId = ensureNode(edge.target_grade, edge.target_name);
    const props = edge.properties || {};
    rels.push({
      id: `x${relSeq++}`,
      from: fromId,
      to: toId,
      type: edge.rel_type || "LINTAS_BUKU",
      description: props.description || "",
      confidence: typeof props.confidence === "number" ? props.confidence : null,
      crossBook: true,
      structural: false,
    });
  }

  return { nodes: [...nodes.values()], relationships: rels };
}

function mergeGraphs(a, b) {
  const nodes = new Map();
  for (const n of [...a.nodes, ...b.nodes]) {
    const existing = nodes.get(n.id);
    if (!existing) {
      nodes.set(n.id, { ...n });
    } else if (!existing.description && n.description) {
      existing.description = n.description;
      existing.stub = existing.stub && n.stub;
    }
  }
  return {
    nodes: [...nodes.values()],
    relationships: [...a.relationships, ...b.relationships],
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadBooks(subdir) {
  const out = [];
  for (const base of BOOK_FILES) {
    const candidates = [
      join(CANONICAL, subdir, `${base}.json`),
      join(CANONICAL, subdir, `${base}.consensus.repaired.json`),
    ];
    const path = candidates.find((p) => existsSync(p));
    if (!path) {
      console.warn(`  ! missing ${subdir}/${base}`);
      continue;
    }
    out.push(await readJson(path));
  }
  return out;
}

async function main() {
  if (!existsSync(CANONICAL)) {
    throw new Error(
      `Canonical data not found at ${CANONICAL}. This generator must run inside the parent repo checkout.`,
    );
  }
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Step 1 — extraction");
  const extractionBooks = await loadBooks("01_extraction");
  const step1 = buildIntraGraph(extractionBooks);

  console.log("Step 2 — consensus");
  const consensusBooks = await loadBooks("02_consensus");
  const step2 = buildIntraGraph(consensusBooks);

  // Description lookup for cross-book endpoints (prefer consensus definitions).
  // Only pull from concept nodes; chapter summaries are not concept descriptions.
  const descLookup = new Map();
  for (const n of step2.nodes) {
    if (n.kind === "concept" && n.description) descLookup.set(n.id, n.description);
  }

  console.log("Step 3 — completion (cross-book)");
  const completion = await readJson(
    join(CANONICAL, "03_completion", "lintas_buku_edges.t070_k20.json"),
  );
  const step3 = buildCrossGraph(completion, descLookup);

  console.log("Step 4 — final (consensus + cross-book)");
  const step4 = mergeGraphs(step2, step3);

  const steps = [
    { step: 1, label: "Ekstraksi", key: "step1", graph: step1 },
    { step: 2, label: "Konsensus", key: "step2", graph: step2 },
    { step: 3, label: "Completion", key: "step3", graph: step3 },
    { step: 4, label: "Final", key: "step4", graph: step4 },
  ];

  const meta = { generatedFrom: "data/canonical", steps: [] };
  for (const s of steps) {
    const payload = { step: s.step, label: s.label, ...s.graph };
    await writeFile(
      join(OUT_DIR, `${s.key}.json`),
      JSON.stringify(payload),
      "utf8",
    );
    const concepts = s.graph.nodes.filter((n) => n.kind === "concept" && !n.stub).length;
    const chapters = s.graph.nodes.filter((n) => n.kind === "chapter").length;
    const subtopics = s.graph.nodes.filter((n) => n.kind === "subtopic").length;
    meta.steps.push({
      step: s.step,
      key: s.key,
      label: s.label,
      nodeCount: s.graph.nodes.length,
      conceptCount: concepts,
      chapterCount: chapters,
      subtopicCount: subtopics,
      relCount: s.graph.relationships.length,
      structuralCount: s.graph.relationships.filter((r) => r.structural).length,
      crossBookCount: s.graph.relationships.filter((r) => r.crossBook).length,
    });
    console.log(
      `  ${s.key}: ${s.graph.nodes.length} nodes, ${s.graph.relationships.length} rels`,
    );
  }

  await writeFile(join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  console.log(`\nWrote ${steps.length} graphs + meta.json to public/kg-data/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
