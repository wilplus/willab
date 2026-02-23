"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getStatus, finalizeRecording, sendStreamChunk } from "@/lib/api";

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function RecordingPage() {
  const [step, setStep] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [wpm, setWpm] = useState<number>(0);
  const [voiceStrength, setVoiceStrength] = useState<number>(0);
  const [fillerCount, setFillerCount] = useState<number>(0);
  const [metricsUnavailable, setMetricsUnavailable] = useState(false);
  const [browserSupported, setBrowserSupported] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const sequenceRef = useRef<number>(0);
  const voiceMeterRef = useRef<{ rafId: number; ctx: AudioContext } | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const ok = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    setBrowserSupported(ok);
  }, []);

  useEffect(() => {
    getStatus()
      .then((s) => {
        setStep(s.step);
        if (s.session_id) setSessionId(s.session_id);
      })
      .catch(() => setError("Failed to load status"));
  }, []);

  useEffect(() => {
    if (step === "report") router.replace("/homework/report");
    if (step === "landing") router.replace("/homework");
  }, [step, router]);

  async function startRecording() {
    let sid = sessionId;
    if (!sid) {
      const status = await getStatus().catch(() => null);
      sid = status?.session_id ?? null;
      if (sid) setSessionId(sid);
    }
    if (!sid) {
      setError("Start homework from the previous page first.");
      return;
    }
    setLiveTranscript("");
    setWpm(0);
    setVoiceStrength(0);
    setFillerCount(0);
    setMetricsUnavailable(false);
    sequenceRef.current = 0;
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const meter = { rafId: 0, ctx };
      voiceMeterRef.current = meter;
      const tick = () => {
        if (!voiceMeterRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        setVoiceStrength(Math.min(100, Math.round((avg / 255) * 100 * 1.2)));
        meter.rafId = requestAnimationFrame(tick);
      };
      meter.rafId = requestAnimationFrame(tick);

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      recorder.ondataavailable = async (e) => {
        if (e.data.size === 0) return;
        chunksRef.current.push(e.data);
        if (!sid) return;
        try {
          const blob = e.data;
          const buf = await blob.arrayBuffer();
          const base64 = arrayBufferToBase64(buf);
          const seq = sequenceRef.current++;
          const durationSeconds = 3; // 3s timeslice
          const metrics = await sendStreamChunk(sid, base64, seq, durationSeconds);
          setLiveTranscript((prev) => (prev ? `${prev} ${metrics.transcript_segment}` : metrics.transcript_segment).trim());
          setWpm(metrics.wpm);
          setFillerCount(metrics.filler_count);
          setMetricsUnavailable(false);
        } catch {
          setMetricsUnavailable(true);
        }
      };
      const MAX_DURATION_MS = 5 * 60 * 1000;
      maxDurationTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
          setError("Maximum duration (5 min) reached. Your recording has been submitted.");
        }
        maxDurationTimerRef.current = null;
      }, MAX_DURATION_MS);

      recorder.onstop = async () => {
        if (maxDurationTimerRef.current) {
          clearTimeout(maxDurationTimerRef.current);
          maxDurationTimerRef.current = null;
        }
        const meter = voiceMeterRef.current;
        voiceMeterRef.current = null;
        if (meter) {
          cancelAnimationFrame(meter.rafId);
          meter.ctx.close().catch(() => {});
        }
        stream.getTracks().forEach((t) => t.stop());
        setProcessing(true);
        setError("");
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const buf = await blob.arrayBuffer();
          const base64 = arrayBufferToBase64(buf);
          const durationSeconds = (Date.now() - startTimeRef.current) / 1000;
          await finalizeRecording(base64, durationSeconds);
          setStep("report");
          router.push("/homework/report");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Processing failed");
        } finally {
          setProcessing(false);
        }
      };
      recorder.start(3000);
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not access microphone");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  if (step === "landing" || step === "report") return null;

  if (browserSupported === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Recording</h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Use a modern browser (Chrome, Firefox, Safari, or Edge) to record. This device or browser does not support recording.
        </p>
      </div>
    );
  }

  const showInterruptedMessage = step === "recording" && !recording && !processing && sessionId;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Recording</h1>

      {showInterruptedMessage && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Recording was interrupted (e.g. page refresh). You can start a new recording below.
        </p>
      )}

      {metricsUnavailable && recording && (
        <p className="text-sm text-amber-700">Live metrics temporarily unavailable. Recording continues; you can still stop and submit.</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 bg-gray-50">
          <p className="text-sm font-medium text-gray-500">Pacing (WPM)</p>
          <p className="text-2xl font-bold text-gray-900">{wpm}</p>
        </div>
        <div className="rounded-lg border p-4 bg-gray-50">
          <p className="text-sm font-medium text-gray-500">Voice strength</p>
          <div className="mt-1 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, voiceStrength)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{voiceStrength}%</p>
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-gray-50">
        <p className="text-sm font-medium text-gray-500 mb-2">Live transcript</p>
        <p className="text-gray-800 min-h-[4rem]">{liveTranscript || "—"}</p>
      </div>

      <div className="rounded-lg border p-4 bg-gray-50">
        <p className="text-sm font-medium text-gray-500">Fillers (this window)</p>
        <p className="text-2xl font-bold text-gray-900">{fillerCount}</p>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-4">
        {!recording && !processing && (
          <button
            type="button"
            onClick={startRecording}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Start recording
          </button>
        )}
        {recording && (
          <button
            type="button"
            onClick={stopRecording}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
          >
            Stop & submit
          </button>
        )}
        {processing && <p className="text-gray-500">Processing…</p>}
      </div>
    </div>
  );
}
