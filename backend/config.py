import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
    EMAIL_FROM = os.environ.get("EMAIL_FROM") or os.environ.get("RESEND_FROM_EMAIL", "homework@willab.com")
    APP_URL = os.environ.get("APP_URL", "http://localhost:3000")
    BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000")
    SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "audio_recordings")
    DEFAULT_STARTING_METRIC = int(os.environ.get("DEFAULT_STARTING_METRIC", "100"))
    POINTS_PER_FILLER = int(os.environ.get("POINTS_PER_FILLER", "5"))
    FILLER_WORDS = ["um", "uh", "like", "you know", "so"]  # configurable later from DB if needed
