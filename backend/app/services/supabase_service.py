"""Supabase database, authentication, and storage service with strict user_id filtering."""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from supabase import Client, create_client

from app.config import settings

logger = logging.getLogger(__name__)


class SupabaseServiceError(Exception):
    """Domain error for Supabase operations."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class SupabaseService:
    """Centralized Supabase client wrapper enforcing user_id scoping on every query."""

    def __init__(self) -> None:
        self._anon_client: Optional[Client] = None
        self._service_client: Optional[Client] = None

    def _get_anon_client(self) -> Client:
        if self._anon_client is None:
            if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
                raise SupabaseServiceError(
                    "Supabase URL and anon key are not configured.", status_code=503
                )
            self._anon_client = create_client(
                settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY
            )
        return self._anon_client

    def _get_db_client(self) -> Client:
        """Return service-role client for server-side operations (app enforces user_id scoping)."""
        if self._service_client is None:
            key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
            if not settings.SUPABASE_URL or not key:
                raise SupabaseServiceError(
                    "Supabase database credentials are not configured.", status_code=503
                )
            self._service_client = create_client(settings.SUPABASE_URL, key)
        return self._service_client

    # ------------------------------------------------------------------
    # Authentication Helpers
    # ------------------------------------------------------------------
    def register_user(self, email: str, password: str, display_name: str) -> dict[str, Any]:
        """Register a user via Supabase Auth and initialize profile + privacy rows."""
        try:
            client = self._get_anon_client()
            res = client.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {"data": {"display_name": display_name}},
                }
            )
            user = getattr(res, "user", None)
            session = getattr(res, "session", None)
            if user is None:
                raise SupabaseServiceError("Registration failed.", status_code=400)

            user_id = str(user.id)
            # Best-effort initialization of profile and privacy settings
            try:
                self.ensure_user_profile(user_id, display_name=display_name)
                self.ensure_privacy_settings(user_id)
            except Exception:
                logger.warning("Deferred profile/privacy creation for new user_id=%s", user_id)

            return {
                "access_token": getattr(session, "access_token", None) if session else None,
                "refresh_token": getattr(session, "refresh_token", None) if session else None,
                "expires_in": getattr(session, "expires_in", None) if session else None,
                "user": {
                    "id": user_id,
                    "email": getattr(user, "email", email),
                    "display_name": display_name,
                    "email_verified": bool(getattr(user, "email_confirmed_at", None)),
                },
            }
        except SupabaseServiceError:
            raise
        except Exception as exc:
            logger.warning("User registration error: %s", type(exc).__name__)
            raise SupabaseServiceError(
                "Unable to register account. The email may already be in use.",
                status_code=400,
            ) from exc

    def login_user(self, email: str, password: str) -> dict[str, Any]:
        """Authenticate a user via Supabase Auth and return JWT session info."""
        try:
            client = self._get_anon_client()
            res = client.auth.sign_in_with_password({"email": email, "password": password})
            user = getattr(res, "user", None)
            session = getattr(res, "session", None)
            if user is None or session is None:
                raise SupabaseServiceError("Invalid email or password.", status_code=401)

            metadata = getattr(user, "user_metadata", None) or {}
            return {
                "access_token": session.access_token,
                "refresh_token": session.refresh_token,
                "expires_in": getattr(session, "expires_in", None),
                "user": {
                    "id": str(user.id),
                    "email": getattr(user, "email", email),
                    "display_name": metadata.get("display_name"),
                    "email_verified": bool(getattr(user, "email_confirmed_at", None)),
                },
            }
        except SupabaseServiceError:
            raise
        except Exception as exc:
            logger.warning("User login error: %s", type(exc).__name__)
            raise SupabaseServiceError("Invalid email or password.", status_code=401) from exc

    def logout_user(self, access_token: str) -> None:
        """Invalidate a user's Supabase session."""
        try:
            client = self._get_db_client()
            if hasattr(client.auth, "admin") and hasattr(client.auth.admin, "sign_out"):
                client.auth.admin.sign_out(access_token)
            else:
                client.auth.sign_out()
        except Exception as exc:
            logger.warning("Logout warning: %s", type(exc).__name__)

    def send_password_reset(self, email: str) -> None:
        """Send password reset email via Supabase Auth."""
        try:
            client = self._get_anon_client()
            redirect_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password"
            client.auth.reset_password_for_email(
                email, options={"redirect_to": redirect_url}
            )
        except Exception as exc:
            logger.warning("Password reset request error: %s", type(exc).__name__)
            # Do not leak whether email exists

    def verify_email_token(self, token: str, token_type: str = "signup") -> dict[str, Any]:
        """Verify an email confirmation token via Supabase Auth."""
        try:
            client = self._get_anon_client()
            res = client.auth.verify_otp({"token_hash": token, "type": token_type})
            user = getattr(res, "user", None)
            if user is None:
                raise SupabaseServiceError("Invalid or expired verification token.", status_code=400)
            return {
                "verified": True,
                "user_id": str(user.id),
                "email": getattr(user, "email", None),
            }
        except SupabaseServiceError:
            raise
        except Exception as exc:
            logger.warning("Email verification error: %s", type(exc).__name__)
            raise SupabaseServiceError(
                "Invalid or expired verification token.", status_code=400
            ) from exc

    def get_user_from_token(self, access_token: str) -> Optional[dict[str, Any]]:
        """Validate JWT with Supabase Auth and return user dict."""
        client = self._get_anon_client()
        res = client.auth.get_user(access_token)
        user = getattr(res, "user", None)
        if user is None:
            return None
        return {
            "id": str(user.id),
            "email": getattr(user, "email", None),
            "role": getattr(user, "role", "authenticated"),
        }

    # ------------------------------------------------------------------
    # User Profiles (filtered by user_id)
    # ------------------------------------------------------------------
    def ensure_user_profile(
        self, user_id: str, display_name: Optional[str] = None
    ) -> dict[str, Any]:
        existing = self.get_user_profile(user_id)
        if existing:
            return existing
        db = self._get_db_client()
        payload = {
            "user_id": user_id,
            "display_name": display_name or "",
            "medical_conditions": [],
            "allergies": [],
        }
        res = db.table("user_profiles").insert(payload).execute()
        return res.data[0]

    def get_user_profile(self, user_id: str) -> Optional[dict[str, Any]]:
        db = self._get_db_client()
        res = (
            db.table("user_profiles")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def update_user_profile(self, user_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        self.ensure_user_profile(user_id)
        db = self._get_db_client()
        payload = {**updates, "updated_at": datetime.now(timezone.utc).isoformat()}
        res = (
            db.table("user_profiles")
            .update(payload)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            raise SupabaseServiceError("Profile not found.", status_code=404)
        return res.data[0]

    # ------------------------------------------------------------------
    # Privacy Settings (filtered by user_id)
    # ------------------------------------------------------------------
    def ensure_privacy_settings(self, user_id: str) -> dict[str, Any]:
        existing = self.get_privacy_settings(user_id)
        if existing:
            return existing
        db = self._get_db_client()
        payload = {
            "user_id": user_id,
            "data_collection_consent": False,
            "ai_processing_consent": False,
            "consent_updated_at": datetime.now(timezone.utc).isoformat(),
        }
        res = db.table("privacy_settings").insert(payload).execute()
        return res.data[0]

    def get_privacy_settings(self, user_id: str) -> Optional[dict[str, Any]]:
        db = self._get_db_client()
        res = (
            db.table("privacy_settings")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def update_privacy_settings(
        self, user_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        self.ensure_privacy_settings(user_id)
        db = self._get_db_client()
        payload = {
            **updates,
            "consent_updated_at": datetime.now(timezone.utc).isoformat(),
        }
        res = (
            db.table("privacy_settings")
            .update(payload)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            raise SupabaseServiceError("Privacy settings not found.", status_code=404)
        return res.data[0]

    # ------------------------------------------------------------------
    # Conversations & Messages (filtered by user_id)
    # ------------------------------------------------------------------
    def create_conversation(self, user_id: str, title: str = "New Conversation") -> dict[str, Any]:
        db = self._get_db_client()
        now = datetime.now(timezone.utc).isoformat()
        res = (
            db.table("conversations")
            .insert(
                {
                    "user_id": user_id,
                    "title": title,
                    "status": "active",
                    "created_at": now,
                    "updated_at": now,
                }
            )
            .execute()
        )
        return res.data[0]

    def list_conversations(
        self, user_id: str, page: int = 1, page_size: int = 20
    ) -> tuple[list[dict[str, Any]], int]:
        db = self._get_db_client()
        start = (page - 1) * page_size
        end = start + page_size - 1
        res = (
            db.table("conversations")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .order("updated_at", desc=True)
            .range(start, end)
            .execute()
        )
        items = res.data or []
        total = res.count if res.count is not None else len(items)
        return items, total

    def get_conversation(self, user_id: str, conversation_id: str) -> Optional[dict[str, Any]]:
        db = self._get_db_client()
        res = (
            db.table("conversations")
            .select("*")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def update_conversation_timestamp(
        self, user_id: str, conversation_id: str, title: Optional[str] = None
    ) -> None:
        db = self._get_db_client()
        payload: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if title:
            payload["title"] = title
        (
            db.table("conversations")
            .update(payload)
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .execute()
        )

    def soft_delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        db = self._get_db_client()
        res = (
            db.table("conversations")
            .update(
                {
                    "status": "deleted",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .execute()
        )
        return bool(res.data)

    def get_conversation_messages(
        self, user_id: str, conversation_id: str
    ) -> list[dict[str, Any]]:
        # Always verify conversation belongs to user_id before returning messages
        conv = self.get_conversation(user_id, conversation_id)
        if conv is None:
            return []
        db = self._get_db_client()
        res = (
            db.table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []

    def add_message(
        self,
        user_id: str,
        conversation_id: str,
        role: str,
        content: str,
        metadata: Optional[dict[str, Any]] = None,
        image_url: Optional[str] = None,
    ) -> dict[str, Any]:
        # Verify conversation ownership by user_id
        conv = self.get_conversation(user_id, conversation_id)
        if conv is None:
            raise SupabaseServiceError("Conversation not found.", status_code=404)

        db = self._get_db_client()
        payload = {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "image_url": image_url,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = db.table("messages").insert(payload).execute()
        self.update_conversation_timestamp(user_id, conversation_id)
        return res.data[0]

    # ------------------------------------------------------------------
    # Health Records (filtered by user_id)
    # ------------------------------------------------------------------
    def list_health_records(
        self,
        user_id: str,
        record_type: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        db = self._get_db_client()
        query = (
            db.table("health_records")
            .select("*")
            .eq("user_id", user_id)
            .order("recorded_at", desc=True)
            .limit(limit)
        )
        if record_type:
            query = query.eq("record_type", record_type)
        res = query.execute()
        return res.data or []

    def create_health_record(
        self,
        user_id: str,
        record_type: str,
        data: dict[str, Any],
        source: str = "user_entered",
        recorded_at: Optional[datetime] = None,
    ) -> dict[str, Any]:
        db = self._get_db_client()
        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "user_id": user_id,
            "record_type": record_type,
            "data": data,
            "source": source,
            "recorded_at": (recorded_at.isoformat() if recorded_at else now),
            "created_at": now,
        }
        res = db.table("health_records").insert(payload).execute()
        return res.data[0]

    # ------------------------------------------------------------------
    # Image Analyses (filtered by user_id)
    # ------------------------------------------------------------------
    def create_image_analysis(
        self,
        user_id: str,
        image_path: str,
        question: str,
        analysis: str,
        conversation_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        db = self._get_db_client()
        payload = {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "image_path": image_path,
            "question": question,
            "analysis": analysis,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = db.table("image_analyses").insert(payload).execute()
        return res.data[0]

    def list_image_analyses(
        self, user_id: str, limit: int = 50
    ) -> list[dict[str, Any]]:
        db = self._get_db_client()
        res = (
            db.table("image_analyses")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []

    # ------------------------------------------------------------------
    # Health Reports (filtered by user_id)
    # ------------------------------------------------------------------
    def create_health_report(
        self,
        user_id: str,
        report_type: str,
        content: dict[str, Any],
        pdf_path: Optional[str] = None,
    ) -> dict[str, Any]:
        db = self._get_db_client()
        payload = {
            "user_id": user_id,
            "report_type": report_type,
            "content": content,
            "pdf_path": pdf_path,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        res = db.table("health_reports").insert(payload).execute()
        return res.data[0]

    def list_health_reports(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        db = self._get_db_client()
        res = (
            db.table("health_reports")
            .select("*")
            .eq("user_id", user_id)
            .order("generated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []

    def get_health_report(self, user_id: str, report_id: str) -> Optional[dict[str, Any]]:
        db = self._get_db_client()
        res = (
            db.table("health_reports")
            .select("*")
            .eq("id", report_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    # ------------------------------------------------------------------
    # Storage Helpers
    # ------------------------------------------------------------------
    def upload_file(
        self,
        bucket: str,
        storage_path: str,
        file_bytes: bytes,
        content_type: str,
    ) -> str:
        """Upload file bytes to Supabase Storage and return a signed or public URL."""
        db = self._get_db_client()
        storage = db.storage.from_(bucket)
        storage.upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        return self.get_file_url(bucket, storage_path)

    def get_file_url(
        self, bucket: str, storage_path: str, expires_in: int = 3600
    ) -> str:
        """Return a signed URL for a private storage object, with public URL fallback."""
        db = self._get_db_client()
        storage = db.storage.from_(bucket)
        try:
            signed = storage.create_signed_url(storage_path, expires_in)
            if isinstance(signed, dict):
                url = signed.get("signedURL") or signed.get("signedUrl")
                if url:
                    return str(url)
        except Exception:
            logger.debug("Falling back to public URL for bucket=%s", bucket)
        return str(storage.get_public_url(storage_path))

    def download_file(self, bucket: str, storage_path: str) -> bytes:
        """Download file bytes from Supabase Storage."""
        db = self._get_db_client()
        return db.storage.from_(bucket).download(storage_path)

    def delete_files(self, bucket: str, paths: list[str]) -> None:
        """Remove files from a Supabase Storage bucket."""
        if not paths:
            return
        try:
            db = self._get_db_client()
            db.storage.from_(bucket).remove(paths)
        except Exception as exc:
            logger.warning("Storage cleanup error in bucket=%s: %s", bucket, type(exc).__name__)

    # ------------------------------------------------------------------
    # Data Export & Cascading Account Deletion
    # ------------------------------------------------------------------
    def export_user_data(self, user_id: str) -> dict[str, Any]:
        """Export all data owned by user_id across every table."""
        profile = self.get_user_profile(user_id)
        privacy = self.get_privacy_settings(user_id)
        conversations, _ = self.list_conversations(user_id, page=1, page_size=500)
        enriched_conversations: list[dict[str, Any]] = []
        for conv in conversations:
            msgs = self.get_conversation_messages(user_id, conv["id"])
            enriched_conversations.append({**conv, "messages": msgs})

        health_records = self.list_health_records(user_id, limit=1000)
        image_analyses = self.list_image_analyses(user_id, limit=500)
        health_reports = self.list_health_reports(user_id, limit=500)

        return {
            "exported_at": datetime.now(timezone.utc),
            "user_id": user_id,
            "profile": profile,
            "privacy_settings": privacy,
            "conversations": enriched_conversations,
            "health_records": health_records,
            "image_analyses": image_analyses,
            "health_reports": health_reports,
        }

    def delete_user_account_cascading(self, user_id: str) -> None:
        """Delete all user records, storage artifacts, and Supabase Auth user."""
        db = self._get_db_client()

        # Gather storage paths before deleting database rows
        analyses = self.list_image_analyses(user_id, limit=1000)
        image_paths = [a["image_path"] for a in analyses if a.get("image_path")]
        reports = self.list_health_reports(user_id, limit=1000)
        report_paths = [r["pdf_path"] for r in reports if r.get("pdf_path")]

        # Delete storage files
        self.delete_files(settings.SUPABASE_IMAGES_BUCKET, image_paths)
        self.delete_files(settings.SUPABASE_REPORTS_BUCKET, report_paths)

        # Delete messages via conversations belonging to user_id
        convs_res = (
            db.table("conversations").select("id").eq("user_id", user_id).execute()
        )
        conv_ids = [row["id"] for row in (convs_res.data or [])]
        for conv_id in conv_ids:
            db.table("messages").delete().eq("conversation_id", conv_id).execute()

        # Delete user rows from all domain tables (all filtered by user_id)
        for table in (
            "image_analyses",
            "health_reports",
            "health_records",
            "conversations",
            "privacy_settings",
            "user_profiles",
        ):
            db.table(table).delete().eq("user_id", user_id).execute()

        # Delete Auth user via admin API (requires service role key)
        if settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                db.auth.admin.delete_user(user_id)
            except Exception as exc:
                logger.warning("Supabase Auth admin delete_user failed: %s", type(exc).__name__)


supabase_service = SupabaseService()
