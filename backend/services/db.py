"""
Supabase database access for the simplified homework flow.
"""
from supabase import create_client
from flask import current_app
import os


def get_supabase():
    url = os.environ.get("SUPABASE_URL") or current_app.config.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or current_app.config.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


# ---- Homework sessions ----

def get_current_session(user_id: str):
    """Get the most recent session for user that is not completed, or latest completed for report."""
    sb = get_supabase()
    r = (
        sb.table("homework_sessions_v2")
        .select("*, exercises_pool(name, description, default_starting_metric)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not r.data or len(r.data) == 0:
        return None
    return r.data[0]


def get_session_by_id(session_id: str):
    sb = get_supabase()
    r = (
        sb.table("homework_sessions_v2")
        .select("*, exercises_pool(id, name, description, default_starting_metric)")
        .eq("id", session_id)
        .single()
        .execute()
    )
    return r.data if r.data else None


def create_session(user_id: str, recommended_exercise_id: str = None):
    sb = get_supabase()
    payload = {"user_id": user_id, "status": "not_started"}
    if recommended_exercise_id:
        payload["recommended_exercise_id"] = recommended_exercise_id
    r = sb.table("homework_sessions_v2").insert(payload).select().execute()
    return r.data[0] if r.data else None


def update_session_status(session_id: str, status: str):
    sb = get_supabase()
    sb.table("homework_sessions_v2").update({"status": status}).eq("id", session_id).execute()


# ---- Recordings ----

def create_recording(session_id: str, storage_path: str = None):
    sb = get_supabase()
    payload = {"session_id": session_id}
    if storage_path:
        payload["storage_path"] = storage_path
    r = sb.table("recordings_v2").insert(payload).select().execute()
    return r.data[0] if r.data else None


def update_recording(
    recording_id: str,
    transcript: str = None,
    wpm: float = None,
    voice_strength: float = None,
    filler_count: int = None,
    starting_metric: int = None,
    score: float = None,
):
    sb = get_supabase()
    payload = {}
    if transcript is not None:
        payload["transcript"] = transcript
    if wpm is not None:
        payload["wpm"] = wpm
    if voice_strength is not None:
        payload["voice_strength"] = voice_strength
    if filler_count is not None:
        payload["filler_count"] = filler_count
    if starting_metric is not None:
        payload["starting_metric"] = starting_metric
    if score is not None:
        payload["score"] = score
    if not payload:
        return
    sb.table("recordings_v2").update(payload).eq("id", recording_id).execute()


def get_recording_by_session(session_id: str):
    sb = get_supabase()
    r = (
        sb.table("recordings_v2")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


# ---- Reports ----

def create_report(session_id: str, recording_id: str = None, summary: str = None, score: float = None, starting_metric: int = None, filler_count: int = 0):
    sb = get_supabase()
    payload = {
        "session_id": session_id,
        "summary": summary or "",
        "score": score,
        "starting_metric": starting_metric,
        "filler_count": filler_count,
    }
    if recording_id:
        payload["recording_id"] = recording_id
    r = sb.table("homework_reports_v2").insert(payload).select().execute()
    return r.data[0] if r.data else None


def update_report_feedback(report_id: str, coach_feedback_text: str):
    sb = get_supabase()
    from datetime import datetime, timezone
    sb.table("homework_reports_v2").update({
        "coach_feedback_text": coach_feedback_text,
        "coach_feedback_sent_at": datetime.now(tz=timezone.utc).isoformat(),
    }).eq("id", report_id).execute()


def get_report_by_session(session_id: str):
    sb = get_supabase()
    r = sb.table("homework_reports_v2").select("*").eq("session_id", session_id).single().execute()
    return r.data


def get_report_by_id(report_id: str):
    sb = get_supabase()
    r = (
        sb.table("homework_reports_v2")
        .select("*, homework_sessions_v2(user_id)")
        .eq("id", report_id)
        .single()
        .execute()
    )
    return r.data


# ---- Student context and profile (coach notes, default task, exercise, homework message) ----

def get_student_context(user_id: str):
    sb = get_supabase()
    r = sb.table("student_overrides_v2").select("coach_notes").eq("user_id", user_id).execute()
    if not r.data or len(r.data) == 0:
        return None
    return r.data[0].get("coach_notes") or ""


def get_student_profile(user_id: str):
    """Return coach_notes, default_task_1_id, default_exercise_id, homework_message."""
    sb = get_supabase()
    r = sb.table("student_overrides_v2").select("*").eq("user_id", user_id).execute()
    if not r.data or len(r.data) == 0:
        return {
            "coach_notes": "",
            "default_task_1_id": None,
            "default_exercise_id": None,
            "homework_message": "",
        }
    row = r.data[0]
    return {
        "coach_notes": row.get("coach_notes") or "",
        "default_task_1_id": row.get("default_task_1_id"),
        "default_exercise_id": row.get("default_exercise_id"),
        "homework_message": row.get("homework_message") or "",
    }


def set_student_context(user_id: str, coach_notes: str):
    sb = get_supabase()
    sb.table("student_overrides_v2").upsert(
        {"user_id": user_id, "coach_notes": coach_notes},
        on_conflict="user_id",
    ).execute()


def set_student_profile(
    user_id: str,
    coach_notes: str = None,
    default_task_1_id: str = None,
    default_exercise_id: str = None,
    homework_message: str = None,
):
    sb = get_supabase()
    payload = {"user_id": user_id}
    if coach_notes is not None:
        payload["coach_notes"] = coach_notes
    if default_task_1_id is not None:
        payload["default_task_1_id"] = default_task_1_id
    if default_exercise_id is not None:
        payload["default_exercise_id"] = default_exercise_id
    if homework_message is not None:
        payload["homework_message"] = homework_message
    sb.table("student_overrides_v2").upsert(payload, on_conflict="user_id").execute()


def get_student_homework_defaults(user_id: str):
    """Return default_task_1_id and default_exercise_id for pre-filling send homework."""
    profile = get_student_profile(user_id)
    return {
        "default_task_1_id": profile.get("default_task_1_id"),
        "default_exercise_id": profile.get("default_exercise_id"),
        "homework_message": profile.get("homework_message"),
    }


# ---- Task 1 pool ----

def get_task_1_pool(active_only: bool = True):
    sb = get_supabase()
    q = sb.table("task_1_pool").select("*").order("sort_order")
    if active_only:
        q = q.eq("active", True)
    r = q.execute()
    return r.data or []


def create_task_1(title: str, body: str = None, sort_order: int = 0):
    sb = get_supabase()
    r = sb.table("task_1_pool").insert({"title": title, "body": body, "sort_order": sort_order}).select().execute()
    return r.data[0] if r.data else None


def update_task_1(task_id: str, title: str = None, body: str = None, active: bool = None):
    sb = get_supabase()
    payload = {}
    if title is not None:
        payload["title"] = title
    if body is not None:
        payload["body"] = body
    if active is not None:
        payload["active"] = active
    if payload:
        sb.table("task_1_pool").update(payload).eq("id", task_id).execute()


# ---- Exercises pool ----

def get_exercises_pool():
    sb = get_supabase()
    r = sb.table("exercises_pool").select("*").order("name").execute()
    return r.data or []


def get_exercise_by_id(exercise_id: str):
    sb = get_supabase()
    r = sb.table("exercises_pool").select("*").eq("id", exercise_id).single().execute()
    return r.data


def create_exercise(name: str, description: str = None, default_starting_metric: int = 100):
    sb = get_supabase()
    r = sb.table("exercises_pool").insert({
        "name": name,
        "description": description,
        "default_starting_metric": default_starting_metric,
    }).select().execute()
    return r.data[0] if r.data else None


def update_exercise(exercise_id: str, name: str = None, description: str = None, default_starting_metric: int = None):
    sb = get_supabase()
    payload = {}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if default_starting_metric is not None:
        payload["default_starting_metric"] = default_starting_metric
    if payload:
        sb.table("exercises_pool").update(payload).eq("id", exercise_id).execute()


# ---- Admin: reports list ----

def get_reports_list(limit: int = 50):
    sb = get_supabase()
    r = (
        sb.table("homework_reports_v2")
        .select("id, session_id, score, summary, coach_feedback_sent_at, created_at, homework_sessions_v2(user_id)")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return r.data or []


# ---- Admin: list students (distinct user_ids from sessions) ----

def get_students_list(limit: int = 200):
    """Return list of { id: user_id } for users who have at least one session. Ordered by most recent session."""
    sb = get_supabase()
    r = (
        sb.table("homework_sessions_v2")
        .select("user_id")
        .order("created_at", desc=True)
        .limit(limit * 2)
        .execute()
    )
    seen = set()
    out = []
    for row in (r.data or []):
        uid = row.get("user_id")
        if uid and uid not in seen:
            seen.add(uid)
            out.append({"id": uid})
            if len(out) >= limit:
                break
    return out


# ---- Starting metric for a session (from override or exercise) ----

def get_starting_metric_for_user_and_exercise(user_id: str, exercise_id: str = None):
    sb = get_supabase()
    r = sb.table("student_overrides_v2").select("starting_metric_override").eq("user_id", user_id).execute()
    if r.data and len(r.data) > 0 and r.data[0].get("starting_metric_override") is not None:
        return r.data[0]["starting_metric_override"]
    if exercise_id:
        ex = get_exercise_by_id(exercise_id)
        if ex and ex.get("default_starting_metric") is not None:
            return ex["default_starting_metric"]
    from flask import current_app
    return current_app.config.get("DEFAULT_STARTING_METRIC", 100)
