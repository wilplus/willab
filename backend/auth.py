"""
Extract user from Supabase JWT in Authorization header.
"""
import os
from functools import wraps
from flask import request, jsonify, g
from supabase import create_client


def get_supabase_auth():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def get_user_from_jwt():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    sb = get_supabase_auth()
    if not sb:
        return None
    try:
        r = sb.auth.get_user(token)
        if r and r.user:
            return r.user
    except Exception:
        pass
    return None


def require_auth(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        user = get_user_from_jwt()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return wrapped


def require_admin(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        user = get_user_from_jwt()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        coach_emails = os.environ.get("COACH_EMAILS", "").split(",")
        coach_emails = [e.strip().lower() for e in coach_emails if e.strip()]
        if coach_emails and (user.email or "").lower() not in coach_emails:
            return jsonify({"error": "Forbidden"}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return wrapped
