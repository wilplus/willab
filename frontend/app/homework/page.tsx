"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStatus, startHomework, type HomeworkStatus } from "@/lib/api";

export default function HomeworkPage() {
  const [status, setStatus] = useState<HomeworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!status) return;
    if (status.step === "recording" || status.step === "processing") {
      router.replace("/homework/recording");
      return;
    }
    if (status.step === "report") {
      router.replace("/homework/report");
    }
  }, [status, router]);

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      const res = await startHomework(status?.exercise?.id);
      if (res.step === "recording" || res.step === "report") {
        router.push(res.step === "recording" ? "/homework/recording" : "/homework/report");
        return;
      }
      setStatus((s) => (s ? { ...s, ...res } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setStarting(false);
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-500">Loading…</div>;
  if (error) return <div className="py-8 text-red-600">{error}</div>;

  const hasExercise = status?.exercise?.id;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Homework</h1>
      {hasExercise ? (
        <>
          <div className="rounded-lg border p-4 bg-gray-50">
            <h2 className="font-medium text-gray-900">{status!.exercise!.name}</h2>
            {status!.exercise!.description && (
              <p className="mt-2 text-sm text-gray-600">{status!.exercise!.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {starting ? "Starting…" : "Start homework"}
          </button>
        </>
      ) : (
        <p className="text-gray-600">No homework assigned. Your coach will send you an exercise soon.</p>
      )}
    </div>
  );
}
