# kg-review-app

A web app for expert review of an LLM-generated knowledge graph, built for the undergraduate thesis
*LLM-Assisted Knowledge Graph Completion for Mapping Interconnections Between Science Subjects
(Physics, Chemistry, Biology) in the Kurikulum Merdeka, Grade XII* (Universitas Indonesia, 2026).
The thesis source is in [`ta-latex`](https://github.com/tegar-wahyu/ta-latex).

Subject-matter experts rate the relations the pipeline extracted from the textbooks, and rate the
cross-book relations proposed during the completion step. A public page lets anyone explore the
final graph.

## What it does

| Route | Who | Purpose |
|---|---|---|
| `/explore` | Public | Interactive graph of the curriculum across pipeline stages (extraction, consensus, completion, final KG), rendered with Neo4j NVL |
| `/login` | Everyone | Sign-in for admins and experts |
| `/review` | Expert | Rate each extracted relation as correct, partial, wrong or missing, add comments, and propose missing triples |
| `/review/phase-2` | Expert | Validate cross-book relations: is the relation valid, is its type right, is its direction right |
| `/admin` | Admin | Upload course data, publish courses, assign experts, and review submitted ratings |

The cross-book survey definitions and data are in [`completion_survey/`](completion_survey/): five
relation types (`SAMA_DENGAN`, `PRASYARAT_UNTUK`, `APLIKASI_DARI`, `MEMPERDALAM`, `BERKAITAN_DENGAN`).

## Stack

- Next.js 15 (App Router), React 19, TypeScript
- Session auth with signed JWT cookies (`jose`), roles `admin` and `expert`
- Storage: Vercel KV (Upstash REST) when configured, in-memory fallback for local development
- Graph visualization with `@neo4j-nvl/react`; math rendering with KaTeX

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Configuration

Set these in `.env.local`:

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Secret used to sign session tokens |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Admin account |
| `EXPERT_<SUBJECT>_<N>_USERNAME`, `EXPERT_<SUBJECT>_<N>_PASSWORD` | Expert accounts (`KIMIA`, `FISIKA`, `BIOLOGI`, up to 6 each) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Optional. Persistent storage; without them data lives in memory and resets on restart |

The app falls back to built-in defaults for `AUTH_SECRET` and the admin account so it runs out of the box in
development. These defaults are public, so always set your own values before deploying.

### Explorer data

The `/explore` page reads slimmed Neo4j exports from `public/kg-data/`. To regenerate them from the
thesis exports (expects the `ta-latex` repo next to this one):

```bash
npm run prepare:kg-data
```

The script strips the 3072-dimension embedding vectors, which shrinks the download from about 23 MB
to about 0.25 MB.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint |
| `npm run prepare:kg-data` | Rebuild the explorer data |
