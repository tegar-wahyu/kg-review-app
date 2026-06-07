"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChapterNode, CoursePayload } from "@/lib/types";

function safeId(...parts: string[]) {
  return parts.map((p) => String(p).replace(/\s+/g, "_")).join("::");
}

function displayLabel(text: string, maxLength = 20) {
  const value = String(text || "").trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function collectNeighborhood(node: any, hops: number) {
  const cy = node.cy();
  const visitedNodes = new Set<string>([node.id()]);
  const visitedEdges = new Set<string>();

  let frontier: any[] = [node];

  for (let depth = 0; depth < hops; depth += 1) {
    const nextFrontier: any[] = [];

    frontier.forEach((currentNode) => {
      currentNode.connectedEdges().forEach((edge: any) => {
        visitedEdges.add(edge.id());
        edge.connectedNodes().forEach((neighbor: any) => {
          if (!visitedNodes.has(neighbor.id())) {
            visitedNodes.add(neighbor.id());
            nextFrontier.push(neighbor);
          }
        });
      });
    });

    frontier = nextFrontier;
  }

  const elements = [
    ...Array.from(visitedNodes)
      .map((id) => cy.$id(id))
      .filter((ele: any) => ele && !ele.empty()),
    ...Array.from(visitedEdges)
      .map((id) => cy.$id(id))
      .filter((ele: any) => ele && !ele.empty()),
  ];

  return cy.collection(elements);
}

export default function ConsensusKGViewer({ payload, datasetTitle }: { payload: CoursePayload; datasetTitle?: string }) {
  const [showStructure, setShowStructure] = useState(false);
  const [showRelationLabels, setShowRelationLabels] = useState(false);
  const [focusSelectedNode, setFocusSelectedNode] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const cyRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Normalize chapters like extract.normalizeChapters
  const chapters = useMemo(() => {
    if (Array.isArray(payload)) return payload as ChapterNode[];
    if (Array.isArray((payload as any)?.chapters)) return (payload as any).chapters as ChapterNode[];
    return [payload as ChapterNode];
  }, [payload]);

  // Collect known concept names
  const knownConcepts = useMemo(() => {
    const set = new Set<string>();
    chapters.forEach((ch) => {
      (ch.subtopics || []).forEach((st) => {
        (st.concepts || []).forEach((c) => {
          if (c?.name) set.add(String(c.name));
        });
      });
    });
    return set;
  }, [chapters]);

  // Build cytoscape elements following the notebook ingest pass logic
  const elements = useMemo(() => {
    const elems: any[] = [];

    const grade = (payload as any).grade || datasetTitle || "grade";
    const gradeId = safeId("grade", grade);
    elems.push({ data: { id: gradeId, label: grade, displayLabel: displayLabel(grade), kind: "Grade", grade } });

    chapters.forEach((chapter) => {
      const chapterName = chapter.chapter || "";
      if (!chapterName) return;
      const chapId = safeId("chapter", grade, chapterName);
      elems.push({ data: { id: chapId, label: chapterName, displayLabel: displayLabel(chapterName), kind: "Chapter", grade, chapter: chapterName } });
      elems.push({ data: { id: safeId("edge", gradeId, chapId), source: gradeId, target: chapId, rel: "HAS_CHAPTER", kind: "structure" } });

      (chapter.subtopics || []).forEach((subtopic) => {
        const subName = subtopic.name || "";
        if (!subName) return;
        const subId = safeId("subtopic", grade, chapterName, subName);
        elems.push({ data: { id: subId, label: subName, displayLabel: displayLabel(subName), kind: "Subtopic", grade, chapter: chapterName, subtopic: subName } });
        elems.push({ data: { id: safeId("edge", chapId, subId), source: chapId, target: subId, rel: "HAS_SUBTOPIC", kind: "structure" } });

        (subtopic.concepts || []).forEach((concept) => {
          const cname = concept.name || "";
          if (!cname) return;
          const conceptId = safeId("concept", grade, cname);
          elems.push({ data: { id: conceptId, label: cname, displayLabel: displayLabel(cname), kind: "Concept", grade, chapter: chapterName, subtopic: subName, glossary_validated: !!concept.glossary_validated, description: concept.description || "" } });
          elems.push({ data: { id: safeId("edge", subId, conceptId), source: subId, target: conceptId, rel: "HAS_CONCEPT", kind: "structure" } });

          (concept.relations || []).forEach((rel, idx) => {
            const relType = rel?.type || "RELATED_TO";
            const targetRaw = rel?.target || rel?.target_concept || "";
            if (!targetRaw) return;
            const targetName = String(targetRaw);
            let targetId: string;
            if (knownConcepts.has(targetName)) {
              targetId = safeId("concept", grade, targetName);
            } else {
              // concept target node
              targetId = safeId("target", grade, targetName);
              // add target node if not already present
              if (!elems.find((e) => e.data.id === targetId)) {
                elems.push({ data: { id: targetId, label: targetName, displayLabel: displayLabel(targetName), kind: "ConceptTarget", grade, description: "" } });
              }
            }

            elems.push({ data: { id: safeId("rel", conceptId, targetId, String(idx)), source: conceptId, target: targetId, rel: relType, description: rel?.description || "", kind: "semantic" } });
          });
        });
      });
    });

    return elems;
  }, [chapters, payload, datasetTitle, knownConcepts]);

  // Initialize cytoscape
  useEffect(() => {
    let cancelled = false;
    let cy: any = null;

    const init = async () => {
      if (!containerRef.current) return;
      const cytoscapeModule = await import("cytoscape");
      const cytoscape = cytoscapeModule.default || cytoscapeModule;

      if (cancelled) return;

      if (cyRef.current) {
        try { cyRef.current.destroy(); } catch {}
        cyRef.current = null;
      }

      cy = cytoscape({ container: containerRef.current, elements, wheelSensitivity: 0.18, minZoom: 0.08, maxZoom: 3.5, style: ([
        { selector: "node", style: { "label": "data(displayLabel)", "text-wrap": "wrap", "text-max-width": 86, "text-valign": "center", "text-halign": "center", "font-size": 10, "font-weight": 700, "color": "#111827", "text-outline-width": 0, "border-width": 1.8, "overlay-opacity": 0, "transition-property": "background-color, border-color, opacity", "transition-duration": 160 } },
        { selector: "node[kind = 'Grade']", style: { "background-color": "#5b8fd9", "border-color": "#9bbdf0", "shape": "round-diamond", "width": 88, "height": 88, "font-size": 11, "color": "#ffffff", "text-outline-color": "#244d87", "text-outline-width": 1.4 } },
        { selector: "node[kind = 'Chapter']", style: { "background-color": "#d88ea7", "border-color": "#ffc1d1", "width": 80, "height": 80 } },
        { selector: "node[kind = 'Subtopic']", style: { "background-color": "#b7c247", "border-color": "#eef37f", "width": 70, "height": 70 } },
        { selector: "node[kind = 'Concept']", style: { "background-color": "#f0b429", "border-color": "#ffd86b", "width": 62, "height": 62, "text-max-width": 76, "font-size": 9.5 } },
        { selector: "node[kind = 'ConceptTarget']", style: { "background-color": "#f0b429", "border-color": "#ffd86b", "width": 64, "height": 64, "text-max-width": 78, "font-size": 9.5 } },
        // structure edges are intentionally hidden by default to reduce clutter
        { selector: "edge[kind = 'structure']", style: { "line-color": "#8e99a8", "target-arrow-color": "#8e99a8", "width": 1.2, "curve-style": "bezier", "edge-distances": "node-position", "control-point-step-size": 28, "label": "", "events": "yes", "opacity": 0.34, "display": "none" } },
        { selector: "edge[kind = 'semantic']", style: { "line-color": "#b6c0cf", "width": 1.35, "target-arrow-shape": "triangle", "target-arrow-color": "#b6c0cf", "arrow-scale": 0.75, "curve-style": "bezier", "edge-distances": "node-position", "control-point-step-size": 36, "label": "", "font-size": 8, "text-rotation": "autorotate", "text-margin-y": -14, "text-background-color": "#050505", "text-background-opacity": 0.86, "text-background-padding": "3px", "color": "#f8fafc", "text-outline-color": "#050505", "text-outline-width": 2, "events": "yes", "opacity": 0.78 } },
        // selection visuals
        { selector: ":selected", style: { "background-color": "#2f80ed", "border-color": "#ffffff", "border-width": 3, "line-color": "#ffffff", "target-arrow-color": "#ffffff", "source-arrow-color": "#ffffff", "z-index": 20 } },
        { selector: ".search-faded", style: { opacity: 0.12 } },
        { selector: ".focus-dim", style: { opacity: 0.08 } },
        { selector: ".focus-neighbor", style: { opacity: 1 } },
        { selector: ".focus-hidden", style: { display: "none" } }
      ] as any), layout: { name: "cose", idealEdgeLength: 165, nodeRepulsion: 56000, nodeOverlap: 86, nodeDimensionsIncludeLabels: true, avoidOverlap: true, gravity: 0.045, componentSpacing: 150, edgeElasticity: 0.16, nestingFactor: 1.1, spacingFactor: 1.22, refresh: 30, randomize: false, fit: true, padding: 36, animate: true, animationDuration: 350 }});

      cy.on("tap", (evt: any) => {
        if (evt.target === cy) {
          setSelected(null);
        }
      });

      cy.on("tap", "node", (evt: any) => {
        const n = evt.target;
        const data = n.data();
        // gather neighbors and incident edges
        const neigh = n.neighborhood().nodes().map((nn: any) => ({ id: nn.id(), label: nn.data("label"), kind: nn.data("kind") }));
        const incident = n.connectedEdges().map((e: any) => {
          const sourceNode = cy.$id(e.data("source"));
          const targetNode = cy.$id(e.data("target"));
          return {
            id: e.id(),
            source: e.data("source"),
            target: e.data("target"),
            sourceLabel: sourceNode && !sourceNode.empty() ? sourceNode.data("label") : e.data("source"),
            targetLabel: targetNode && !targetNode.empty() ? targetNode.data("label") : e.data("target"),
            rel: e.data("rel"),
            description: e.data("description"),
            kind: e.data("kind"),
          };
        });
        setSelected({ type: "node", id: n.id(), data, neighbors: neigh, edges: incident });

        // keep the selected node centered and gently fit its local neighborhood
        try {
          const neighborhood = collectNeighborhood(n, 2);
          cy.animate(
            {
              center: { eles: n },
              fit: { eles: neighborhood, padding: 120 },
            },
            { duration: 350 },
          );
        } catch {
          try {
            cy.center(n);
          } catch {
            // ignore
          }
        }
      });

      cy.on("tap", "edge", (evt: any) => {
        const e = evt.target;
        const data = e.data();
        const sourceNode = cy.$id(data.source);
        const targetNode = cy.$id(data.target);
        setSelected({
          type: "edge",
          id: e.id(),
          data,
          source: data.source,
          target: data.target,
          sourceLabel: sourceNode && !sourceNode.empty() ? sourceNode.data("label") : data.source,
          targetLabel: targetNode && !targetNode.empty() ? targetNode.data("label") : data.target,
        });
      });

      cyRef.current = cy;
    };

    init();

    return () => {
      cancelled = true;
      if (cyRef.current) {
        try { cyRef.current.destroy(); } catch {}
        cyRef.current = null;
      }
    };
  }, [elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("search-faded focus-dim focus-neighbor focus-hidden");

    const q = search.toLowerCase();
    if (search.trim()) {
      cy.nodes().forEach((n: any) => {
        const label = (n.data("label") || "").toLowerCase();
        if (!label.includes(q)) n.addClass("search-faded");
      });
    }

    if (focusSelectedNode && selected?.type === "node") {
      const selectedNode = cy.$id(selected.id);
      if (selectedNode && !selectedNode.empty()) {
        const neighborhood = collectNeighborhood(selectedNode, 2);
        neighborhood.addClass("focus-neighbor");
        cy.elements().difference(neighborhood).addClass("focus-hidden");
      }
    }
  }, [search, selected, focusSelectedNode]);

  // Show/hide structure edges when toggled
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    try {
      const structureEdges = cy.edges("[kind = 'structure']");
      if (showStructure) {
        structureEdges.style({ display: 'element' });
      } else {
        structureEdges.style({ display: 'none' });
      }
    } catch {
      // ignore
    }
  }, [showStructure]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    try {
      cy.edges("[kind = 'semantic']").style({ label: showRelationLabels ? "data(rel)" : "" });
    } catch {
      // ignore
    }
  }, [showRelationLabels]);

  const fitGraph = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ fit: { eles: cy.elements(":visible"), padding: 42 } }, { duration: 250 });
  };

  const relayoutGraph = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.layout({
      name: "cose",
      idealEdgeLength: 165,
      nodeRepulsion: 56000,
      nodeOverlap: 86,
      nodeDimensionsIncludeLabels: true,
      avoidOverlap: true,
      gravity: 0.045,
      componentSpacing: 150,
      edgeElasticity: 0.16,
      nestingFactor: 1.1,
      spacingFactor: 1.22,
      refresh: 30,
      randomize: true,
      fit: true,
      padding: 36,
      animate: true,
      animationDuration: 420,
    }).run();
  };

  return (
    <main className="page-wrap graph-page">
      <div className="header">
        <h1>{datasetTitle || "Consensus KG Viewer"}</h1>
        <p className="muted">Consensus ingest preview — rendered client-side with Cytoscape</p>
      </div>

      <div className="graph-controls">
        <label>
          <input type="checkbox" checked={showStructure} onChange={(e) => setShowStructure(e.target.checked)} /> Show structure edges
        </label>
        <label style={{ marginLeft: 12 }}>
          <input type="checkbox" checked={showRelationLabels} onChange={(e) => setShowRelationLabels(e.target.checked)} /> Show relation labels
        </label>
        <label style={{ marginLeft: 12 }}>
          <input type="checkbox" checked={focusSelectedNode} onChange={(e) => setFocusSelectedNode(e.target.checked)} /> Focus selected node
        </label>
        <label style={{ marginLeft: 12 }}>Cari:&nbsp;<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari node..." /></label>
        <button className="btn-outline graph-tool-button" type="button" onClick={fitGraph}>Fit</button>
        <button className="btn-outline graph-tool-button" type="button" onClick={relayoutGraph}>Re-layout</button>
        <div style={{ marginLeft: 'auto' }}>
          <strong>{elements.filter((e) => e.data.kind === 'Concept').length}</strong> concepts • <strong>{elements.filter((e) => e.data.kind === 'semantic').length}</strong> semantic rel
        </div>
      </div>

      <div className="graph-wrap">
        <div className="graph-canvas" role="application" aria-label="Consensus graph canvas">
          <div ref={containerRef} className="cy-container" style={{ width: '100%', height: 640 }} />
        </div>

        <aside className="detail-panel">
          {selected ? (
            selected.type === "node" ? (
              <div>
                <h3>Node</h3>
                <h2 style={{ marginTop: 0 }}>{selected.data.label}</h2>
                <div className="muted small">Type: {selected.data.kind}</div>
                {selected.data.description ? <p>{selected.data.description}</p> : null}
                {focusSelectedNode ? <p className="muted small">Focus mode is on: only this node and its neighborhood stay emphasized.</p> : null}

                <h4>Tetangga ({selected.neighbors.length})</h4>
                <ul>
                  {selected.neighbors.map((n: any) => (
                    <li key={n.id}>
                      <button className="link-like" onClick={() => {
                        const cy = cyRef.current;
                        if (cy) {
                          const node = cy.$id(n.id);
                          if (node && !node.empty()) {
                            node.trigger('tap');
                          }
                        }
                      }}>{n.label}</button>
                      <span className="muted"> — {n.kind}</span>
                    </li>
                  ))}
                </ul>

                <h4>Relasi (incident)</h4>
                <ul>
                  {selected.edges.map((e: any) => (
                    <li key={e.id}>
                      <strong>{e.sourceLabel}</strong> — <em>{e.rel}</em> → <strong>{e.targetLabel}</strong>
                      {e.description ? <div className="muted small">{e.description}</div> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <h3>Edge</h3>
                <p><strong>Relation:</strong> {selected.data.rel}</p>
                <p><strong>From:</strong> {selected.sourceLabel}</p>
                <p><strong>To:</strong> {selected.targetLabel}</p>
                {selected.data.description ? <div className="muted small">{selected.data.description}</div> : null}
              </div>
            )
          ) : (
            <div>
              <h3>Petunjuk</h3>
              <p>Gunakan checkbox untuk menyembunyikan/show struktur dan semantic edges. Klik node untuk melihat label dan hubungannya.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
