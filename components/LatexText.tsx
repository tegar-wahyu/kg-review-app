"use client";

import { useEffect, useRef, type RefObject } from "react";
import renderMathInElement from "katex/contrib/auto-render";

type LatexTextProps = {
  as?: "div" | "span";
  className?: string;
  text: string;
};

function looksLikeDelimitedMath(text: string) {
  return /(\$\$[\s\S]*\$\$)|(\$[^$]+\$)|(\\\([\s\S]*\\\))|(\\\[[\s\S]*\\\])/.test(text);
}

const greekMap: Array<[string, string]> = [
  ["α", "\\alpha"],
  ["β", "\\beta"],
  ["γ", "\\gamma"],
  ["δ", "\\delta"],
  ["Δ", "\\Delta"],
  ["θ", "\\theta"],
  ["λ", "\\lambda"],
  ["μ", "\\mu"],
  ["π", "\\pi"],
  ["σ", "\\sigma"],
  ["φ", "\\phi"],
  ["ω", "\\omega"],
];

function normalizeSqrt(expression: string) {
  return expression
    .replace(/√\s*\(([^()]+)\)/g, "\\sqrt{$1}")
    .replace(/\bsqrt\s*\(([^()]+)\)/gi, "\\sqrt{$1}");
}

function normalizeFractions(expression: string) {
  let normalized = expression;

  for (let index = 0; index < 4; index += 1) {
    const next = normalized
      .replace(/\(([^()]+)\)\s*\/\s*([A-Za-z0-9_{}^\\]+)/g, "\\frac{$1}{$2}")
      .replace(/([A-Za-z0-9_{}^\\]+)\s*\/\s*\(([^()]+)\)/g, "\\frac{$1}{$2}")
      .replace(/([A-Za-z0-9_{}^\\]+)\s*\/\s*([A-Za-z0-9_{}^\\]+)/g, "\\frac{$1}{$2}");

    if (next === normalized) break;
    normalized = next;
  }

  return normalized;
}

function normalizeMathExpression(expression: string) {
  let normalized = expression;

  greekMap.forEach(([symbol, latex]) => {
    normalized = normalized.replaceAll(symbol, latex);
  });

  normalized = normalizeSqrt(normalized)
    .replace(/\b(sin|cos|tan|cot|sec|csc)\b/gi, (_, fn: string) => `\\${fn.toLowerCase()}`)
    .replace(/\b([A-Za-z]+)(\d+)\b/g, "$1_$2")
    .replace(/\b([A-Za-z]+)_([A-Za-z0-9]+)\b/g, "$1_{$2}")
    .replace(/([A-Za-z0-9}])\^([A-Za-z0-9]+)/g, "$1^{$2}")
    .replace(/\*/g, " \\cdot ")
    .replace(/×/g, " \\times ")
    .replace(/÷/g, " \\div ");

  normalized = normalizeFractions(normalized);

  return normalized;
}

function trimTrailingNarration(expression: string) {
  const stopMarkers = [
    " ketika ",
    " di mana ",
    " dimana ",
    " saat ",
    " jika ",
    " bila ",
    " dengan ",
    " untuk ",
    " karena ",
    " sehingga ",
  ];

  let endIndex = expression.length;

  stopMarkers.forEach((marker) => {
    const index = expression.toLowerCase().indexOf(marker);
    if (index !== -1) {
      endIndex = Math.min(endIndex, index);
    }
  });

  return expression.slice(0, endIndex).trim();
}

function addHeuristicMathDelimiters(text: string) {
  if (!text || looksLikeDelimitedMath(text)) return text;

  return text.replace(
    /\b([A-Za-z][A-Za-z0-9_]*\s*=\s*[^,;:.]+(?:\^[0-9]+)?(?:\s*[*/+\-]\s*[^,;:.]+)*)/g,
    (match) => {
      const trimmedMath = trimTrailingNarration(match.trim());
      const trailingText = match.slice(trimmedMath.length);

      if (!trimmedMath.includes("=")) return match;

      return `$${normalizeMathExpression(trimmedMath)}$${trailingText}`;
    },
  );
}

export default function LatexText({ as = "span", className, text }: LatexTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const preparedText = addHeuristicMathDelimiters(text);

  useEffect(() => {
    if (!ref.current) return;

    renderMathInElement(ref.current, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
      strict: "ignore",
    });
  }, [preparedText]);

  if (as === "div") {
    return (
      <div ref={ref as RefObject<HTMLDivElement>} className={className}>
        {preparedText}
      </div>
    );
  }

  return (
    <span ref={ref as RefObject<HTMLSpanElement>} className={className}>
      {preparedText}
    </span>
  );
}
