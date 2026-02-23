"""
Background job for finalizing a recording: full Whisper, metrics, score, report.
Called after client sends finalize (sync or async).
"""
from services.db import (
    get_session_by_id,
    get_starting_metric_for_user_and_exercise,
    update_session_status,
    update_recording,
    create_report,
    get_recording_by_session,
)
from services.openai_service import transcribe_audio, generate_summary
from services.metrics_v2 import count_fillers, compute_wpm, compute_score
from flask import current_app


def process_recording_finalize(session_id: str, full_audio_bytes: bytes, duration_seconds: float):
    """
    Run full pipeline: transcribe -> filler count -> WPM -> score -> report.
    Caller is responsible for creating the recording row and uploading to storage if needed.
    """
    session = get_session_by_id(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
    user_id = session["user_id"]
    exercise_id = session.get("recommended_exercise_id")
    starting_metric = get_starting_metric_for_user_and_exercise(user_id, exercise_id)

    update_session_status(session_id, "processing")

    transcript = transcribe_audio(full_audio_bytes)
    filler_count = count_fillers(transcript)
    word_count = len(transcript.split()) if transcript else 0
    wpm = compute_wpm(word_count, duration_seconds) if duration_seconds > 0 else None
    score = compute_score(starting_metric, filler_count)
    summary = generate_summary(transcript, max_sentences=3)

    recording = get_recording_by_session(session_id)
    if recording:
        update_recording(
            recording["id"],
            transcript=transcript,
            wpm=wpm,
            filler_count=filler_count,
            starting_metric=starting_metric,
            score=score,
        )

    create_report(
        session_id=session_id,
        recording_id=recording["id"] if recording else None,
        summary=summary,
        score=score,
        starting_metric=starting_metric,
        filler_count=filler_count,
    )
    update_session_status(session_id, "completed")
    return {"score": score, "summary": summary, "filler_count": filler_count}
