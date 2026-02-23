"use client";

import { useEffect, useState } from "react";
import { getReport, type ReportResponse } from "@/lib/api";

export default function ReportPage() {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getReport()
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-8 text-center text-gray-500">Loading report…</div>;
  if (error) return <div className="py-8 text-red-600">{error}</div>;
  if (!report) return <div className="py-8 text-gray-500">No report found.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Your result</h1>
      <div className="rounded-lg border p-6 bg-gray-50">
        <p className="text-3xl font-bold text-gray-900">Score: {report.score}</p>
        <p className="mt-4 text-gray-700">{report.summary}</p>
        <p className="mt-4 text-sm text-gray-600">{report.coach_reminder}</p>
        {report.coach_feedback_text && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium text-gray-700">Coach feedback</p>
            <p className="mt-1 text-gray-600">{report.coach_feedback_text}</p>
          </div>
        )}
      </div>
    </div>
  );
}
