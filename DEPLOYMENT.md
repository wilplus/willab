# Deployment — Railway (backend) + Vercel (frontend)

Single repo; deploy backend and frontend separately. Production branch: `main`.

---

## Backend (Railway)

1. **New project** in [Railway](https://railway.app) → **Deploy from GitHub** → select this repo.
2. **Root directory:** In project Settings → set **Root Directory** to `backend` (so Railway builds from `backend/`).
3. **Build:** Railway (Nixpacks) will detect Python and run `pip install -r requirements.txt`. No extra build command needed unless you add one.
4. **Start:** Use the **Procfile** in `backend/`:
   - `web: gunicorn app:app --bind 0.0.0.0:$PORT`
   - Or in Railway dashboard set **Start Command** to: `gunicorn app:app --bind 0.0.0.0:$PORT`
5. **Env vars** (Railway → Variables):

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `SUPABASE_URL` | Yes | Supabase project URL (e.g. `https://zignvkswxvtvdzctpkcr.supabase.co`) |
   | `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (not anon) |
   | `OPENAI_API_KEY` | Yes | OpenAI API key (Whisper + GPT) |
   | `RESEND_API_KEY` | Yes | Resend API key |
   | `EMAIL_FROM` | Yes | Sender email (e.g. `homework@yourdomain.com`) — must be verified in Resend |
   | `APP_URL` | Yes | Frontend URL (e.g. `https://your-app.vercel.app`) for email links |
   | `COACH_EMAILS` | Recommended | Comma-separated emails allowed to access admin (e.g. `coach@example.com`) |
   | `CORS_ORIGINS` | Optional | Comma-separated frontend origins (e.g. `https://your-app.vercel.app`). If empty, CORS allows all. |
   | `DEFAULT_STARTING_METRIC` | Optional | Default 100 |
   | `POINTS_PER_FILLER` | Optional | Default 5 |
   | `FLASK_ENV` | Optional | `production` in prod |

6. **Domain:** In Railway, add a public domain and use that URL as `BACKEND_URL` / `NEXT_PUBLIC_API_URL` in the frontend. Example: `https://flask-backend-production-ab37.up.railway.app`

---

## Frontend (Vercel)

1. **New project** in [Vercel](https://vercel.com) → **Import** this repo.
2. **Root directory:** Set **Root Directory** to `frontend` (so Vercel builds the Next.js app).
3. **Framework:** Next.js is auto-detected. Build command: `npm run build`; output: `.next` (default).
4. **Env vars** (Vercel → Settings → Environment Variables):

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (e.g. `https://zignvkswxvtvdzctpkcr.supabase.co`) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
   | `NEXT_PUBLIC_API_URL` | Yes | Backend URL (e.g. `https://flask-backend-production-ab37.up.railway.app`) |

   Add these for **Production** (and Preview if you want the same API for PR previews).

5. **Domain:** Use the default Vercel URL or add a custom domain. This is your `APP_URL` in the backend.

---

## Checklist

- [ ] Backend: Root = `backend`, start = `gunicorn app:app --bind 0.0.0.0:$PORT`, all env vars set.
- [ ] Frontend: Root = `frontend`, `NEXT_PUBLIC_API_URL` = backend URL, Supabase vars set.
- [ ] Backend `APP_URL` = frontend URL (for email links).
- [ ] Resend: “From” domain verified.
- [ ] Supabase: Migration run (`supabase/migrations/20250222000000_simplified_schema.sql`).
- [ ] Branch: Deploy from `main` (or connect the branch you use for production).
