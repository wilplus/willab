"""
Student homework routes: status, start, report, finalize.
"""
import base64
from flask import Blueprint, jsonify, g, request
from auth import require_auth
from services import db
from services.recording_1_job import process_recording_finalize
from services.live_metrics import append_chunk, process_window, clear_buffer

bp = Blueprint("homework_v2", __name__, url_prefix="/v2/homework")


def _session_to_step(session):
    if not session:
        return "landing", None
    status = session.get("status") or "not_started"
    if status == "not_started":
        return "landing", session
    if status == "recording":
        return "recording", session
    if status == "processing":
        return "processing", session
    if status == "completed":
        return "report", session
    return "landing", session


@bp.route("/status", methods=["GET"])
@require_auth
def status():
    """Current session state + recommended exercise. Step: landing | recording | processing | report."""
    user_id = str(g.current_user.id)
    session = db.get_current_session(user_id)
    step, _ = _session_to_step(session)
    payload = {"step": step}
    if session:
        payload["session_id"] = session["id"]
        payload["status"] = session.get("status")
        payload["exercise"] = _exercise_payload(session)
    else:
        payload["session_id"] = None
        payload["status"] = None
        payload["exercise"] = None
    return jsonify(payload)


def _exercise_payload(session):
    ex = session.get("exercises_pool") if isinstance(session.get("exercises_pool"), dict) else None
    eid = session.get("recommended_exercise_id")
    if not eid and not ex:
        return None
    if ex:
        return {"id": eid, "name": ex.get("name"), "description": ex.get("description")}
    if eid:
        exercise = db.get_exercise_by_id(str(eid))
        return {"id": eid, "name": exercise.get("name") if exercise else None, "description": exercise.get("description") if exercise else None}
    return None


@bp.route("/start", methods=["POST"])
@require_auth
def start():
    """Create or resume session; return session_id, exercise, step. Sets status to recording so client can show recording view."""
    user_id = str(g.current_user.id)
    session = db.get_current_session(user_id)
    if session and session.get("status") in ("not_started", "recording"):
        if session.get("status") == "not_started":
            db.update_session_status(session["id"], "recording")
        step = "recording"
        return jsonify({
            "session_id": session["id"],
            "step": step,
            "exercise": _exercise_payload(session),
        })
    data = request.get_json() or {}
    recommended_exercise_id = data.get("recommended_exercise_id")
    session = db.create_session(user_id, recommended_exercise_id=recommended_exercise_id)
    db.update_session_status(session["id"], "recording")
    return jsonify({
        "session_id": session["id"],
        "step": "recording",
        "exercise": _exercise_payload(session),
    })


@bp.route("/report", methods=["GET"])
@require_auth
def report():
    """Get report for current session: score, summary, coach reminder."""
    user_id = str(g.current_user.id)
    session = db.get_current_session(user_id)
    if not session or session.get("status") != "completed":
        return jsonify({"error": "No report available"}), 404
    report_row = db.get_report_by_session(session["id"])
    if not report_row:
        return jsonify({"error": "Report not found"}), 404
    return jsonify({
        "score": report_row.get("score"),
        "summary": report_row.get("summary"),
        "coach_reminder": "Your coach will contact you within 24 hours.",
        "coach_feedback_text": report_row.get("coach_feedback_text"),
    })


@bp.route("/recordings/stream-chunk", methods=["POST"])
@require_auth
def stream_chunk():
    """Send an audio chunk for live metrics. Body: session_id, sequence_index, audio_base64, duration_seconds (optional)."""
    user_id = str(g.current_user.id)
    session = db.get_current_session(user_id)
    if not session:
        return jsonify({"error": "No session"}), 400
    if session.get("status") not in ("not_started", "recording"):
        return jsonify({"error": "Session not in recordable state"}), 400
    data = request.get_json()
    if not data or not data.get("audio_base64"):
        return jsonify({"error": "audio_base64 required"}), 400
    session_id = data.get("session_id") or session["id"]
    if str(session_id) != str(session["id"]):
        return jsonify({"error": "Session mismatch"}), 403
    try:
        audio_bytes = base64.b64decode(data["audio_base64"])
    except Exception:
        return jsonify({"error": "Invalid audio_base64"}), 400
    duration_sec = float(data.get("duration_seconds", 3.0))
    db.update_session_status(session_id, "recording")
    append_chunk(session_id, audio_bytes, duration_sec)
    metrics = process_window(session_id)
    return jsonify(metrics)


@bp.route("/recordings/finalize", methods=["POST"])
@require_auth
def finalize():
    """End recording: send full audio in body (binary or base64). Create recording row, run job, return report when done."""
    user_id = str(g.current_user.id)
    session = db.get_current_session(user_id)
    if not session:
        return jsonify({"error": "No session"}), 400
    if session.get("status") not in ("not_started", "recording"):
        return jsonify({"error": "Session not in recordable state"}), 400

    # Accept binary body or JSON with base64 audio + duration_seconds
    content_type = request.content_type or ""
    if "application/json" in content_type:
        data = request.get_json()
        import base64
        b64 = data.get("audio_base64")
        duration = float(data.get("duration_seconds", 0))
        if not b64:
            return jsonify({"error": "audio_base64 required"}), 400
        audio_bytes = base64.b64decode(b64)
    else:
        audio_bytes = request.get_data()
        duration = float(request.headers.get("X-Duration-Seconds", 0))
        if not audio_bytes:
            return jsonify({"error": "Audio body required"}), 400

    db.update_session_status(session["id"], "recording")  # mark as was recording
    recording = db.create_recording(session["id"])
    session_id = session["id"]
    try:
        result = process_recording_finalize(session_id, audio_bytes, duration)
        return jsonify({
            "step": "report",
            "score": result["score"],
            "summary": result["summary"],
            "coach_reminder": "Your coach will contact you within 24 hours.",
        })
    except Exception as e:
        db.update_session_status(session_id, "not_started")
        return jsonify({"error": str(e)}), 500
    finally:
        clear_buffer(session_id)
