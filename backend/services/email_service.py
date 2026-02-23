"""
Resend: homework assignment email and coach feedback email (with return link).
"""
import os
import resend
from flask import current_app


def _api_key():
    return os.environ.get("RESEND_API_KEY") or current_app.config.get("RESEND_API_KEY")


def _app_url():
    return os.environ.get("APP_URL") or current_app.config.get("APP_URL")


def send_homework_assignment(
    to_email: str,
    student_name: str,
    task_title: str,
    task_body: str,
    exercise_name: str = None,
    exercise_description: str = None,
    homework_message: str = None,
):
    """Send email when coach assigns homework. Includes task_1, optional exercise, optional coach message, plus link to start."""
    resend.api_key = _api_key()
    from_addr = current_app.config.get("EMAIL_FROM", "homework@willab.com")
    app_url = _app_url()
    body_lines = [f"Hi {student_name},"]
    body_lines.append("")
    if homework_message and homework_message.strip():
        body_lines.append(homework_message.strip())
        body_lines.append("")
    body_lines.append(f"**Your new homework**")
    body_lines.append(f"Task: {task_title}")
    if task_body:
        body_lines.append(task_body)
    if exercise_name:
        body_lines.append("")
        body_lines.append(f"Exercise: {exercise_name}")
        if exercise_description:
            body_lines.append(exercise_description)
    body_lines.append("")
    body_lines.append(f"Start your homework here: {app_url}")
    body_lines.append("")
    body_lines.append("— Willab")

    import html as html_module
    html = "<br>\n".join(html_module.escape(line) for line in body_lines)

    params = {
        "from": from_addr,
        "to": [to_email],
        "subject": "Your new homework from Willab",
        "html": html,
    }
    return resend.Emails.send(params)


def send_coach_feedback(
    to_email: str,
    student_name: str,
    coach_feedback_text: str,
    score: float,
    summary: str,
):
    """Send email with coach's written feedback and link back to app (step 0)."""
    resend.api_key = _api_key()
    from_addr = current_app.config.get("EMAIL_FROM", "homework@willab.com")
    app_url = _app_url()

    body_lines = [f"Hi {student_name},"]
    body_lines.append("")
    body_lines.append("Your coach has left feedback on your homework:")
    body_lines.append("")
    body_lines.append(coach_feedback_text)
    body_lines.append("")
    body_lines.append(f"Your score: {score}. Summary: {summary}")
    body_lines.append("")
    body_lines.append(f"Return to Willab for your next homework: {app_url}")
    body_lines.append("")
    body_lines.append("— Willab")

    import html as html_module
    html = "<br>\n".join(html_module.escape(line) for line in body_lines)

    params = {
        "from": from_addr,
        "to": [to_email],
        "subject": "Your homework feedback from Willab",
        "html": html,
    }
    return resend.Emails.send(params)
