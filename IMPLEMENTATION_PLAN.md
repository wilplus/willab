# Simplified Coaching Homework App — Implementation Plan

This document outlines the architecture and design for a minimal viable coaching homework application: real-time recording with live metrics, automatic scoring, minimal reporting, coach feedback via email, and a streamlined admin panel. The plan is based on your described stack (Flask, Supabase, Next.js, OpenAI, Resend) and assumes alignment with your actual schema once the codebase is available.

---

## 1. Real-Time Recording Architecture

### Problem
Current flow processes audio only after full upload. The goal is to show **live** pacing, voice strength, transcription, and filler-word count during recording.

### Recommended Approach: Chunked Upload + Server-Side Streaming Processing

**Why not pure WebSocket end-to-end?**
- Whisper and most speech APIs expect full or large chunks; true “streaming ASR” would require a different stack (e.g. Deepgram/AssemblyAI streaming or Whisper with chunked inference), adding cost and complexity.
- A pragmatic approach: stream **audio chunks** from the client to the backend, run **batched** transcription and metrics on the server, and stream **results** back so the UI updates in near real-time without waiting for the full recording to finish.

**Architecture**

1. **Client**
   - Use `MediaRecorder` with a slice interval (e.g. every 3–5 seconds) to produce blobs.
   - Send each blob to the backend via `POST /v2/homework/recordings/stream-chunk` (or a single persistent connection—see below).
   - Optional: use a single **WebSocket** from client to backend: client sends binary audio chunks; backend responds with JSON updates (transcript segment, filler count delta, pacing/volume for that window). This avoids many HTTP requests and keeps one connection.

2. **Backend**
   - **Option A (simpler):** Chunked HTTP  
     - `POST /v2/homework/recordings/stream-chunk`  
     - Body: `session_id`, `sequence_index`, `audio` (binary or base64).  
     - Server appends to a temp buffer (or writes to a temp file), runs Whisper on the **last N seconds** (e.g. last 10–15 s) periodically, and returns incremental transcript + filler count for that segment.  
     - Client polls or uses Server-Sent Events (SSE) for “live” updates if you don’t want to hold the request open.
   - **Option B (better UX):** WebSocket  
     - `WS /v2/homework/recordings/live`  
     - Client sends binary audio chunks (e.g. every 3 s).  
     - Server runs short-window analysis (e.g. 5–10 s) and pushes back:  
       `{ type: "metrics", pacing, voiceStrength, transcriptSegment, fillerCount }`.  
     - Keeps one connection, lower latency, simpler client logic.

3. **Processing strategy**
   - **Pacing:** Compute on server over the last 10–15 s of audio: words per minute (from transcript timestamps or word count / duration). Send current WPM to client for gauge.
   - **Voice strength:** RMS or normalized volume over the same window (from raw audio or a simple library). Send 0–100 or similar for meter.
   - **Transcription:** Run Whisper on the **accumulated** buffer every 5–10 s (overlap optional), return only the **new** segment to avoid duplication; append on client.
   - **Filler words:** Regex or small NLP on the new transcript segment (e.g. “um”, “uh”, “like”); maintain running total and send delta.

4. **Final recording**
   - When user stops recording, client sends “end” (e.g. last WebSocket message or `POST .../stream-finalize` with session_id).
   - Backend runs **full** Whisper on the complete audio, computes **final** metrics and filler count, runs scoring (starting metric − 5 × fillers), generates 3-sentence summary, stores in `recordings_v2` and `homework_reports_v2`, and triggers email when coach feedback is ready (or immediate report email; coach feedback email when coach submits).

### Infrastructure
- **Railway:** Supports WebSockets; ensure no proxy strips `Upgrade` headers.
- **Supabase:** Not involved in real-time audio path; only final results and metadata are written to DB/storage.
- **OpenAI:** Whisper called per chunk (or per overlapping window) for live view; once for full audio at finalize. Be mindful of rate limits and cost; chunk size and frequency are tunable.

### Summary
- **Recommended:** WebSocket for live stream; server runs short-window Whisper + simple pacing/volume logic; push metrics and transcript segments to client; on “stop”, run full pipeline and persist.
- **Fallback:** Chunked HTTP upload with optional SSE for updates if WebSocket is not desired.

---

## 2. Metrics Calculation

### Starting metric (baseline)
- **Definition:** A single number representing the student’s “baseline” for this exercise (e.g. 100 or 80). Options:
  - **Fixed:** e.g. 100 for everyone.
  - **Per-exercise:** Each exercise has a `default_starting_metric` (e.g. 80 for “persuasion”, 100 for “pitch”).
  - **Per-student override:** `student_overrides_v2.starting_metric` (or new `student_exercise_assignments.starting_metric`).
- **Recommendation:** Store `starting_metric` on the **assignment** (e.g. “exercise X assigned to student Y with baseline 85”). Default from exercise or global (e.g. 100) if not set.

### Scoring formula
- **Score = starting_metric − (5 × filler_word_count)**  
- Floor at 0 (or allow negative if you want to show “below baseline”).  
- Filler list: configurable (e.g. “um”, “uh”, “like”, “you know”, “so”) in code or in DB; same list for real-time and final count.

### Pacing (real-time)
- **Metric:** Words per minute (WPM).
- **Computation:** From Whisper output: word count in the last 10–15 s window ÷ duration in minutes. If Whisper returns timestamps, use them for accuracy; else use (word_count / segment_duration_sec) * 60.
- **Display:** Gauge or number; optional target range (e.g. 120–150 WPM) from exercise or global config.

### Voice strength (real-time)
- **Metric:** Relative volume / energy (0–100 or “quiet / medium / loud”).
- **Computation:** RMS (root mean square) of the audio samples in the same sliding window, normalized (e.g. clip and scale to 0–100). Use a simple Python lib (e.g. `numpy` or `audioop`); no need for Whisper for this.
- **Display:** Vertical bar or “strength” meter.

### Persistence
- **Final values:** Store in `recordings_v2` or `homework_reports_v2`: `final_wpm`, `final_voice_strength` (optional), `filler_count`, `starting_metric`, `score`, `summary` (3 sentences).

---

## 3. Simplified Data Model

### Tables to keep (and trim)

| Table | Keep | Changes |
|-------|------|--------|
| **homework_sessions_v2** | Yes | Add `recommended_exercise_id` (FK to exercises_pool) if not present. Ensure `status` reflects: `not_started`, `recording`, `processing`, `completed`. |
| **recordings_v2** | Yes | Add fields for final metrics: `wpm`, `voice_strength` (optional), `filler_count`, `starting_metric`, `score`. Keep `transcript`, `storage_path`. |
| **student_overrides_v2** | Yes → possibly rename | Use for “student context” (coach notes) and per-student overrides (e.g. starting_metric). Add or repurpose: `coach_notes` / `context_text`. |
| **homework_reports_v2** | Yes | Add `coach_feedback_text`, `summary` (3-sentence), `score`, `starting_metric`, `filler_count`. Link to session/recording. |
| **exercises_pool** | Yes | Id, name, description, `default_starting_metric`, maybe `target_wpm_min/max`. |
| **warm_up_pool** / **focus_pool** | Repurpose one as **task_1 pool** | Single “task_1” pool: id, title/description, active. No scoring; used only for “what to do” in homework email. |

### Tables/fields to remove or deprecate
- Any tables/columns that supported steps 2–4 (e.g. second recording, warm-up vs focus distinction) can be dropped or ignored in the new flow.
- Remove or ignore: extra recording slots, step-specific tables that no longer apply.

### New fields (summary)
- **Session:** `recommended_exercise_id` (nullable).
- **Report:** `coach_feedback_text`, `summary`, `score`, `starting_metric`, `filler_count`.
- **Recording:** `wpm`, `voice_strength`, `filler_count`, `starting_metric`, `score`.
- **Student/overrides:** `coach_notes` or `context_text` (free text for coach).
- **Assignment:** If you don’t have “exercise assigned to student”, add a simple link: e.g. `student_exercise_assignments (student_id, exercise_id, assigned_at)` or store `recommended_exercise_id` on the session when coach sends homework.

### Task_1 pool
- One table (e.g. `task_1_pool`): `id`, `title`, `body` or `description`, `active`, `sort_order`. Used when composing “send homework” to pick one task for the email; not scored.

---

## 4. API Endpoints

### Student (homework)

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/v2/homework/status` | Current session state + recommended exercise (id, name, description). Returns step 0 payload or “in progress” / “report ready”. |
| POST | `/v2/homework/start` | Create or resume session; return `session_id`, `exercise` (if any), `step`. |
| WS | `/v2/homework/recordings/live` | Real-time: send audio chunks; receive metrics + transcript + filler count. |
| POST | `/v2/homework/recordings/finalize` | End recording; trigger full processing, scoring, report generation. Optional: sync wait or 202 + poll. |
| GET | `/v2/homework/report` | Get report for current session: score, summary, coach reminder (e.g. “Coach will contact within 24h”). |

(If not using WebSocket: replace with `POST .../stream-chunk` and optionally `GET .../stream-updates` or SSE for live updates.)

### Admin

| Method | Path | Purpose |
|--------|------|--------|
| POST | `/v2/admin/send-homework` | Body: `student_id`, `task_1_id`, optional `exercise_id`. Send homework email, create session with `recommended_exercise_id`. |
| GET | `/v2/admin/students/:id/context` | Get coach notes for student. |
| PUT | `/v2/admin/students/:id/context` | Set coach notes (free text). |
| GET | `/v2/admin/task-1-pool` | List task_1 items. |
| POST | `/v2/admin/task-1-pool` | Create task_1. |
| PUT | `/v2/admin/task-1-pool/:id` | Update; PATCH or DELETE as needed. |
| GET | `/v2/admin/exercises` | List exercises. |
| POST | `/v2/admin/exercises` | Create exercise. |
| PUT | `/v2/admin/exercises/:id` | Update; assign to students via send-homework or separate endpoint. |
| GET | `/v2/admin/reports` | List past session reports (with session/student info). |
| GET | `/v2/admin/reports/:id` | Report detail (same view as student). |
| PUT | `/v2/admin/reports/:id/feedback` | Submit coach feedback text; trigger “feedback” email to student with link back. |

Auth for all: Supabase JWT; admin routes check role or allowlist (e.g. coach email).

---

## 5. Frontend Components

### Layout / shell
- **Navbar:** Small “willab” logo (link to “step 0” or dashboard), “Book a Lesson” (external link), “Contact Support” (mailto:artur@willonski.com), “Log Out” (Supabase signOut + redirect).
- **Layout:** Single column; navbar fixed or sticky; content below.

### Student flow

1. **Step 0 — Landing (e.g. `HomeworkLanding` or `Home`)**
   - If `recommended_exercise_id` present: show exercise name + short description; primary CTA: “Start homework”.
   - If none: “No homework assigned. Your coach will send you an exercise soon.” (no start button or disabled).
   - On “Start”: call `POST /v2/homework/start`, then navigate to recording view.

2. **Recording view — “Sniper view” (e.g. `RecordingView`)**
   - Open WebSocket (or start chunked upload) when entering view; show:
     - **Pacing gauge:** Current WPM (from server).
     - **Voice strength meter:** 0–100 bar.
     - **Live transcript:** Append-only text from server.
     - **Filler counter:** “Fillers: N”.
   - Record button: start/stop MediaRecorder; on stop, send finalize and navigate to report when ready (poll or WebSocket “report_ready”).

3. **Report view (e.g. `ReportView`)**
   - Fetch `GET /v2/homework/report`.
   - Show: **Score** (large), **Summary** (max 3 sentences), line: “Your coach will contact you within 24 hours.”
   - No edit; read-only. After coach sends feedback email, student returns to app → step 0 (new session).

### Admin panel

1. **Send homework**
   - Form: select student, select task_1 from pool, optionally select exercise. Submit → `POST /v2/admin/send-homework`.

2. **Student context**
   - When a student is selected (or on “student detail”): free-text area; save → `PUT /v2/admin/students/:id/context`.

3. **Task_1 pool**
   - List rows; add / edit / deactivate (GET/POST/PUT task-1-pool).

4. **Exercise pool**
   - List exercises; add / edit; assign to students via send-homework or separate “assign” control (GET/POST/PUT exercises).

5. **Historical reports**
   - Below send-homework: list of past reports (session date, student, score). Row click → open **modal** with same content as student report view (score, summary, coach reminder); optional: show coach_feedback_text if already sent.

6. **Coach feedback**
   - From report modal or report list: “Send feedback” opens text area; submit → `PUT /v2/admin/reports/:id/feedback` → backend sends email with feedback + link.

Use Radix UI for modal, forms, and list; Tailwind for layout and styling. Keep components small and by feature (e.g. `RecordingMetrics`, `LiveTranscript`, `FillerCounter`).

---

## 6. Email Template (Coach feedback)

**When:** Coach submits feedback (e.g. after viewing report).

**To:** Student email.

**From:** Your Resend domain (e.g. homework@willab.com or noreply@…).

**Subject:** e.g. “Your homework feedback from [Coach name]” or “Willab — Coach feedback on your exercise”.

**Body structure:**
1. Short greeting: “Hi [First name],”
2. **Coach’s written feedback** (plain text or simple HTML): `coach_feedback_text`.
3. **Summary block:** “Your score: [score]. Summary: [3-sentence summary].”
4. **CTA:** “View your result and do your next homework: [Link to app root]” (e.g. https://app.willab.com or /homework). Link should land on step 0 (session reset or new session).
5. Footer: e.g. “— Willab” or support contact.

Use Resend’s React email or HTML template; pass in `student_name`, `coach_feedback_text`, `score`, `summary`, `return_link`.

**Homework-assignment email** (when coach sends homework): Subject “Your new homework from [Coach]”; body: task_1 text, assigned exercise name/description, and same “Start homework” link. Optional: include student name and coach name.

---

## 7. Navbar Implementation

- **Component:** e.g. `Navbar` or `AppNav`, in layout so it appears on all authenticated pages.
- **Logo:** Small “willab” text or image; link to `/` or `/homework` (step 0).
- **Links:**
  - “Book a Lesson” → external URL (e.g. Calendly or your booking link).
  - “Contact Support” → `mailto:artur@willonski.com`.
  - “Log Out” → call Supabase `signOut()`, then redirect to login or `/`.
- **Style:** Modest, minimal (Tailwind); optional mobile hamburger if needed.

---

## 8. Migration Path

**Recommendation: Refactor in place** so you keep Supabase auth, existing DB, and deployment (Railway). A full rewrite increases risk and time without much benefit if the stack stays the same.

**Preserve:**
- Auth: Supabase client and JWT validation in Flask and Next.js.
- `services/db.py`: Extend with new fields and a few new helpers; keep existing get_session, get_report, etc.
- `services/openai_service.py`: Whisper and GPT calls; add a “short transcript + filler” helper for live window; keep full transcript + summary for finalize.
- `services/email_service.py`: Resend; add templates for (1) homework assigned, (2) coach feedback with return link.
- `services/metrics_v2.py`: Integrate starting_metric and score = starting_metric − 5×fillers; add WPM/voice from final transcript/audio if needed.
- Storage: Supabase bucket for final recording file (and optionally temp chunks if you buffer on server).
- BFF pattern: Next.js API routes that proxy to Flask with auth.

**Remove or simplify:**
- All routes and UI for old steps 2–4 (second recording, extra questions).
- Unused tables or columns (after migration).
- Complex branching in session state (reduce to: not_started → recording → processing → completed).

**Add:**
- WebSocket or chunked endpoint for live recording (see §1).
- New endpoints in §4 (status with exercise, finalize, report, admin context, task_1 pool, reports list/detail, feedback).
- Frontend: step 0 with exercise, recording view with real-time metrics, report view, admin sections as in §5.
- DB migrations: new columns and task_1_pool (or repurpose focus_pool) and any assignment table.

**Order of work (suggested):**
1. DB migrations (new columns, task_1 pool).
2. Backend: status + start + report GET; then finalize + recording_1_job (unchanged concept, new scoring).
3. Backend: live WebSocket or chunked endpoint + short-window processing.
4. Frontend: Navbar, step 0, report view (without live metrics first).
5. Frontend: Recording view with live metrics (integrate WebSocket/chunked).
6. Admin: send-homework, context, task_1 pool, exercises, reports list + modal + feedback.
7. Emails: homework-assignment and coach-feedback templates and triggers.

---

## 9. Edge Cases

| Scenario | Handling |
|----------|----------|
| **Student refreshes during recording** | Session remains “recording”; buffer is server-side. On reload, either: (a) show “Recording in progress” and allow “Resume” (reconnect WebSocket and continue sending chunks—complex), or (b) show “Recording was interrupted. Start again?” and allow starting a new recording for the same session (simpler). Prefer (b) unless you need long, resumable recordings. |
| **Coach sends homework before previous session completed** | Allow it: create a new session with new `recommended_exercise_id`. Student sees latest assignment on step 0; old session can stay “in progress” or be marked “superseded” and hidden from status. |
| **Real-time processing failures** | If Whisper or metrics fail for a window: return error in WebSocket/response; client shows “Metrics temporarily unavailable” but keeps recording. Finalize still runs full pipeline; if finalize fails, show “Processing failed. Try again or contact support.” and optionally retry. |
| **Exercise not assigned (step 0)** | `recommended_exercise_id` null: show “No homework assigned” and no “Start” button (or disabled). No 404; just empty state. |
| **Multiple tabs** | Optional: store “active_recording_session_id” in session; if user opens second tab, show “Finish recording in the other tab” or force one tab to be canonical (e.g. via BroadcastChannel). |
| **Browser doesn’t support MediaRecorder / WebSocket** | Feature-detect; show message “Use a modern browser (Chrome, Firefox, Safari, Edge).” |
| **Very long recording** | Cap duration (e.g. 5 min) in UI; server can reject or trim to max length to control cost and storage. |
| **Coach feedback already sent** | Report modal shows feedback text and “Feedback sent on [date]”; hide or disable “Send feedback” or show “Update feedback” (optional). |

---

## 10. Deployment & Hosting

### Single repo (monorepo) + branching

- **One repository** holds both backend (Flask) and frontend (Next.js). This is the same approach many teams use: one repo, one source of truth, with a branching strategy (see [BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md)) so production stays stable.
- **Backend** is deployed from this repo to **Railway**; **frontend** to **Vercel**. Both platforms can use the same repo and branch (e.g. `main`) or different branches (e.g. Vercel previews from `develop` or feature branches).

### Repo layout (monorepo)

```
willab/
├── backend/          # Flask app → Railway
│   ├── app.py
│   ├── requirements.txt
│   ├── routes/
│   └── services/
├── frontend/         # Next.js app → Vercel
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── next.config.js
├── BRANCHING_STRATEGY.md
└── IMPLEMENTATION_PLAN.md
```

- **Railway:** Set root directory to `backend` (or use a build command that runs from repo root with `backend` as cwd). Railway deploys on push to the branch you connect (typically `main`).
- **Vercel:** Set root directory to `frontend`. Vercel will build and deploy the Next.js app; connect the same repo and production branch (e.g. `main`). Preview deployments can use other branches or PRs.

### Branch → deployment mapping

| Branch   | Backend (Railway)     | Frontend (Vercel)      |
|----------|------------------------|------------------------|
| **main** | Production API         | Production app         |
| **develop** | Optional staging API* | Preview / staging app* |
| **release/\*** | Usually not deployed | Usually not deployed   |
| **feature/\*** | Preview (if configured) | Preview (PR)          |

\* Configure Railway and Vercel so that **main** = production. Optionally add a second Railway “staging” project and Vercel preview that track **develop** for pre-release testing.

### Railway (backend)

- Supports WebSockets; ensure the process uses a single worker or sticky connections if you scale.
- Set env vars in Railway dashboard: Supabase URL/key, OpenAI key, Resend key, `APP_URL` (frontend URL for emails), etc.
- Build: `pip install -r requirements.txt` (from `backend/`). Start: `gunicorn app:app` or `python app.py` (with WSGI + WebSocket if needed).

### Vercel (frontend)

- Build: `npm run build` (from `frontend/`). Output: default Next.js output.
- Env vars: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL` (backend URL, e.g. Railway). Frontend calls backend via this URL (and BFF routes if you keep them).
- No special config for CORS if frontend and backend are on different origins; set `Access-Control-Allow-Origin` on Flask for the Vercel domain.

### Other deployment notes

- **Supabase:** No change for real-time features; auth and DB as today.
- **Storage:** Same bucket for final files; temp chunks in a separate prefix/bucket with TTL if needed.
- **OpenAI:** Limit concurrency of Whisper; consider a queue for finalize under load.
- **Resend:** “From” domain verified; templates for homework and coach feedback.
- **Branch protection:** Require 2–3 approvals for PRs into `main`; see [BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md).

---

## Summary

- **Real-time:** WebSocket (or chunked HTTP) from client to Flask; server runs short-window Whisper + pacing/volume; push metrics and transcript to client; finalize with full Whisper + scoring and report.
- **Metrics:** Starting metric (from assignment/exercise); score = starting_metric − 5×fillers; WPM and voice strength for display only (and stored on final record).
- **Data:** Keep core tables; add recommended_exercise_id, coach_notes, coach_feedback_text, summary, score, filler_count, task_1 pool.
- **APIs:** Minimal student (status, start, live, finalize, report) and admin (send-homework, context, task_1, exercises, reports, feedback).
- **Frontend:** Step 0, recording “sniper” view, report view, admin sections and report modal; navbar with logo, Book a Lesson, Contact Support, Log Out.
- **Email:** Homework-assignment and coach-feedback with return link.
- **Migration:** Refactor in place; preserve auth, DB layer, OpenAI, email, storage; add live path and new endpoints/UI; remove old steps.
- **Edge cases:** Refresh → “Start again”; allow new homework; graceful degradation for live failures; no exercise → empty state.
- **Deployment:** Single repo (monorepo): **backend** → Railway, **frontend** → Vercel; **main** = production. Use the branching strategy in [BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md) (main, develop, release, feature, hotfix) with 2–3 approvals for PRs into main.

This plan should give you a clear path to a minimal, maintainable coaching homework app with real-time feedback and a clean student–coach loop.

---

## Appendix: Code Structure Recommendations

**Backend (Flask)**  
- `app.py` or `main.py`: create app, register blueprints, attach WebSocket handler if used.  
- `routes/homework_v2.py`: student endpoints (status, start, report, finalize).  
- `routes/admin_v2.py`: admin endpoints (send-homework, context, task_1, exercises, reports, feedback).  
- `routes/recordings_ws.py` or inside homework_v2: WebSocket handler for `/v2/homework/recordings/live`.  
- `services/db.py`: all Supabase reads/writes; add `get_student_context`, `set_student_context`, `get_task_1_pool`, `get_reports_list`, etc.  
- `services/openai_service.py`: `transcribe_audio(audio_bytes)`, `transcribe_short_window(audio_bytes)` for live, `generate_summary(transcript)` for report.  
- `services/metrics_v2.py`: `compute_wpm(transcript_segment, duration_sec)`, `compute_voice_strength(audio_bytes)`, `count_fillers(transcript)`, `compute_score(starting_metric, filler_count)`.  
- `services/recording_1_job.py`: keep “finalize” pipeline: full transcribe → metrics → score → report row → optional email.  
- `services/email_service.py`: `send_homework_assignment(...)`, `send_coach_feedback(...)` with return link.

**Frontend (Next.js App Router)**  
- `app/(auth)/layout.tsx`: navbar + outlet.  
- `app/(auth)/homework/page.tsx`: step 0 (landing) or redirect to recording/report by status.  
- `app/(auth)/homework/recording/page.tsx`: recording view + WebSocket/chunked client.  
- `app/(auth)/homework/report/page.tsx`: report view.  
- `app/(auth)/admin/page.tsx`: admin layout; tabs or sections: Send homework, Student context, Task_1 pool, Exercises, Reports.  
- `components/homework/ExerciseCard.tsx`, `RecordingView.tsx`, `LiveMetrics.tsx`, `LiveTranscript.tsx`, `FillerCounter.tsx`, `ReportView.tsx`.  
- `components/admin/SendHomeworkForm.tsx`, `StudentContextEditor.tsx`, `Task1PoolTable.tsx`, `ExercisesTable.tsx`, `ReportsList.tsx`, `ReportModal.tsx`, `FeedbackForm.tsx`.  
- `components/layout/Navbar.tsx`: logo, Book a Lesson, Contact Support, Log Out.  
- `lib/api.ts` or `lib/homework.ts`: typed wrappers for `GET/POST /api/homework/*` and WebSocket.  
- `lib/admin-api.ts`: typed wrappers for `GET/POST/PUT /api/admin/*`.
