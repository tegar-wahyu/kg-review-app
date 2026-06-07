"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExtractedTriple } from "@/lib/types";

export default function KGViewer({
  initialTriples,
  datasetTitle,
}: {
  initialTriples: ExtractedTriple[];
  datasetTitle?: string;
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filterChapter, setFilterChapter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  const cyContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<any>(null);

  const chapters = useMemo(() => {
    const set = new Set<string>();
    initialTriples.forEach((t) => set.add(t.chapter || "Tanpa Kategori"));
    return Array.from(set);
  }, [initialTriples]);

  const triples = useMemo(() => {
    return initialTriples.filter((t) => (filterChapter === "all" ? true : (t.chapter || "Tanpa Kategori") === filterChapter));
  }, [initialTriples, filterChapter]);

  const nodes = useMemo(() => {
    const map = new Map<string, { name: string; glossary_validated: boolean }>();
    triples.forEach((t) => {
      if (!map.has(t.subject)) map.set(t.subject, { name: t.subject, glossary_validated: !!t.glossary_validated });
      if (!map.has(t.target)) map.set(t.target, { name: t.target, glossary_validated: !!t.glossary_validated });
    });
    return Array.from(map.values());
  }, [triples]);

  const edges = useMemo(() => {
    return triples.map((t, idx) => ({ id: idx, source: t.subject, target: t.target, relation: t.relation, description: t.description }));
  }, [triples]);

  // Initialize Cytoscape in the browser
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!cyContainerRef.current) return;
      const cytoscapeModule = await import("cytoscape");
      const cytoscape = cytoscapeModule.default || cytoscapeModule;

      // build elements
      const elements: any[] = [];
      nodes.forEach((n) => elements.push({ data: { id: n.name, label: n.name, glossary_validated: n.glossary_validated } }));
      edges.forEach((e) => elements.push({ data: { id: `e${e.id}`, source: e.source, target: e.target, relation: e.relation, description: e.description } }));

      if (cancelled) return;

      // destroy previous instance
      if (cyRef.current) {
        try {
          cyRef.current.destroy();
        } catch {
          // ignore
        }
        cyRef.current = null;
      }

      const cy = cytoscape({
        container: cyContainerRef.current,
        elements,
        style: ([
          {
            selector: "node",
            style: {
              label: "data(label)",
              "text-wrap": "wrap",
              "text-max-width": 120,
              "background-color": "#fff",
              "border-width": 1,
              "border-color": "#d1d5db",
              "width": 60,
              "height": 60,
              "font-size": 11,
            },
          },
          {
            selector: "edge",
            style: {
              width: 1,
              "line-color": "#c7d2fe",
              "target-arrow-color": "#c7d2fe",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              "font-size": 10,
            },
          },
          { selector: ".selected", style: { "border-color": "#3b82f6", "border-width": 3 } },
          { selector: ".neighbor", style: { "background-color": "#eff6ff" } },
          { selector: ".dim", style: { opacity: 0.25 } },
        ] as any),
        layout: {
          name: "cose",
          idealEdgeLength: 80,
          nodeOverlap: 8,
          refresh: 20,
          randomize: true,
          fit: true,
        },
      });

      cy.on("tap", (evt: any) => {
        if (evt.target === cy) {
          setSelectedNode(null);
        }
      });

      cy.on("tap", "node", (evt: any) => {
        const node = evt.target;
        setSelectedNode(node.id());
      });

      cyRef.current = cy;
    };

    init();

    return () => {
      cancelled = true;
      if (cyRef.current) {
        try {
          cyRef.current.destroy();
        } catch {}
        cyRef.current = null;
      }
    };
  }, [nodes, edges]);

  // Update highlight classes when selection changes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("selected neighbor dim");
    if (!selectedNode) {
      cy.elements().removeClass("dim");
      return;
    }

    const node = cy.$(`#${CSS.escape(selectedNode)}`);
    if (!node || node.empty()) return;
    node.addClass("selected");
    const neigh = node.closedNeighborhood();
    neigh.forEach((el: any) => el.addClass("neighbor"));
    cy.elements().difference(neigh).not(node).addClass("dim");
  }, [selectedNode]);

  const filteredNodeCount = nodes.filter((n) => n.name.toLowerCase().includes(search.toLowerCase())).length;

  return (
    <main className="page-wrap">
      <div className="header">
        <h1>{datasetTitle || "KG Viewer"}</h1>
        <p className="muted">Viewer prototipe — sumber data: /kg (read-only) • Neo4j-like (Cytoscape)</p>
      </div>

      <div className="graph-controls">
        <label>
          Bab:&nbsp;
          <select value={filterChapter} onChange={(e) => setFilterChapter(e.target.value)}>
            <option value="all">Semua bab</option>
            {chapters.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label style={{ marginLeft: 12 }}>
          Cari:&nbsp;
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari node..." />
        </label>

        <div style={{ marginLeft: 'auto' }}>
          <strong>{filteredNodeCount}</strong> node • <strong>{edges.length}</strong> relasi
        </div>
      </div>

      <div className="graph-wrap">
        <div className="graph-canvas" role="application" aria-label="Graph canvas">
          <div ref={cyContainerRef} id="cy" className="cy-container" style={{ width: '100%', height: 520 }} />
        </div>

        <aside className="detail-panel" aria-live="polite">
          {selectedNode ? (
            <div>
              <h3>Node:</h3>
              <h2 style={{ marginTop: 0 }}>{selectedNode}</h2>

              <h4>Tetangga</h4>
              <ul>
                {(() => {
                  const cy = cyRef.current;
                  if (!cy) return null;
                  const node = cy.$(`#${CSS.escape(selectedNode)}`);
                  if (!node || node.empty()) return <li>Tidak ada tetangga.</li>;
                  const neighborIds = Array.from(node.neighborhood().nodes().map((n: any) => String(n.id()))) as string[];
                  return neighborIds.map((nId) => (
                    <li key={nId}>
                      <button className="link-like" onClick={() => setSelectedNode(nId)}>{nId}</button>
                    </li>
                  ));
                })()}
              </ul>

              <h4>Relasi masuk/keluar</h4>
              <ul>
                {edges.filter((e) => e.source === selectedNode || e.target === selectedNode).map((e) => (
                  <li key={e.id}>
                    <strong>{e.source}</strong> — <em>{e.relation}</em> → <strong>{e.target}</strong>
                    {e.description ? <div className="muted small">{e.description}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <h3>Petunjuk</h3>
              <p>Pilih sebuah node pada grafik untuk melihat tetangga dan relasi. Gunakan filter bab atau pencarian untuk mempersempit tampilan.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
