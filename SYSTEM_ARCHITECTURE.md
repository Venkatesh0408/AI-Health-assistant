# SYSTEM ARCHITECTURE — AI Health Monitoring System

**Version:** 1.0  
**Date:** 2026-11-18

---

## 1. Architecture Overview

```mermaid
flowchart TD
    subgraph Client["Frontend (React + Vite + TypeScript)"]
        UI["UI Components"]
        AuthUI["Auth Pages"]
        ChatUI["Health Chat"]
        ImageUI["Image Upload"]
        DashUI["Dashboard"]
        ReportUI["Reports"]
    end

    subgraph API["Backend (Python FastAPI)"]
        Router["API Router"]
        AuthMW["Auth Middleware"]
        RateLimit["Rate Limiter"]
        Validator["Input Validator"]

        subgraph Core["Core Services"]
            AuthSvc["Auth Service"]
            HealthSvc["Health Conversation Service"]
            QueryEngine["Query Solution Engine"]
            ImageSvc["Image Analysis Service"]
            EmergSvc["Emergency Detection Engine"]
            ReportSvc["Report Generator"]
            HistorySvc["History Service"]
            ProfileSvc["Profile Service"]
        end

        subgraph Safety["Safety Layer"]
            InputSafety["Input Safety Screen"]
            EmergDetect["Emergency Detector"]
            OutputSafety["Output Safety Validator"]
            PromptGuard["Prompt Injection Guard"]
        end

        subgraph AI["AI Service Layer"]
            GeminiClient["Gemini API Client"]
            ContextMgr["Context Manager"]
            PromptBuilder["Prompt Builder"]
            ResponseParser["Response Parser"]
        end
    end

    subgraph Data["Data Layer"]
        Supabase["Supabase PostgreSQL"]
        Storage["Supabase Storage"]
        Cache["In-Memory Cache"]
    end

    subgraph External["External Services"]
        Gemini["Google Gemini 4 Hydrogen API"]
    end

    Client -->|HTTPS| Router
    Router --> AuthMW --> RateLimit --> Validator
    Validator --> Core
    Core --> Safety
    Safety --> AI
    AI --> Gemini
    Core --> Data
    ImageSvc --> Storage
```

---

## 2. Technology Decisions

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | React 18 + TypeScript + Vite | User familiarity, type safety, fast dev builds |
| **UI Components** | Shadcn/ui + Tailwind CSS | Accessible, composable, no vendor lock-in |
| **Backend** | Python 3.12 + FastAPI | Per requirements, async support, Pydantic validation |
| **Database** | Supabase (PostgreSQL 15+) | User experience with Supabase, RLS, built-in auth, storage |
| **Authentication** | Supabase Auth | Email/password, email verification, password recovery, JWT |
| **AI Model** | Gemini 4 Hydrogen | Multimodal (text + image), 1M token context, balanced cost |
| **AI SDK** | google-genai >= 3.2.0 (Python) | Official Google SDK, structured output, interactions API |
| **Image Storage** | Supabase Storage | Unified with database, RLS on buckets, CDN |
| **PDF Generation** | ReportLab (Python) | Server-side PDF, no browser dependency |
| **Deployment - Frontend** | Vercel | Static/SPA hosting, CDN, preview deploys |
| **Deployment - Backend** | Google Cloud Run | Docker container, auto-scaling, HTTPS |
| **Secrets** | Environment variables (.env) | Standard, no cloud-specific dependency initially |

---

## 3. AI Processing Pipeline

```mermaid
flowchart LR
    A["User Input\n(text + optional image)"] --> B["Input Validation\n& Sanitization"]
    B --> C["Prompt Injection\nDetection"]
    C --> D{"Emergency\nKeyword\nDetector"}
    D -->|Emergency| E["Emergency Response\n(deterministic)"]
    D -->|Normal| F["Context Retrieval\n(conversation history)"]
    F --> G["Prompt Construction\n(system + context + query)"]
    G --> H["Gemini API Call\n(structured output)"]
    H --> I["Response Parsing\n& Validation"]
    I --> J["Safety Post-Check\n(no diagnosis claims)"]
    J --> K["Final Response\nto User"]
```

> [!IMPORTANT]
> Emergency detection uses a **deterministic keyword/pattern layer first**, not just the LLM. This ensures life-threatening symptom patterns are caught even if the AI model fails.

---

## 4. Database Schema (High-Level)

```mermaid
erDiagram
    users ||--o{ conversations : has
    users ||--o{ health_records : has
    users ||--o{ image_analyses : has
    users ||--o{ health_reports : has
    users ||--|| user_profiles : has
    users ||--|| privacy_settings : has
    conversations ||--o{ messages : contains

    users {
        uuid id PK
        text email
        timestamp created_at
        timestamp updated_at
    }

    user_profiles {
        uuid id PK
        uuid user_id FK
        text display_name
        date date_of_birth
        text gender
        jsonb medical_conditions
        jsonb allergies
        timestamp updated_at
    }

    conversations {
        uuid id PK
        uuid user_id FK
        text title
        text status
        timestamp created_at
        timestamp updated_at
    }

    messages {
        uuid id PK
        uuid conversation_id FK
        text role
        text content
        jsonb metadata
        text image_url
        timestamp created_at
    }

    health_records {
        uuid id PK
        uuid user_id FK
        text record_type
        jsonb data
        text source
        timestamp recorded_at
        timestamp created_at
    }

    image_analyses {
        uuid id PK
        uuid user_id FK
        uuid conversation_id FK
        text image_path
        text question
        text analysis
        jsonb metadata
        timestamp created_at
    }

    health_reports {
        uuid id PK
        uuid user_id FK
        text report_type
        jsonb content
        text pdf_path
        timestamp generated_at
    }

    privacy_settings {
        uuid id PK
        uuid user_id FK
        boolean data_collection_consent
        boolean ai_processing_consent
        timestamp consent_updated_at
    }
```

---

## 5. API Design

### Core Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/forgot-password` | Password recovery |
| GET | `/api/auth/verify-email` | Email verification |
| GET | `/api/users/profile` | Get user profile |
| PUT | `/api/users/profile` | Update user profile |
| DELETE | `/api/users/account` | Delete account + all data |
| GET | `/api/users/export` | Export all user data |
| POST | `/api/chat/conversations` | Start new conversation |
| GET | `/api/chat/conversations` | List conversations |
| GET | `/api/chat/conversations/:id` | Get conversation |
| POST | `/api/chat/conversations/:id/messages` | Send message (AI responds) |
| DELETE | `/api/chat/conversations/:id` | Delete conversation |
| POST | `/api/images/upload` | Upload health image |
| POST | `/api/images/analyze` | Analyze uploaded image with question |
| GET | `/api/images/analyses` | List past analyses |
| GET | `/api/health/records` | Get health records |
| POST | `/api/health/records` | Add health record (vitals, etc.) |
| GET | `/api/health/summary` | Get health summary |
| POST | `/api/reports/generate` | Generate PDF report |
| GET | `/api/reports` | List generated reports |
| GET | `/api/reports/:id/download` | Download PDF report |
| GET | `/api/privacy/settings` | Get privacy settings |
| PUT | `/api/privacy/settings` | Update privacy settings |

---

## 6. Security Architecture

```mermaid
flowchart TD
    Request["Incoming Request"] --> HTTPS["HTTPS/TLS"]
    HTTPS --> CORS["CORS Validation"]
    CORS --> Rate["Rate Limiting\n(100 req/min general\n10 req/min AI)"]
    Rate --> JWT["JWT Verification\n(Supabase Auth)"]
    JWT --> RLS["Row-Level Security\n(user can only access own data)"]
    RLS --> Input["Input Validation\n(Pydantic schemas)"]
    Input --> Sanitize["Input Sanitization\n(XSS, injection)"]
    Sanitize --> PromptGuard["Prompt Injection Guard\n(AI input screening)"]
    PromptGuard --> Handler["Request Handler"]
    Handler --> Response["Response\n(no PII in logs)"]
```

---

## 7. Frontend Page Architecture

| Page | Route | Auth Required |
|------|-------|---------------|
| Landing | `/` | No |
| Login | `/login` | No |
| Register | `/register` | No |
| Dashboard | `/dashboard` | Yes |
| Health Chat | `/chat` | Yes |
| Chat Session | `/chat/:id` | Yes |
| Image Analysis | `/images` | Yes |
| Health History | `/history` | Yes |
| Health Reports | `/reports` | Yes |
| User Profile | `/profile` | Yes |
| Privacy Settings | `/privacy` | Yes |
| Emergency Info | `/emergency` | No |
| About & Disclaimer | `/about` | No |

---

## 8. Deployment Topology

```mermaid
flowchart LR
    subgraph User["End User"]
        Browser["Web Browser"]
    end

    subgraph Vercel["Vercel (Frontend)"]
        CDN["CDN + Edge"]
        SPA["React SPA"]
    end

    subgraph GCP["Google Cloud"]
        CloudRun["Cloud Run\n(FastAPI Container)"]
    end

    subgraph Supabase["Supabase"]
        DB["PostgreSQL"]
        Auth["Auth Service"]
        Store["Object Storage"]
    end

    subgraph Google["Google AI"]
        GeminiAPI["Gemini 4 Hydrogen"]
    end

    Browser -->|HTTPS| CDN --> SPA
    SPA -->|API calls| CloudRun
    CloudRun --> DB
    CloudRun --> Auth
    CloudRun --> Store
    CloudRun --> GeminiAPI
```
