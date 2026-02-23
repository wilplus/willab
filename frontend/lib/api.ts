/**
 * Typed wrappers for homework API (proxied via Next.js BFF to backend).
 */
import { getAccessToken } from "./supabase";

const API_BASE = "/api/homework";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  const headers: HeadersInit = {
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
}

export type HomeworkStatus = {
  step: "landing" | "recording" | "processing" | "report";
  session_id: string | null;
  status: string | null;
  exercise: { id: string; name: string; description: string } | null;
};

export async function getStatus(): Promise<HomeworkStatus> {
  const res = await fetchWithAuth(`${API_BASE}/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type StartResponse = {
  session_id: string;
  step: string;
  exercise: { id: string; name: string; description: string } | null;
};

export async function startHomework(recommendedExerciseId?: string): Promise<StartResponse> {
  const res = await fetchWithAuth(`${API_BASE}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recommended_exercise_id: recommendedExerciseId ?? undefined }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type ReportResponse = {
  score: number;
  summary: string;
  coach_reminder: string;
  coach_feedback_text?: string;
};

export async function getReport(): Promise<ReportResponse> {
  const res = await fetchWithAuth(`${API_BASE}/report`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type FinalizeResponse = {
  step: string;
  score: number;
  summary: string;
  coach_reminder: string;
};

export type LiveMetrics = {
  transcript_segment: string;
  wpm: number;
  voice_strength: number;
  filler_count: number;
};

export async function sendStreamChunk(
  sessionId: string,
  audioBase64: string,
  sequenceIndex: number,
  durationSeconds: number
): Promise<LiveMetrics> {
  const res = await fetchWithAuth(`${API_BASE}/recordings/stream-chunk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      sequence_index: sequenceIndex,
      audio_base64: audioBase64,
      duration_seconds: durationSeconds,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function finalizeRecording(audioBase64: string, durationSeconds: number): Promise<FinalizeResponse> {
  const res = await fetchWithAuth(`${API_BASE}/recordings/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_base64: audioBase64, duration_seconds: durationSeconds }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
