"""
Scoring and metrics: WPM, voice strength, filler count, score = starting_metric - 5 * fillers.
"""
import re
from flask import current_app


POINTS_PER_FILLER = 5  # overridden by config


def get_filler_words():
    return current_app.config.get("FILLER_WORDS", ["um", "uh", "like", "you know", "so"])


def count_fillers(transcript: str) -> int:
    if not transcript or not transcript.strip():
        return 0
    words = get_filler_words()
    text = transcript.lower()
    count = 0
    for w in words:
        # Word boundaries so "um" doesn't match "drum"
        count += len(re.findall(rf"\b{re.escape(w)}\b", text))
    return count


def compute_wpm(word_count: int, duration_seconds: float) -> float:
    if duration_seconds <= 0:
        return 0.0
    return (word_count / (duration_seconds / 60.0))


def compute_voice_strength_rms(audio_bytes: bytes) -> float:
    """Normalized RMS (0–100) from raw PCM. Assumes 16-bit mono; adjust if different."""
    try:
        import numpy as np
        arr = np.frombuffer(audio_bytes, dtype=np.int16)
        if arr.size == 0:
            return 0.0
        rms = np.sqrt(np.mean(arr.astype(np.float64) ** 2))
        # Normalize: 0–32767 typical; scale to 0–100 and cap
        normalized = min(100.0, (rms / 32767.0) * 100.0)
        return round(normalized, 1)
    except Exception:
        return 0.0


def compute_score(starting_metric: int, filler_count: int) -> float:
    points = current_app.config.get("POINTS_PER_FILLER", POINTS_PER_FILLER)
    score = starting_metric - (points * filler_count)
    return max(0.0, float(score))
