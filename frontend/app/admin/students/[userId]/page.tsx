"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getStudent,
  updateStudentProfile,
  sendHomework,
  getTask1Pool,
  getExercises,
} from "@/lib/admin-api";
import type { StudentWithProfile } from "@/lib/admin-api";

type Task1 = { id: string; title: string; body?: string; active: boolean };
type Exercise = { id: string; name: string; description?: string; default_starting_metric: number };

export default function StudentProfilePage() {
  const params = useParams();
  const userId = params.userId as string;

  const [student, setStudent] = useState<StudentWithProfile | null>(null);
  const [coachNotes, setCoachNotes] = useState("");
  const [defaultTask1Id, setDefaultTask1Id] = useState("");
  const [defaultExerciseId, setDefaultExerciseId] = useState("");
  const [homeworkMessage, setHomeworkMessage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [task1Pool, setTask1Pool] = useState<Task1[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [task1Id, setTask1Id] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getStudent(userId).then((s) => {
      setStudent(s);
      const p = (s as StudentWithProfile).profile;
      if (p) {
        setCoachNotes(p.coach_notes || "");
        setDefaultTask1Id(p.default_task_1_id || "");
        setDefaultExerciseId(p.default_exercise_id || "");
        setHomeworkMessage(p.homework_message || "");
        setTask1Id(p.default_task_1_id || "");
        setExerciseId(p.default_exercise_id || "");
      }
    }).catch(() => setStudent(null));
    getTask1Pool(false).then(setTask1Pool).catch(() => setTask1Pool([]));
    getExercises().then(setExercises).catch(() => setExercises([]));
  }, [userId]);

  async function handleSaveProfile() {
    setProfileSaving(true);
    setError("");
    try {
      await updateStudentProfile(userId, {
        coach_notes: coachNotes,
        default_task_1_id: defaultTask1Id || null,
        default_exercise_id: defaultExerciseId || null,
        homework_message: homeworkMessage,
      });
      setTask1Id(defaultTask1Id);
      setExerciseId(defaultExerciseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSendHomework(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await sendHomework({
        student_id: userId,
        task_1_id: task1Id,
        exercise_id: exerciseId || undefined,
      });
      setTask1Id(defaultTask1Id);
      setExerciseId(defaultExerciseId);
      if (res.warning) setError(res.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  }

  if (!userId) return null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Admin
        </Link>
      </div>

      {student && (
        <div className="rounded-lg border p-4 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">
            {student.email || student.id}
          </h2>
          {student.email && (
            <p className="text-sm text-gray-500 mt-0.5">ID: {student.id}</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h3 className="text-md font-medium mb-2">Coach notes</h3>
        <p className="text-sm text-gray-500 mb-1">Internal notes about this student (not sent in emails).</p>
        <textarea
          value={coachNotes}
          onChange={(e) => setCoachNotes(e.target.value)}
          placeholder="Background, goals, preferences…"
          className="w-full px-3 py-2 border rounded min-h-[100px]"
          rows={4}
        />
      </section>

      <section>
        <h3 className="text-md font-medium mb-2">Warm up task (default)</h3>
        <p className="text-sm text-gray-500 mb-1">Default task pre-selected when sending homework to this student.</p>
        <select
          value={defaultTask1Id}
          onChange={(e) => setDefaultTask1Id(e.target.value)}
          className="w-full max-w-md px-3 py-2 border rounded"
        >
          <option value="">None</option>
          {task1Pool.filter((t) => t.active).map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </section>

      <section>
        <h3 className="text-md font-medium mb-2">Default exercise</h3>
        <p className="text-sm text-gray-500 mb-1">Default exercise pre-selected when sending homework.</p>
        <select
          value={defaultExerciseId}
          onChange={(e) => setDefaultExerciseId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border rounded"
        >
          <option value="">None</option>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </section>

      <section>
        <h3 className="text-md font-medium mb-2">Homework message</h3>
        <p className="text-sm text-gray-500 mb-1">Custom message included at the top of the homework email when you send homework to this student.</p>
        <textarea
          value={homeworkMessage}
          onChange={(e) => setHomeworkMessage(e.target.value)}
          placeholder="e.g. Focus on pacing this week. Remember to practice the intro."
          className="w-full px-3 py-2 border rounded min-h-[80px]"
          rows={3}
        />
      </section>

      <button
        type="button"
        onClick={handleSaveProfile}
        disabled={profileSaving}
        className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {profileSaving ? "Saving…" : "Save profile"}
      </button>

      <section className="pt-4 border-t">
        <h3 className="text-md font-medium mb-2">Send homework</h3>
        <p className="text-sm text-gray-500 mb-2">Task and exercise are pre-filled from the defaults above. The homework message above is included in the email.</p>
        <form onSubmit={handleSendHomework} className="space-y-3 max-w-md">
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
    </div>
  );
}
