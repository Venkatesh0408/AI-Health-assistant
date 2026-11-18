# DEPLOYMENT GUIDE — AI Health Monitoring System

> [!CAUTION]
> **Do not deploy to public production until all pre-deployment checks pass** (environment secrets configured, Supabase RLS enabled, emergency numbers verified, automated tests passing, and explicit deployment approval granted).

---

## 1. Prerequisites

1. **Supabase Project** (https://supabase.com)
   - Create a project in your target region (e.g., `ap-south-1` / Mumbai for Indian users).
   - Run [supabase_schema.sql](file:///C:/Users/venka/.gemini/antigravity/scratch/ai-health-monitor/backend/supabase_schema.sql) in the Supabase SQL Editor.
   - Create two **private** storage buckets: `health-images` and `health-reports` with owner-only folder policies (`auth.uid()::text = (storage.foldername(name))[1]`).
   - Collect `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
2. **Google Gemini API Key** (https://aistudio.google.com/apikey)
   - Provision a key with access to `gemini-4-hydrogen`.
3. **Cloud Accounts**
   - **Backend:** Google Cloud Project with Cloud Run + Artifact Registry + Secret Manager enabled.
   - **Frontend:** Vercel account connected to the GitHub repository.

---

## 2. Local Development Setup

### Backend (FastAPI)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
# Edit .env with your SUPABASE_* and GEMINI_API_KEY values
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### Frontend (React + Vite)
```powershell
cd frontend
npm install
copy .env.example .env
# Edit .env with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL=/api
npm run dev
```
Open `http://localhost:5173`. Vite proxies `/api/*` requests to `http://localhost:8000`.

---

## 3. Backend Deployment — Google Cloud Run

### Build and Test Docker Image Locally
```bash
cd backend
docker build -t ai-health-monitor-backend .
docker run -p 8000:8000 --env-file .env ai-health-monitor-backend
```

### Deploy to Cloud Run (Requires `gcloud` CLI & Approval)
1. Store secrets in Google Secret Manager (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_SECRET_KEY`).
2. Build & push container to Artifact Registry:
   ```bash
   gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/ai-health-monitor/backend:latest ./backend
   ```
3. Deploy service:
   ```bash
   gcloud run deploy ai-health-monitor-backend \
     --image REGION-docker.pkg.dev/PROJECT_ID/ai-health-monitor/backend:latest \
     --region asia-south1 \
     --platform managed \
     --allow-unauthenticated \
     --set-env-vars "APP_ENV=production,FRONTEND_URL=https://your-frontend.vercel.app,SUPABASE_URL=https://your-project.supabase.co,SUPABASE_ANON_KEY=..." \
     --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,APP_SECRET_KEY=APP_SECRET_KEY:latest"
   ```
4. Verify `/api/health` returns `200 OK` over HTTPS, and confirm `/api/docs` returns `404` in production (`APP_ENV=production`).

---

## 4. Frontend Deployment — Vercel

1. Import the repository in Vercel and set **Root Directory** to `frontend`.
2. Framework preset: **Vite** (`npm run build`, output directory `dist`).
3. Configure Environment Variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL=https://<your-cloud-run-url>/api`
4. `frontend/vercel.json` handles SPA rewrites and security headers.

---

## 5. Pre-Deployment Verification Checklist

- [ ] All secrets stored in Secret Manager / Vercel Env (never in git)
- [ ] `APP_ENV=production` disables OpenAPI docs and hides internal exception details
- [ ] Supabase RLS verified across all 7 tables
- [ ] Private storage buckets enforced for `health-images` and `health-reports`
- [ ] HTTPS enforced end-to-end; CORS restricted to exact frontend origin
- [ ] Indian emergency numbers (`112`, `108`, `100`, `1800-11-6117`, `9152987821`) verified via official sources
- [ ] Privacy policy, medical disclaimer, consent toggles, export, and cascading account deletion tested
- [ ] Automated backend & frontend tests executed and passing
- [ ] Cloud Run monitoring/alerts & rollback revision verified

---

## 6. Rollback Plan

- **Cloud Run:** Route 100% traffic back to the previous known-good revision via `gcloud run services update-traffic ai-health-monitor-backend --to-revisions PREVIOUS_REV=100`.
- **Vercel:** Promote the previous production deployment from the Vercel dashboard or CLI.
- **Database:** Apply additive migrations only; take a Supabase point-in-time backup before schema changes.
