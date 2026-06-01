import { readFile } from "fs/promises";
import path from "path";
import { CompletionSurveyItem } from "@/lib/types";

const SURVEY_PATH = path.join(process.cwd(), "completion_survey", "lintas_buku_survey.csv");

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0] || "");

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

export async function getCompletionSurveyItems(): Promise<CompletionSurveyItem[]> {
  const content = await readFile(SURVEY_PATH, "utf8");
  const rows = parseCsv(content);

  return rows.map((row) => ({
    id: row.id,
    pair: row.pasangan_mapel,
    conceptA: row.konsep_A,
    subjectA: row.mapel_A,
    proposedRelation: row.relasi_diusulkan,
    conceptB: row.konsep_B,
    subjectB: row.mapel_B,
    explanation: row.penjelasan_LLM,
  }));
}
