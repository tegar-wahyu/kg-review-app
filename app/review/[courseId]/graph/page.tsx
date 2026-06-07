import path from "path";
import fs from "fs";
import { extractTriples } from "@/lib/extract";
import { getCourseById } from "@/lib/storage";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function GraphPage({ params }: { params: Promise<{ courseId: string }> }) {
  // Next 15 provides route params as a promise.
  const resolvedParams = await params;
  let { courseId } = resolvedParams;
  // route params may be URL-encoded; decode to match filenames on disk
  try {
    courseId = decodeURIComponent(courseId);
  } catch {
    // ignore decode errors and use raw value
  }
  // allow requests like /.../Biologi Kelas XII.json/graph -> strip .json suffix
  if (courseId.endsWith(".json")) courseId = courseId.slice(0, -5);

  // Look for a matching JSON file inside the repo /kg folder
  const kgDir = path.join(process.cwd(), "kg");

  let files: string[] = [];
  try {
    files = await fs.promises.readdir(kgDir);
  } catch {
    return (
      <main className="page-wrap">Folder <strong>/kg</strong> tidak ditemukan. Pastikan file KG tersedia.</main>
    );
  }

  // Prefer consensus file if present (basename.consensus.json), otherwise fall back to regular JSON
  let match: string | undefined;
  const requestedSlug = slugify(courseId);
  const fileBase = (file: string) => path.parse(file).name.replace(/\.consensus$/, "");
  // first try exact consensus match
  match = files.find((f) => f.endsWith(".consensus.json") && slugify(fileBase(f)) === requestedSlug);
  if (!match) {
    // try a plain .json match
    match = files.find((f) => slugify(fileBase(f)) === requestedSlug);
  }

  if (!match) {
    const course = await getCourseById(courseId);
    if (!course) {
      return (
        <main className="page-wrap">Tidak menemukan KG untuk <strong>{courseId}</strong> di folder <strong>/kg</strong>.</main>
      );
    }

    const triples = extractTriples(course.payload);
    const KGViewer = (await import("@/components/KGViewer")).default;
    return <KGViewer initialTriples={triples} datasetTitle={course.title} />;
  }

  try {
    const content = await fs.promises.readFile(path.join(kgDir, match), "utf8");
    const payload = JSON.parse(content);
    const basename = path.parse(match).name;
    const datasetTitle = !Array.isArray(payload) && typeof payload?.grade === "string" && payload.grade.trim()
      ? payload.grade.trim()
      : basename;

    if (match.endsWith(".consensus.json")) {
      // load a consensus-mode viewer that preserves structure
      const ConsensusKGViewer = (await import("@/components/ConsensusKGViewer")).default;
      return <ConsensusKGViewer payload={payload} datasetTitle={datasetTitle} />;
    }

    const triples = extractTriples(payload);
    const KGViewer = (await import("@/components/KGViewer")).default;
    return <KGViewer initialTriples={triples} datasetTitle={datasetTitle} />;
  } catch (err) {
    return <main className="page-wrap">Gagal memuat file KG: {String(err)}</main>;
  }
}
