import type { Metadata } from "next";
import "./explore.css";
import KgExplorer from "@/components/KgExplorer";

export const metadata: Metadata = {
  title: "Peta Pengetahuan Kurikulum — Eksplorasi Publik",
  description:
    "Visualisasi interaktif knowledge graph kurikulum (Biologi, Fisika, Kimia Kelas XII) lintas tahap pipeline: ekstraksi, konsensus, completion, dan KG final.",
};

export default function ExplorePage() {
  return <KgExplorer />;
}
