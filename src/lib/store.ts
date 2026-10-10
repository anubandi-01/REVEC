import type { AnalysisResult, FeedbackRow } from "./analysis-core";

// Demo mode: analyses live in this browser only (localStorage).
export interface StoredAnalysis {
  id: string;
  filename: string;
  excluded: number;
  created_at?: string;
  rows: FeedbackRow[];
  result: AnalysisResult;
}

const KEY = (id: string) => `revec:analysis:${id}`;

export function saveAnalysis(a: StoredAnalysis) {
  try {
    localStorage.setItem(KEY(a.id), JSON.stringify(a));
  } catch {
    sessionStorage.setItem(KEY(a.id), JSON.stringify(a));
  }
}

export function loadAnalysis(id: string): StoredAnalysis | null {
  const raw = localStorage.getItem(KEY(id)) ?? sessionStorage.getItem(KEY(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAnalysis;
  } catch {
    return null;
  }
}

export function deleteAnalysis(id: string) {
  localStorage.removeItem(KEY(id));
  sessionStorage.removeItem(KEY(id));
}
