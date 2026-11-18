# AI Health Monitoring System

> [!CAUTION]
> **Medical Disclaimer:** This application is an AI-assisted health information tool for general educational purposes only. It is **NOT** a medical device, does **NOT** provide medical diagnoses or prescriptions, and is **NOT** clinically validated or regulator-approved. Always consult a qualified healthcare professional for medical concerns. In an emergency in India, call **112** or **108** immediately.

A full-stack, security-first AI Health Monitoring & Assistance platform built with **React + TypeScript + Vite**, **Python FastAPI**, **Supabase (PostgreSQL + Auth + Storage + RLS)**, and **Google Gemini 4 Hydrogen** (`google-genai` Interactions API).

---

## Key Capabilities

- **Intelligent AI Health Assistant & 10-Step Query Solution Engine** — Multi-turn natural-language health conversations powered by `gemini-4-hydrogen` with structured educational explanations, safe next steps, precautions, and doctor-consultation guidance.
- **Deterministic Pre-AI Emergency Safety Layer** — Independent keyword & regex screening across 9 life-threatening categories (cardiac, respiratory, neurological/stroke, anaphylaxis, loss of consciousness, severe bleeding, poisoning, trauma, mental health crisis) that short-circuits BEFORE any LLM call and immediately surfaces emergency contacts (`112`, `108`, AASRA `9152987821`).
- **Multimodal Health Image Assistance** — Magic-byte validated image upload (JPG/PNG/WebP, <=10 MB) with non-diagnostic visual observation and strict safety guardrails.
- **Personal Health Dashboard & History** — Persisted conversation history, vital signs & symptom records, image analyses, search/sort controls, and AI-assisted summaries.
- **Downloadable PDF Health Reports** — Server-side ReportLab PDF generation clearly labeled as an AI-generated informational summary (never a medical certificate or diagnosis).
- **Security & Privacy Controls** — Supabase Auth JWT verification, Row-Level Security (RLS), rate limiting (`slowapi`), XSS sanitization (`bleach`), prompt-injection detection, response diagnosis-claim softening, log redaction, consent management, full JSON data export, and cascading account deletion.

---

## Architecture

```
React + TypeScript + Vite (Vercel)
        │  HTTPS / Bearer JWT
        ▼
Python FastAPI Backend (Google Cloud Run / Docker)
  ├── Security Middleware (CORS, Rate Limiting, Security Headers, JWT Auth)
  ├── Deterministic Emergency Screening Layer (Pre-AI)
  ├── Prompt Injection Guard & Input Sanitization
  ├── 10-Step Health Query Solution Engine ──▶ Google Gemini 4 Hydrogen (Interactions API)
  ├── Response Safety Validator (No Diagnosis / No Prescriptions / Mandatory Disclaimer)
  ├── Multimodal Image Analysis Service
  └── ReportLab PDF Generator
        │
        ▼
Supabase (PostgreSQL + RLS, Auth, Private Storage Buckets)
```

---

## Quick Start (Local Development)

### 1. Database Setup (Supabase)
1. Create a Supabase project at https://supabase.com.
2. Run [backend/supabase_schema.sql](backend/supabase_schema.sql) in the Supabase SQL Editor.
3. Create two **private** Storage buckets: `health-images` and `health-reports`.

### 2. Backend Setup (FastAPI)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
# Populate SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup (React + Vite)
```powershell
cd frontend
npm install
copy .env.example .env
# Populate VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL=/api
npm run dev
```

Visit `http://localhost:5173`.

---

## Automated Testing

```powershell
# Backend (100 unit, emergency, AI safety, PDF, image & security tests)
cd backend
.\.venv\Scripts\python.exe -m pytest -v

# Frontend (strict TypeScript + production bundle)
cd frontend
npm run build
npm audit --omit=dev
```

See [TESTING_REPORT.md](TESTING_REPORT.md) for actual test execution results.

---

## Project Documentation

| Document | Purpose |
|----------|---------|
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | Initial codebase & environment audit |
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | Architecture, diagrams, stack & deployment topology |
| [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) | 17-phase execution plan |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | PostgreSQL tables, RLS policies & storage buckets |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Complete REST API reference |
| [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md) | Security architecture & DPDPA readiness assessment |
| [HEALTHCARE_AI_SAFETY.md](HEALTHCARE_AI_SAFETY.md) | Medical AI safety policy & emergency protocols |
| [MCP_AND_PLUGIN_INVENTORY.md](MCP_AND_PLUGIN_INVENTORY.md) | Discovered MCP servers, plugins & AI models |
| [FUNCTIONALITY_AUDIT.md](FUNCTIONALITY_AUDIT.md) | Per-feature implementation & verification status |
| [TESTING_REPORT.md](TESTING_REPORT.md) | Executed test results & defect log |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Cloud Run + Vercel production deployment & rollback guide |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Engineering standards & PR checklist |

---

## Known Limitations

- **Not clinically validated or regulator-approved** — Informational tool only.
- **Live external integration requires user-provisioned keys** — `GEMINI_API_KEY` and Supabase project credentials must be added to `.env` before live AI chat, image analysis, and database persistence operate end-to-end.
- **Emergency contact verification** — Confirm Indian emergency numbers (`112`, `108`, `100`, `1800-11-6117`, `9152987821`) against official government sources prior to public launch.
