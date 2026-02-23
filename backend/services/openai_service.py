"""
OpenAI: Whisper transcription and GPT summary generation.
"""
import os
from openai import OpenAI
from flask import current_app


def get_client():
    key = os.environ.get("OPENAI_API_KEY") or current_app.config.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set")
    return OpenAI(api_key=key)


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    client = get_client()
    # Whisper expects a file-like object; use temp file or io.BytesIO
    import io
    file_like = io.BytesIO(audio_bytes)
    file_like.name = filename
    r = client.audio.transcriptions.create(model="whisper-1", file=file_like)
    return r.text or ""


def generate_summary(transcript: str, max_sentences: int = 3) -> str:
    if not transcript or not transcript.strip():
        return "No transcript available."
    client = get_client()
    prompt = f"""Summarize this speech transcript in at most {max_sentences} sentences. Be concise and focus on clarity and delivery."""
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a concise assistant. Output only the summary, no preamble."},
            {"role": "user", "content": f"Transcript:\n{transcript[:8000]}"},
        ],
        max_tokens=200,
    )
    text = (r.choices[0].message.content or "").strip()
    # Truncate to roughly 3 sentences if model returned more
    sentences = text.replace("..", ".").split(".")
    sentences = [s.strip() for s in sentences if s.strip()]
    return ". ".join(sentences[:max_sentences]) + ("." if sentences else "")
