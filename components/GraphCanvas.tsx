"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type NVL from "@neo4j-nvl/base";
import type { Node as NvlNode, Relationship as NvlRel } from "@neo4j-nvl/base";
import { InteractiveNvlWrapper } from "@neo4j-nvl/react";

export type GraphCanvasHandle = {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type GraphCanvasProps = {
  nodes: NvlNode[];
  rels: NvlRel[];
  layout: "forceDirected" | "hierarchical";
  controlsRef: MutableRefObject<GraphCanvasHandle | null>;
  onSelectNode: (id: string) => void;
  onSelectRel: (id: string) => void;
  onBackground: () => void;
};

export default function GraphCanvas({
  nodes,
  rels,
  layout,
  controlsRef,
  onSelectNode,
  onSelectRel,
  onBackground,
}: GraphCanvasProps) {
  const nvlRef = useRef<NVL | null>(null);

  useEffect(() => {
    controlsRef.current = {
      fit: () => {
        const nvl = nvlRef.current;
        if (!nvl) return;
        nvl.fit(nvl.getNodes().map((n) => n.id), {});
      },
      zoomIn: () => {
        const nvl = nvlRef.current;
        if (!nvl) return;
        nvl.setZoom((nvl.getScale?.() ?? 1) * 1.3);
      },
      zoomOut: () => {
        const nvl = nvlRef.current;
        if (!nvl) return;
        nvl.setZoom((nvl.getScale?.() ?? 1) / 1.3);
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);

  return (
    <InteractiveNvlWrapper
      ref={nvlRef}
      nodes={nodes}
      rels={rels}
      layout={layout}
      nvlOptions={{
        initialZoom: 0.75,
        minZoom: 0.05,
        maxZoom: 3,
      }}
      mouseEventCallbacks={{
        onNodeClick: (node) => onSelectNode(node.id),
        onRelationshipClick: (rel) => onSelectRel(rel.id),
        onCanvasClick: () => onBackground(),
        onPan: true,
        onZoom: true,
        onDrag: true,
      }}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
