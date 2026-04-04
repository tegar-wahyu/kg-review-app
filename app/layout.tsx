import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "Tinjauan Graf Pengetahuan",
  description: "Alur review oleh expert dengan pengelolaan mata pelajaran oleh admin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html lang="id"><body>{children}</body></html>;
}
