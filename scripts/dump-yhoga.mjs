// Dump the yhoga Neo4j database to static graph JSON for the /explore page.
//
// This is the authoritative source for the Final (step 4) and Completion
// (step 3) views — it matches exactly what `MATCH (n) OPTIONAL MATCH
// (n)-[r]->(m) RETURN n,r,m` shows in Neo4j Browser, including the
// Grade/Chapter/Subtopic/Concept/ConceptTarget hierarchy and the rich
// typed relations. Steps 1 & 2 (extraction, consensus) are historical
// snapshots that never lived in yhoga, so they stay file-sourced
// (scripts/build-kg-data.mjs) and the UI falls back to them.
//
// Credentials come from the PARENT repo's .env (NEO4J_*_YHOGA). Output is
// committed so the deployed app needs no DB at runtime. Re-run with
// `npm run dump:yhoga` when yhoga changes.
//
// Output shape matches build-kg-data.mjs so the UI can read either source:
//   { step, label, source, nodes: GraphNode[], relationships: GraphRel[] }

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import neo4j from "neo4j-driver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");
const ENV_PATH = resolve(APP_ROOT, "..", ".env");
const OUT_DIR = join(APP_ROOT, "public", "kg-data", "yhoga");

// Minimal .env reader (avoids a hard dependency on dotenv's API).
async function loadEnv(path) {
  const env = {};
  if (!existsSync(path)) return env;
  const text = await readFile(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

// Map a Neo4j label to our node kind. ConceptTarget = a referenced concept
// that has no full definition of its own (our "stub").
function kindOf(label) {
  switch (label) {
    case "Grade":
      return { kind: "grade", stub: false };
    case "Chapter":
      return { kind: "chapter", stub: false };
    case "Subtopic":
      return { kind: "subtopic", stub: false };
    case "ConceptTarget":
      return { kind: "concept", stub: true };
    case "Concept":
    default:
      return { kind: "concept", stub: false };
  }
}

const STRUCTURAL = new Set(["HAS_CHAPTER", "HAS_SUBTOPIC", "HAS_CONCEPT"]);

function toNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (neo4j.isInt(v)) return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const env = await loadEnv(ENV_PATH);
  const uri = env.NEO4J_URI_YHOGA;
  const user = env.NEO4J_USERNAME_YHOGA;
  const password = env.NEO4J_PASSWORD_YHOGA;

  if (!uri || !user || !password) {
    throw new Error(
      `Missing NEO4J_*_YHOGA in ${ENV_PATH}. Cannot dump yhoga.`,
    );
  }

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session({ defaultAccessMode: neo4j.session.READ });

  try {
    console.log("Reading nodes…");
    const nodeRes = await session.run(`
      MATCH (n)
      RETURN elementId(n) AS id,
             labels(n)[0] AS label,
             n.name AS name,
             n.grade AS grade,
             coalesce(n.description, n.summary, '') AS description
    `);

    const nodes = nodeRes.records.map((r) => {
      const { kind, stub } = kindOf(r.get("label"));
      return {
        id: r.get("id"),
        name: r.get("name") ?? "(tanpa nama)",
        grade: r.get("grade") ?? "",
        description: r.get("description") ?? "",
        stub,
        kind,
      };
    });

    console.log("Reading relationships…");
    const relRes = await session.run(`
      MATCH (a)-[r]->(b)
      RETURN elementId(a) AS from,
             elementId(b) AS to,
             type(r) AS type,
             coalesce(r.description, '') AS description,
             r.confidence AS confidence
    `);

    const relationships = relRes.records.map((r, i) => {
      const type = r.get("type");
      return {
        id: `y${i}`,
        from: r.get("from"),
        to: r.get("to"),
        type,
        description: r.get("description") ?? "",
        confidence: toNumber(r.get("confidence")),
        crossBook: type.startsWith("LINTAS_BUKU"),
        structural: STRUCTURAL.has(type),
      };
    });

    await mkdir(OUT_DIR, { recursive: true });

    // Step 4 — the full graph, exactly as Neo4j Browser shows it.
    const step4 = { step: 4, label: "Final", source: "yhoga", nodes, relationships };
    await writeFile(join(OUT_DIR, "step4.json"), JSON.stringify(step4), "utf8");

    // Step 3 — completion: only LINTAS_BUKU edges + their endpoint nodes.
    const crossRels = relationships.filter((r) => r.crossBook);
    const keep = new Set();
    for (const r of crossRels) {
      keep.add(r.from);
      keep.add(r.to);
    }
    const step3 = {
      step: 3,
      label: "Completion",
      source: "yhoga",
      nodes: nodes.filter((n) => keep.has(n.id)),
      relationships: crossRels,
    };
    await writeFile(join(OUT_DIR, "step3.json"), JSON.stringify(step3), "utf8");

    const meta = {
      source: "yhoga",
      generatedFrom: "yhoga Neo4j (NEO4J_*_YHOGA)",
      steps: [
        {
          step: 3,
          key: "step3",
          label: "Completion",
          nodeCount: step3.nodes.length,
          relCount: step3.relationships.length,
          crossBookCount: crossRels.length,
        },
        {
          step: 4,
          key: "step4",
          label: "Final",
          nodeCount: nodes.length,
          relCount: relationships.length,
          crossBookCount: crossRels.length,
        },
      ],
    };
    await writeFile(join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

    console.log(
      `yhoga dump: ${nodes.length} nodes, ${relationships.length} rels ` +
        `(${crossRels.length} cross-book). Wrote step3.json, step4.json, meta.json`,
    );
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
