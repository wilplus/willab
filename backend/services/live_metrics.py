"""
Live metrics during recording: process a short audio window and return transcript, WPM, fillers.
Uses in-memory per-session buffer; processes last ~15s for each chunk.
"""
import base64
import threading
from services.openai_service import transcribe_audio
from services.metrics_v2 import count_fillers, compute_wpm

# Per-session buffer: { session_id: { "chunks": [bytes], "durations_sec": [float] } }
_buffers: dict = {}
_lock = threading.Lock()

WINDOW_SEC = 15.0  # process last N seconds
MAX_CHUNKS = 10   # cap buffer size


def _get_buffer(session_id: str):
    with _lock:
        if session_id not in _buffers:
            _buffers[session_id] = {"chunks": [], "durations_sec": []}
        return _buffers[session_id]


def append_chunk(session_id: str, audio_bytes: bytes, duration_sec: float):
    """Append a chunk; trim to last WINDOW_SEC."""
    buf = _get_buffer(session_id)
    with _lock:
        buf["chunks"].append(audio_bytes)
        buf["durations_sec"].append(duration_sec)
        total_sec = sum(buf["durations_sec"])
        while len(buf["chunks"]) > 1 and total_sec > WINDOW_SEC and len(buf["chunks"]) > 1:
            buf["chunks"].pop(0)
            total_sec -= buf["durations_sec"].pop(0)
        while len(buf["chunks"]) > MAX_CHUNKS:
            buf["chunks"].pop(0)
            buf["durations_sec"].pop(0)


def process_window(session_id: str):
    """
    Run Whisper on the current buffer and return transcript_segment, wpm, filler_count for that window.
    voice_strength is 0 (would need PCM decode for WebM).
    """
    buf = _get_buffer(session_id)
    with _lock:
        chunks = list(buf["chunks"])
        durations = list(buf["durations_sec"])
    if not chunks:
        return {"transcript_segment": "", "wpm": 0.0, "voice_strength": 0, "filler_count": 0}
    combined = b"".join(chunks)
    duration_sec = sum(durations)
    if len(combined) < 100:
        return {"transcript_segment": "", "wpm": 0.0, "voice_strength": 0, "filler_count": 0}
    try:
        transcript = transcribe_audio(combined, "chunk.webm")
    except Exception:
        return {"transcript_segment": "", "wpm": 0.0, "voice_strength": 0, "filler_count": 0}
    word_count = len(transcript.split()) if transcript else 0
    wpm = compute_wpm(word_count, duration_sec) if duration_sec > 0 else 0.0
    filler_count = count_fillers(transcript or "")
    return {
        "transcript_segment": transcript or "",
        "wpm": round(wpm, 1),
        "voice_strength": 0,  # would need PCM decode for WebM
        "filler_count": filler_count,
    }


def clear_buffer(session_id: str):
    with _lock:
        if session_id in _buffers:
            del _buffers[session_id]
