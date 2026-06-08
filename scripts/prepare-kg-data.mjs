// Prepare the public KG data for /explore.
//
// Copies the Neo4j exports from the thesis assets (ta-latex/assets/kg-from-neo4j)
// into public/kg-data/, stripping the per-node embedding vectors (3072-dim)
// that would otherwise bloat the client download (~23 MB -> ~0.25 MB).
//
// The source files are the authoritative export; this only slims them for the
// browser. Re-run with `npm run prepare:kg-data` after pulling new exports.
//
// Files (each is a raw Neo4j export):
//   {id, labels, props} nodes  +  {source, target, type, props} edges keyed by elementId

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");
const SRC = resolve(APP_ROOT, "..", "ta-latex", "assets", "kg-from-neo4j");
const OUT = join(APP_ROOT, "public", "kg-data");

const FILES = [
  "01-pre-kgc-nodes.json",
  "01-pre-kgc-edges.json",
  "02-post-kgc-nodes.json",
  "02-post-kgc-edges.json",
];

// Props that are useless to the browser and/or huge.
const DROP_PROPS = new Set(["embedding", "embedding_model"]);

function slimNode(n) {
  if (!n.props) return n;
  const props = {};
  for (const [k, v] of Object.entries(n.props)) {
    if (!DROP_PROPS.has(k)) props[k] = v;
  }
  return { id: n.id, labels: n.labels, props };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const file of FILES) {
    const raw = JSON.parse(await readFile(join(SRC, file), "utf8"));
    const out = file.includes("-nodes") ? raw.map(slimNode) : raw;
    const json = JSON.stringify(out);
    await writeFile(join(OUT, file), json, "utf8");
    console.log(`  ${file}: ${out.length} items, ${(json.length / 1024).toFixed(0)} KB`);
  }
  console.log(`Wrote ${FILES.length} files to public/kg-data/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
