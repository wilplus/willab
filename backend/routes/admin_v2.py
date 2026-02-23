"""
Admin routes: send homework, student context, task_1 pool, exercises, reports, feedback.
"""
from flask import Blueprint, jsonify, g, request
from auth import require_admin
from services import db
from services.email_service import send_homework_assignment, send_coach_feedback

bp = Blueprint("admin_v2", __name__, url_prefix="/v2/admin")


@bp.route("/check", methods=["GET"])
@require_admin
def check():
    """Lightweight check that the current user is a coach. Used by frontend to show/hide Admin link."""
    return jsonify({"ok": True})


@bp.route("/students", methods=["GET"])
@require_admin
def list_students():
    """List students (user_ids with at least one session), enriched with email."""
    limit = request.args.get("limit", 200, type=int)
    items = db.get_students_list(limit=limit)
    for s in items:
        s["email"] = _get_user_email(s["id"])
    return jsonify(items)


def _get_user_email(user_id: str):
    """Resolve user email: try Supabase Auth Admin, then profiles table."""
    try:
        sb = db.get_supabase()
        r = sb.auth.admin.get_user_by_id(user_id)
        if r and getattr(r, "user", None) and getattr(r.user, "email", None):
            return r.user.email
    except Exception:
        pass
    try:
        sb = db.get_supabase()
        r = sb.table("profiles").select("email").eq("id", user_id).execute()
        if r.data and len(r.data) > 0:
            return r.data[0].get("email")
    except Exception:
        pass
    return None


@bp.route("/send-homework", methods=["POST"])
@require_admin
def send_homework():
    """Body: student_id (user_id), task_1_id, exercise_id (optional). Send email, create session."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400
    student_id = data.get("student_id")
    task_1_id = data.get("task_1_id")
    exercise_id = data.get("exercise_id")
    if not student_id or not task_1_id:
        return jsonify({"error": "student_id and task_1_id required"}), 400
    pool = db.get_task_1_pool(active_only=False)
    task = next((t for t in pool if str(t.get("id")) == str(task_1_id)), None)
    if not task:
        return jsonify({"error": "task_1 not found"}), 404
    exercise = None
    if exercise_id:
        exercise = db.get_exercise_by_id(exercise_id)
    session = db.create_session(student_id, recommended_exercise_id=exercise_id if exercise else None)
    student_email = _get_user_email(student_id)
    student_name = "Student"
    profile = db.get_student_profile(student_id)
    homework_message = profile.get("homework_message") or ""
    if student_email:
        try:
            send_homework_assignment(
                to_email=student_email,
                student_name=student_name,
                task_title=task.get("title", ""),
                task_body=task.get("body", ""),
                exercise_name=exercise.get("name") if exercise else None,
                exercise_description=exercise.get("description") if exercise else None,
                homework_message=homework_message,
            )
        except Exception as e:
            return jsonify({"error": f"Email send failed: {e}"}), 500
    return jsonify({
        "session_id": session["id"],
        "sent": bool(student_email),
        **({"warning": "No email on file for this student; homework created but not emailed."} if not student_email else {}),
    })


@bp.route("/students/<user_id>", methods=["GET"])
@require_admin
def get_student(user_id):
    """Get one student's id, email, and profile (coach_notes, default_task_1_id, default_exercise_id, homework_message)."""
    email = _get_user_email(user_id)
    profile = db.get_student_profile(user_id)
    return jsonify({"id": user_id, "email": email, "profile": profile})


@bp.route("/students/<user_id>", methods=["PUT"])
@require_admin
def update_student_profile(user_id):
    """Update profile: coach_notes, default_task_1_id, default_exercise_id, homework_message (any subset)."""
    data = request.get_json() or {}
    db.set_student_profile(
        user_id,
        coach_notes=data.get("coach_notes"),
        default_task_1_id=data.get("default_task_1_id"),
        default_exercise_id=data.get("default_exercise_id"),
        homework_message=data.get("homework_message"),
    )
    return jsonify({"ok": True})


@bp.route("/students/<user_id>/context", methods=["GET"])
@require_admin
def get_student_context(user_id):
    notes = db.get_student_context(user_id)
    return jsonify({"coach_notes": notes or ""})


@bp.route("/students/<user_id>/context", methods=["PUT"])
@require_admin
def set_student_context(user_id):
    data = request.get_json() or {}
    notes = data.get("coach_notes", "")
    db.set_student_context(user_id, notes)
    return jsonify({"ok": True})


@bp.route("/task-1-pool", methods=["GET"])
@require_admin
def list_task_1():
    active_only = request.args.get("active_only", "true").lower() == "true"
    items = db.get_task_1_pool(active_only=active_only)
    return jsonify(items)


@bp.route("/task-1-pool", methods=["POST"])
@require_admin
def create_task_1():
    data = request.get_json() or {}
    title = data.get("title") or ""
    if not title:
        return jsonify({"error": "title required"}), 400
    item = db.create_task_1(title=title, body=data.get("body"), sort_order=data.get("sort_order", 0))
    return jsonify(item)


@bp.route("/task-1-pool/<task_id>", methods=["PUT"])
@require_admin
def update_task_1(task_id):
    data = request.get_json() or {}
    db.update_task_1(task_id, title=data.get("title"), body=data.get("body"), active=data.get("active"))
    return jsonify({"ok": True})


@bp.route("/exercises", methods=["GET"])
@require_admin
def list_exercises():
    items = db.get_exercises_pool()
    return jsonify(items)


@bp.route("/exercises", methods=["POST"])
@require_admin
def create_exercise():
    data = request.get_json() or {}
    name = data.get("name") or ""
    if not name:
        return jsonify({"error": "name required"}), 400
    item = db.create_exercise(
        name=name,
        description=data.get("description"),
        default_starting_metric=data.get("default_starting_metric", 100),
    )
    return jsonify(item)


@bp.route("/exercises/<exercise_id>", methods=["PUT"])
@require_admin
def update_exercise(exercise_id):
    data = request.get_json() or {}
    db.update_exercise(
        exercise_id,
        name=data.get("name"),
        description=data.get("description"),
        default_starting_metric=data.get("default_starting_metric"),
    )
    return jsonify({"ok": True})


@bp.route("/reports", methods=["GET"])
@require_admin
def list_reports():
    limit = request.args.get("limit", 50, type=int)
    items = db.get_reports_list(limit=limit)
    return jsonify(items)


@bp.route("/reports/<report_id>", methods=["GET"])
@require_admin
def get_report(report_id):
    report = db.get_report_by_id(report_id)
    if not report:
        return jsonify({"error": "Report not found"}), 404
    return jsonify({
        "id": report["id"],
        "score": report.get("score"),
        "summary": report.get("summary"),
        "coach_feedback_text": report.get("coach_feedback_text"),
        "coach_feedback_sent_at": report.get("coach_feedback_sent_at"),
        "coach_reminder": "Your coach will contact you within 24 hours.",
    })


@bp.route("/reports/<report_id>/feedback", methods=["PUT"])
@require_admin
def submit_feedback(report_id):
    data = request.get_json() or {}
    text = data.get("coach_feedback_text") or ""
    report = db.get_report_by_id(report_id)
    if not report:
        return jsonify({"error": "Report not found"}), 404
    db.update_report_feedback(report_id, text)
    sess = report.get("homework_sessions_v2")
    user_id = (sess.get("user_id") if isinstance(sess, dict) else (sess[0].get("user_id") if isinstance(sess, list) and sess else None)) or report.get("user_id")
    if not user_id and report.get("session_id"):
        sess = db.get_session_by_id(report["session_id"])
        user_id = sess.get("user_id") if sess else None
    student_email = _get_user_email(user_id) if user_id else None
    if student_email:
        try:
            send_coach_feedback(
                to_email=student_email,
                student_name="Student",
                coach_feedback_text=text,
                score=report.get("score", 0),
                summary=report.get("summary") or "",
            )
        except Exception as e:
            return jsonify({"error": f"Email send failed: {e}"}), 500
    return jsonify({
        "ok": True,
        "email_sent": bool(student_email),
        **({"warning": "No email on file for this student; feedback saved but not emailed."} if not student_email else {}),
    })
