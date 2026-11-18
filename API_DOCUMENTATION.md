# API DOCUMENTATION — AI Health Monitoring System

**Base URL:** `/api` (development default: `http://localhost:8000/api`)  
**Interactive Docs (non-production):** `/api/docs` (Swagger UI) and `/api/redoc`  
**Authentication:** Bearer JWT (`Authorization: Bearer <supabase_access_token>`)

---

## System

### `GET /api/health`
Public liveness check.
- **Response `200`:** `{ "status": "healthy", "service": "ai-health-monitor-backend", "environment": "development", "timestamp": "..." }`

---

## Authentication (`/api/auth`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/api/auth/register` | Public | 100/min | Register a new account (`email`, `password`, `display_name`) |
| `POST` | `/api/auth/login` | Public | 100/min | Sign in with email & password, returns JWT session |
| `POST` | `/api/auth/logout` | Bearer | General | Invalidate current session |
| `POST` | `/api/auth/forgot-password` | Public | 10/min | Trigger password reset email (non-enumerating response) |
| `GET` | `/api/auth/verify-email` | Public | General | Verify signup email token (`?token=...&type=signup`) |

---

## AI Health Chat (`/api/chat`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/api/chat/conversations` | Bearer | General | Create a new conversation (`{ "title"?: string }`) |
| `GET` | `/api/chat/conversations` | Bearer | General | List active conversations (`page`, `page_size` or `limit`, `offset`) |
| `GET` | `/api/chat/conversations/{id}` | Bearer | General | Fetch conversation details with chronological messages |
| `POST` | `/api/chat/conversations/{id}/messages` | Bearer | 10/min | Send message (`content`, optional `image_url`); runs deterministic emergency screening BEFORE Gemini 4 Hydrogen |
| `DELETE` | `/api/chat/conversations/{id}` | Bearer | General | Soft-delete a conversation owned by the current user |

### `POST /api/chat/conversations/{id}/messages` Response (`201`)
```json
{
  "user_message": { "id": "...", "role": "user", "content": "...", "created_at": "..." },
  "assistant_message": { "id": "...", "role": "assistant", "content": "...", "metadata": {}, "created_at": "..." },
  "emergency": { "is_emergency": false, "category": null, "severity": "none" },
  "metadata": { "model": "gemini-4-hydrogen", "disclaimer_included": true },
  "conversation_title": "Headache since yesterday"
}
```

---

## Multimodal Image Assistance (`/api/images`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/api/images/upload` | Bearer | General | Multipart `file` upload; validates magic bytes (JPG/PNG/WebP), <=10 MB, stores in Supabase Storage |
| `POST` | `/api/images/analyze` | Bearer | 10/min | Multimodal AI observation (`image_url`, `question`, optional `conversation_id`); strictly non-diagnostic |
| `GET` | `/api/images/analyses` | Bearer | General | List past image analyses for the authenticated user |

---

## Health Records & Summary (`/api/health`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `GET` | `/api/health/records` | Bearer | General | List user health records (optional `record_type`, `limit`) |
| `POST` | `/api/health/records` | Bearer | General | Create record (`record_type`, `data`, `source`, optional `recorded_at`) |
| `GET` | `/api/health/summary` | Bearer | 10/min | Generate non-diagnostic AI summary from recent records |

---

## Health Reports (`/api/reports`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/api/reports/generate` | Bearer | General | Generate ReportLab PDF summary (`conversation_ids`, `include_vitals`, `date_range`, `report_type`) |
| `GET` | `/api/reports` | Bearer | General | List generated reports for the authenticated user |
| `GET` | `/api/reports/{id}/download` | Bearer | General | Stream `application/pdf` attachment |

---

## User Profile & Data Rights (`/api/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/users/profile` | Bearer | Fetch current user profile |
| `PUT` | `/api/users/profile` | Bearer | Update display name, DOB, gender, conditions, allergies |
| `GET` | `/api/users/export` | Bearer | Export all user records, conversations, analyses, and settings as JSON |
| `DELETE` | `/api/users/account` | Bearer | Permanently delete user account and all associated data (cascading) |

---

## Privacy & Consent (`/api/privacy`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/privacy/settings` | Bearer | Get current consent preferences |
| `PUT` | `/api/privacy/settings` | Bearer | Update `data_collection_consent` and `ai_processing_consent` |

---

## Error Format

All errors return structured JSON without stack traces:
```json
{
  "detail": "Human-readable error explanation.",
  "status_code": 400
}
```
