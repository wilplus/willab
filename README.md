# Willab — Simplified Coaching Homework App

Monorepo: **backend** (Flask → Railway) and **frontend** (Next.js → Vercel). See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for architecture, [BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md) for Git workflow, and **[DEPLOYMENT.md](./DEPLOYMENT.md)** for Railway + Vercel setup and env vars.

## Quick start

### Backend (Flask)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env        # fill Supabase, OpenAI, Resend
python app.py
```

Runs at `http://localhost:5000`. Health: `GET /health`.

### Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.local.example .env.local   # SUPABASE_*, NEXT_PUBLIC_API_URL
npm run dev
```

Runs at `http://localhost:3000`. Login uses Supabase Auth; API calls proxy to backend via `/api/homework/*`.

### Database

Run the SQL in `supabase/migrations/20250222000000_simplified_schema.sql` in your Supabase project (SQL editor or CLI).

## Repo layout

- `backend/` — Flask app, routes, services (db, openai, email, metrics, recording job)
- `frontend/` — Next.js App Router, homework flow (landing, recording, report), admin (to be completed)
- `supabase/migrations/` — Schema for sessions, recordings, reports, task_1 pool, exercises

## Student flow

1. **Landing** (`/homework`) — Show recommended exercise (if any); "Start homework".
2. **Recording** (`/homework/recording`) — Record audio; submit → processing → report.
3. **Report** (`/homework/report`) — Score, summary, coach reminder.

Live metrics (pacing, voice strength, transcript, fillers) during recording are implemented (client-side voice strength; server-side WPM/transcript/fillers via stream-chunk).
