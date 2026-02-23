import { getAccessToken } from "./supabase";

const API_BASE = "/api/admin";

export type Student = { id: string; email?: string | null };

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  const headers: HeadersInit = {
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
}

export type SendHomeworkResponse = { session_id: string; sent: boolean; warning?: string };

export async function sendHomework(body: { student_id: string; task_1_id: string; exercise_id?: string }): Promise<SendHomeworkResponse> {
  const res = await fetchWithAuth(`${API_BASE}/send-homework`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStudents(limit = 200): Promise<Student[]> {
  const res = await fetchWithAuth(`${API_BASE}/students?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type StudentProfile = {
  coach_notes: string;
  default_task_1_id: string | null;
  default_exercise_id: string | null;
  homework_message: string;
};

export type StudentWithProfile = Student & { profile?: StudentProfile };

export async function getStudent(userId: string): Promise<StudentWithProfile> {
  const res = await fetchWithAuth(`${API_BASE}/students/${userId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateStudentProfile(
  userId: string,
  profile: Partial<StudentProfile>
): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/students/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function getStudentContext(userId: string) {
  const res = await fetchWithAuth(`${API_BASE}/students/${userId}/context`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setStudentContext(userId: string, coachNotes: string) {
  const res = await fetchWithAuth(`${API_BASE}/students/${userId}/context`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coach_notes: coachNotes }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTask1Pool(activeOnly = true) {
  const res = await fetchWithAuth(`${API_BASE}/task-1-pool?active_only=${activeOnly}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createTask1(body: { title: string; body?: string; sort_order?: number }) {
  const res = await fetchWithAuth(`${API_BASE}/task-1-pool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateTask1(id: string, body: { title?: string; body?: string; active?: boolean }) {
  const res = await fetchWithAuth(`${API_BASE}/task-1-pool/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getExercises() {
  const res = await fetchWithAuth(`${API_BASE}/exercises`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createExercise(body: { name: string; description?: string; default_starting_metric?: number }) {
  const res = await fetchWithAuth(`${API_BASE}/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateExercise(id: string, body: { name?: string; description?: string; default_starting_metric?: number }) {
  const res = await fetchWithAuth(`${API_BASE}/exercises/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getReportsList(limit = 50) {
  const res = await fetchWithAuth(`${API_BASE}/reports?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getReportById(id: string) {
  const res = await fetchWithAuth(`${API_BASE}/reports/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type SubmitFeedbackResponse = { ok: boolean; email_sent: boolean; warning?: string };

export async function submitReportFeedback(reportId: string, coachFeedbackText: string): Promise<SubmitFeedbackResponse> {
  const res = await fetchWithAuth(`${API_BASE}/reports/${reportId}/feedback`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coach_feedback_text: coachFeedbackText }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
