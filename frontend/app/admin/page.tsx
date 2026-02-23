"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getStudents,
  sendHomework,
  getTask1Pool,
  createTask1,
  updateTask1,
  getExercises,
  createExercise,
  updateExercise,
  getReportsList,
  getReportById,
  submitReportFeedback,
} from "@/lib/admin-api";
import type { Student } from "@/lib/admin-api";
import * as Dialog from "@radix-ui/react-dialog";

type Task1 = { id: string; title: string; body?: string; active: boolean; sort_order?: number };
type Exercise = { id: string; name: string; description?: string; default_starting_metric: number };
type ReportRow = {
  id: string;
  session_id: string;
  score: number;
  summary: string;
  coach_feedback_sent_at: string | null;
  created_at: string;
  homework_sessions_v2?: { user_id: string };
};

export default function AdminPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [task1Pool, setTask1Pool] = useState<Task1[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);

  const [studentId, setStudentId] = useState("");
  const [task1Id, setTask1Id] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [sending, setSending] = useState(false);

  const [task1Title, setTask1Title] = useState("");
  const [task1Body, setTask1Body] = useState("");
  const [task1Adding, setTask1Adding] = useState(false);
  const [task1EditId, setTask1EditId] = useState<string | null>(null);
  const [task1EditTitle, setTask1EditTitle] = useState("");
  const [task1EditBody, setTask1EditBody] = useState("");

  const [exName, setExName] = useState("");
  const [exDescription, setExDescription] = useState("");
  const [exMetric, setExMetric] = useState(100);
  const [exAdding, setExAdding] = useState(false);
  const [exEditId, setExEditId] = useState<string | null>(null);
  const [exEditName, setExEditName] = useState("");
  const [exEditDescription, setExEditDescription] = useState("");
  const [exEditMetric, setExEditMetric] = useState(100);

  const [error, setError] = useState("");
  const [reportModal, setReportModal] = useState<ReportRow | null>(null);
  const [reportDetail, setReportDetail] = useState<{
    score: number;
    summary: string;
    coach_reminder: string;
    coach_feedback_text?: string;
  } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  function loadData() {
    getStudents().then(setStudents).catch(() => setStudents([]));
    getTask1Pool(false).then(setTask1Pool).catch(() => setTask1Pool([]));
    getExercises().then(setExercises).catch(() => setExercises([]));
    getReportsList().then(setReports).catch(() => setReports([]));
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!reportModal) return;
    getReportById(reportModal.id).then(setReportDetail).catch(() => setReportDetail(null));
    setFeedbackText("");
  }, [reportModal]);

  async function handleSendHomework(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await sendHomework({
        student_id: studentId,
        task_1_id: task1Id,
        exercise_id: exerciseId || undefined,
      });
      setStudentId("");
      setTask1Id("");
      setExerciseId("");
      if (res.warning) setError(res.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  }

  async function handleAddTask1(e: React.FormEvent) {
    e.preventDefault();
    setTask1Adding(true);
    setError("");
    try {
      await createTask1({ title: task1Title, body: task1Body || undefined });
      setTask1Title("");
      setTask1Body("");
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setTask1Adding(false);
    }
  }

  function startEditTask1(t: Task1) {
    setTask1EditId(t.id);
    setTask1EditTitle(t.title);
    setTask1EditBody(t.body || "");
  }

  async function saveEditTask1() {
    if (!task1EditId) return;
    setError("");
    try {
      await updateTask1(task1EditId, { title: task1EditTitle, body: task1EditBody });
      setTask1EditId(null);
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function toggleTask1Active(t: Task1) {
    setError("");
    try {
      await updateTask1(t.id, { active: !t.active });
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleAddExercise(e: React.FormEvent) {
    e.preventDefault();
    setExAdding(true);
    setError("");
    try {
      await createExercise({
        name: exName,
        description: exDescription || undefined,
        default_starting_metric: exMetric,
      });
      setExName("");
      setExDescription("");
      setExMetric(100);
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setExAdding(false);
    }
  }

  function startEditExercise(e: Exercise) {
    setExEditId(e.id);
    setExEditName(e.name);
    setExEditDescription(e.description || "");
    setExEditMetric(e.default_starting_metric);
  }

  async function saveEditExercise() {
    if (!exEditId) return;
    setError("");
    try {
      await updateExercise(exEditId, {
        name: exEditName,
        description: exEditDescription || undefined,
        default_starting_metric: exEditMetric,
      });
      setExEditId(null);
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleSubmitFeedback() {
    if (!reportModal) return;
    setSubmittingFeedback(true);
    setError("");
    try {
      const res = await submitReportFeedback(reportModal.id, feedbackText);
      setReportModal(null);
      loadData();
      if (res.warning) setError(res.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3">Students</h2>
        <p className="text-sm text-gray-600 mb-2">Click a student to open their profile (notes, send homework).</p>
        <ul className="border rounded divide-y overflow-hidden">
          {students.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/students/${s.id}`}
                className="block px-4 py-3 text-gray-900 hover:bg-gray-50"
              >
                {s.email || s.id}
              </Link>
            </li>
          ))}
          {students.length === 0 && (
            <li className="px-4 py-3 text-gray-500">No students yet (they appear after first session).</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Send homework (quick)</h2>
        <form onSubmit={handleSendHomework} className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email || s.id}
                </option>
              ))}
              {students.length === 0 && (
                <option value="" disabled>No students yet (they appear after first session)</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task</label>
            <select
              value={task1Id}
              onChange={(e) => setTask1Id(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            >
              <option value="">Select task</option>
              {task1Pool.filter((t) => t.active).map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exercise (optional)</label>
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">No exercise</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send homework"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Task 1 pool</h2>
        <form onSubmit={handleAddTask1} className="mb-4 flex flex-wrap items-end gap-3">
          <input
            type="text"
            placeholder="Title"
            value={task1Title}
            onChange={(e) => setTask1Title(e.target.value)}
            className="px-3 py-2 border rounded w-48"
            required
          />
          <input
            type="text"
            placeholder="Body (optional)"
            value={task1Body}
            onChange={(e) => setTask1Body(e.target.value)}
            className="px-3 py-2 border rounded flex-1 min-w-[200px]"
          />
          <button
            type="submit"
            disabled={task1Adding}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {task1Adding ? "Adding…" : "Add task"}
          </button>
        </form>
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2">Body</th>
                <th className="text-left p-2">Active</th>
                <th className="text-left p-2"></th>
              </tr>
            </thead>
            <tbody>
              {task1Pool.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-2">
                    {task1EditId === t.id ? (
                      <input
                        value={task1EditTitle}
                        onChange={(e) => setTask1EditTitle(e.target.value)}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      t.title
                    )}
                  </td>
                  <td className="p-2 max-w-xs truncate">
                    {task1EditId === t.id ? (
                      <input
                        value={task1EditBody}
                        onChange={(e) => setTask1EditBody(e.target.value)}
                        className="w-full px-2 py-1 border rounded"
                        placeholder="Body"
                      />
                    ) : (
                      t.body || "—"
                    )}
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => toggleTask1Active(t)}
                      className={`text-xs px-2 py-1 rounded ${t.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}
                    >
                      {t.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="p-2">
                    {task1EditId === t.id ? (
                      <button type="button" onClick={saveEditTask1} className="text-blue-600 hover:underline">
                        Save
                      </button>
                    ) : (
                      <button type="button" onClick={() => startEditTask1(t)} className="text-blue-600 hover:underline">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {task1Pool.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">No tasks yet. Add one above.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Exercises pool</h2>
        <form onSubmit={handleAddExercise} className="mb-4 flex flex-wrap items-end gap-3">
          <input
            type="text"
            placeholder="Name"
            value={exName}
            onChange={(e) => setExName(e.target.value)}
            className="px-3 py-2 border rounded w-40"
            required
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={exDescription}
            onChange={(e) => setExDescription(e.target.value)}
            className="px-3 py-2 border rounded flex-1 min-w-[180px]"
          />
          <input
            type="number"
            placeholder="Starting metric"
            value={exMetric}
            onChange={(e) => setExMetric(Number(e.target.value))}
            className="px-3 py-2 border rounded w-28"
            min={0}
          />
          <button
            type="submit"
            disabled={exAdding}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {exAdding ? "Adding…" : "Add exercise"}
          </button>
        </form>
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Description</th>
                <th className="text-left p-2">Starting metric</th>
                <th className="text-left p-2"></th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-2">
                    {exEditId === e.id ? (
                      <input
                        value={exEditName}
                        onChange={(ev) => setExEditName(ev.target.value)}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      e.name
                    )}
                  </td>
                  <td className="p-2 max-w-xs">
                    {exEditId === e.id ? (
                      <input
                        value={exEditDescription}
                        onChange={(ev) => setExEditDescription(ev.target.value)}
                        className="w-full px-2 py-1 border rounded"
                        placeholder="Description"
                      />
                    ) : (
                      (e.description || "—")
                    )}
                  </td>
                  <td className="p-2">
                    {exEditId === e.id ? (
                      <input
                        type="number"
                        value={exEditMetric}
                        onChange={(ev) => setExEditMetric(Number(ev.target.value))}
                        className="w-20 px-2 py-1 border rounded"
                        min={0}
                      />
                    ) : (
                      e.default_starting_metric
                    )}
                  </td>
                  <td className="p-2">
                    {exEditId === e.id ? (
                      <button type="button" onClick={saveEditExercise} className="text-blue-600 hover:underline">
                        Save
                      </button>
                    ) : (
                      <button type="button" onClick={() => startEditExercise(e)} className="text-blue-600 hover:underline">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {exercises.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">No exercises yet. Add one above.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Historical reports</h2>
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Score</th>
                <th className="text-left p-2">Summary</th>
                <th className="text-left p-2"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-2">{r.score}</td>
                  <td className="p-2 max-w-xs truncate">{r.summary}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => setReportModal(r)}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog.Root open={!!reportModal} onOpenChange={(open) => !open && setReportModal(null)}>
        <Dialog.Portal>
          <div>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto">
              <Dialog.Title className="text-lg font-semibold">Report</Dialog.Title>
              {reportDetail && (
                <div className="mt-4 space-y-2">
                  <p><strong>Score:</strong> {reportDetail.score}</p>
                  <p><strong>Summary:</strong> {reportDetail.summary}</p>
                  <p className="text-sm text-gray-600">{reportDetail.coach_reminder}</p>
                  {reportDetail.coach_feedback_text && (
                    <p><strong>Coach feedback:</strong> {reportDetail.coach_feedback_text}</p>
                  )}
                </div>
              )}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Send feedback to student</label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Coach feedback (emailed to student with link back)"
                  className="mt-1 w-full px-3 py-2 border rounded"
                  rows={3}
                />
                <button
                  type="button"
                  onClick={handleSubmitFeedback}
                  disabled={submittingFeedback}
                  className="mt-2 px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
                >
                  {submittingFeedback ? "Sending…" : "Send feedback email"}
                </button>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="mt-4 text-gray-500 hover:text-gray-700">Close</button>
              </Dialog.Close>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
