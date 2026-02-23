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

export type HomeworkStep = "landing" | "recording" | "processing" | "report";

export type HomeworkStatus = {
  step: HomeworkStep;
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
  step: HomeworkStep;
  exercise: { id: string; name: string; description: string } | null;
};

const HOMEWORK_STEPS: HomeworkStep[] = ["landing", "recording", "processing", "report"];

function parseStartResponse(raw: unknown): StartResponse {
  if (!raw || typeof raw !== "object") throw new Error("Invalid start response");
  const o = raw as Record<string, unknown>;
  const session_id = typeof o.session_id === "string" ? o.session_id : "";
  const stepVal = o.step;
  if (typeof stepVal !== "string" || !HOMEWORK_STEPS.includes(stepVal as HomeworkStep)) {
    throw new Error("Invalid step in start response");
  }
  const step: HomeworkStep = stepVal as HomeworkStep;
  let exercise: { id: string; name: string; description: string } | null = null;
  if (o.exercise != null && typeof o.exercise === "object") {
    const ex = o.exercise as Record<string, unknown>;
    if (typeof ex.id === "string" && typeof ex.name === "string") {
      exercise = {
        id: ex.id,
        name: ex.name,
        description: typeof ex.description === "string" ? ex.description : "",
      };
    }
  }
  return { session_id, step, exercise };
}

export async function startHomework(recommendedExerciseId?: string): Promise<StartResponse> {
  const res = await fetchWithAuth(`${API_BASE}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recommended_exercise_id: recommendedExerciseId ?? undefined }),
  });
  if (!res.ok) throw new Error(await res.text());
  const raw = await res.json();
  return parseStartResponse(raw);
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
