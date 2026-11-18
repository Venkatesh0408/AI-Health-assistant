# SECURITY AND PRIVACY — AI Health Monitoring System

**Version:** 1.0  
**Date:** 2026-11-18

---

## 1. Data Classification

| Data Type | Sensitivity | Storage | Encryption |
|-----------|------------|---------|------------|
| User email/password | High | Supabase Auth (hashed) | At rest + in transit |
| Health conversations | **Critical** | Supabase PostgreSQL | At rest + in transit |
| Uploaded medical images | **Critical** | Supabase Storage | At rest + in transit |
| User profile (name, DOB) | High | Supabase PostgreSQL | At rest + in transit |
| Health records (vitals) | **Critical** | Supabase PostgreSQL | At rest + in transit |
| AI-generated reports | High | Supabase Storage | At rest + in transit |
| Privacy consent records | High | Supabase PostgreSQL | At rest + in transit |
| Session tokens (JWT) | High | Client-side (httpOnly cookie) | In transit (HTTPS) |

> [!CAUTION]
> All health-related data is classified as **Critical**. No health data may be logged in plaintext, exposed through public APIs, or transmitted over unencrypted channels.

---

## 2. Authentication & Authorization

### Authentication Flow
- **Method:** Email + password via Supabase Auth
- **Password hashing:** bcrypt (Supabase default)
- **Session management:** JWT tokens with expiration
- **Email verification:** Required before first login
- **Password recovery:** Secure email-based reset link

### Authorization Controls
- **Row-Level Security (RLS):** Every table enforces `user_id = auth.uid()`
- **API-level auth:** JWT verification middleware on all protected endpoints
- **No cross-user access:** Users can only read/modify/delete their own data
- **Admin endpoints:** None exposed (admin tasks via Supabase dashboard only)

---

## 3. Input Validation & Sanitization

| Input | Validation |
|-------|-----------|
| Email | RFC 5322 format validation |
| Password | Minimum 8 characters, complexity requirements |
| Chat messages | Max 5,000 characters, HTML stripped, Unicode normalized |
| Image uploads | File type (JPG/PNG/WebP), max 10MB, magic byte verification |
| Health records | Pydantic schema validation, range checks for vitals |
| Query parameters | Type coercion, whitelist validation |

### Prompt Injection Protection
1. User input is **never** directly concatenated into system prompts
2. System prompts use template variables with sanitized user content
3. Input screened for known injection patterns before AI processing
4. AI response validated against safety rules before delivery

---

## 4. API Security

| Control | Implementation |
|---------|---------------|
| HTTPS | Enforced (HTTP redirected) |
| CORS | Whitelist of allowed origins only |
| Rate limiting | 100 req/min general, 10 req/min AI endpoints |
| Request size limit | 15MB max (for image uploads) |
| Error handling | Generic error messages, no stack traces in production |
| Logging | Structured logs, no PII, no health data in logs |
| API keys | Server-side only, never exposed to frontend |

---

## 5. Data Privacy Rights (DPDPA Assessment)

India's Digital Personal Data Protection Act, 2023 requires:

| Right | Implementation Status |
|-------|----------------------|
| **Right to access** | ✅ Data export endpoint (`/api/users/export`) |
| **Right to correction** | ✅ Profile update endpoints |
| **Right to erasure** | ✅ Account deletion (`/api/users/account` DELETE) |
| **Consent management** | ✅ Privacy settings with explicit consent |
| **Data minimization** | ✅ Collect only necessary health information |
| **Purpose limitation** | ✅ Data used only for health assistance |
| **Data breach notification** | ⚠️ Monitoring setup needed for production |
| **Cross-border transfer** | ⚠️ Supabase region selection matters |

> [!WARNING]
> This assessment identifies applicable requirements but does **not** constitute legal compliance certification. Legal review is recommended before production launch.

---

## 6. Medical Data Handling Rules

1. **Never** store raw AI prompts containing health data in application logs
2. **Never** expose health data in URL parameters
3. **Never** cache health data in browser localStorage (use sessionStorage sparingly)
4. **Never** send health data to analytics, error tracking, or third-party services
5. **Always** encrypt health images in storage
6. **Always** delete health data when user requests account deletion
7. **Always** include data retention periods in privacy policy
8. **Always** require re-authentication for sensitive operations (data export, deletion)

---

## 7. Dependency Security

- Automated vulnerability scanning via `npm audit` and `pip audit`
- No unnecessary dependencies
- Pin dependency versions
- Review transitive dependencies for known vulnerabilities
