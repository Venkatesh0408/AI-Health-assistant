# CONTRIBUTING — AI Health Monitoring System

Thank you for contributing to the AI Health Monitoring System. Because this software handles sensitive health information, every contribution must prioritize **medical safety, security, and verification**.

---

## Engineering Principles

1. **Medical Safety First:** Never introduce diagnostic claims, medication prescriptions, or bypasses of the deterministic emergency screening layer.
2. **Privacy by Default:** Never log user health text, uploaded images, or credentials. Always scope database queries to the authenticated `user_id` and preserve Supabase RLS policies.
3. **Real Functionality Only:** No dead buttons, no hardcoded fake medical outputs, and no unverified claims.
4. **Test Everything:** Every bug fix or feature must include automated tests and pass both backend (`pytest`) and frontend (`npm run build`) checks.

---

## Local Verification Commands

### Backend
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

### Frontend
```powershell
cd frontend
npm run build
```

---

## Pull Request Checklist

- [ ] No `.env`, API keys, private images, or real patient records included in commits
- [ ] Backend unit, safety, and emergency tests pass
- [ ] Frontend TypeScript check (`tsc -b`) and Vite production build pass
- [ ] `FUNCTIONALITY_AUDIT.md` and `TESTING_REPORT.md` updated for any changed capabilities
- [ ] Security & medical safety implications reviewed
