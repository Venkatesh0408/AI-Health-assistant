# DATABASE SCHEMA — AI Health Monitoring System

**Version:** 1.0  
**Database Engine:** PostgreSQL 15+ (via Supabase)  
**Schema Source:** [supabase_schema.sql](file:///C:/Users/venka/.gemini/antigravity/scratch/ai-health-monitor/backend/supabase_schema.sql)

---

## 1. Entity-Relationship Overview

All tables reference `auth.users(id)` (managed by Supabase Auth) with `ON DELETE CASCADE` to guarantee full data erasure when a user deletes their account.

| Table | Purpose | Primary Key | User Isolation |
|-------|---------|-------------|----------------|
| `user_profiles` | Display name, DOB, gender, conditions, allergies | `id` (UUID) | RLS `auth.uid() = user_id` |
| `conversations` | Health consultation threads (active/archived/deleted) | `id` (UUID) | RLS `auth.uid() = user_id` |
| `messages` | Chronological user/assistant chat messages & metadata | `id` (UUID) | RLS via owning `conversations.user_id` |
| `health_records` | Vital signs, symptoms, medications, allergies, notes | `id` (UUID) | RLS `auth.uid() = user_id` |
| `image_analyses` | Uploaded health image metadata, question & AI observations | `id` (UUID) | RLS `auth.uid() = user_id` |
| `health_reports` | Generated PDF summary metadata and storage path | `id` (UUID) | RLS `auth.uid() = user_id` |
| `privacy_settings` | Explicit user data collection & AI processing consent | `id` (UUID) | RLS `auth.uid() = user_id` |

---

## 2. Table Definitions

### `user_profiles`
- `id` `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id` `UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL`
- `display_name` `TEXT`
- `date_of_birth` `DATE`
- `gender` `TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'))`
- `medical_conditions` `JSONB DEFAULT '[]'`
- `allergies` `JSONB DEFAULT '[]'`
- `created_at` `TIMESTAMPTZ DEFAULT now()`
- `updated_at` `TIMESTAMPTZ DEFAULT now()`

### `conversations`
- `id` `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id` `UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`
- `title` `TEXT DEFAULT 'New Conversation'`
- `status` `TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted'))`
- `created_at` `TIMESTAMPTZ DEFAULT now()`
- `updated_at` `TIMESTAMPTZ DEFAULT now()`

### `messages`
- `id` `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `conversation_id` `UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL`
- `role` `TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system'))`
- `content` `TEXT NOT NULL`
- `metadata` `JSONB DEFAULT '{}'` (stores `interaction_id`, `emergency`, `safety_flags`, `sections`, `sources`)
- `image_url` `TEXT`
- `created_at` `TIMESTAMPTZ DEFAULT now()`

### `health_records`
- `id` `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id` `UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`
- `record_type` `TEXT NOT NULL CHECK (record_type IN ('vital_signs', 'symptom', 'medication', 'allergy', 'condition', 'note'))`
- `data` `JSONB NOT NULL`
- `source` `TEXT DEFAULT 'user_entered' CHECK (source IN ('user_entered', 'ai_observed', 'device_measured'))`
- `recorded_at` `TIMESTAMPTZ DEFAULT now()`
- `created_at` `TIMESTAMPTZ DEFAULT now()`

### `image_analyses`
- `id` `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id` `UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`
- `conversation_id` `UUID REFERENCES conversations(id) ON DELETE SET NULL`
- `image_path` `TEXT NOT NULL`
- `question` `TEXT NOT NULL`
- `analysis` `TEXT NOT NULL`
- `metadata` `JSONB DEFAULT '{}'`
- `created_at` `TIMESTAMPTZ DEFAULT now()`

### `health_reports`
- `id` `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id` `UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`
- `report_type` `TEXT DEFAULT 'health_summary'`
- `content` `JSONB NOT NULL`
- `pdf_path` `TEXT`
- `generated_at` `TIMESTAMPTZ DEFAULT now()`

### `privacy_settings`
- `id` `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id` `UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL`
- `data_collection_consent` `BOOLEAN DEFAULT false`
- `ai_processing_consent` `BOOLEAN DEFAULT false`
- `consent_updated_at` `TIMESTAMPTZ DEFAULT now()`

---

## 3. Row-Level Security (RLS) & Indexes

- RLS is **enabled on all 7 tables**.
- Every policy enforces `auth.uid() = user_id` (or ownership via `conversations` for `messages`).
- Indexes are defined on `conversations(user_id)`, `messages(conversation_id)`, `health_records(user_id)`, `image_analyses(user_id)`, and `health_reports(user_id)`.

## 4. Storage Buckets

Create two **private** Supabase Storage buckets with owner-only folder policies (`{user_id}/*`):
1. `health-images` — Uploaded user health photographs (max 10 MB; JPG, PNG, WebP).
2. `health-reports` — Generated PDF health information summaries.

## 5. Applying the Schema

Run `backend/supabase_schema.sql` inside the Supabase SQL Editor for your provisioned project.
