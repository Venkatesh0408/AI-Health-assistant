"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application settings backed by environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Supabase configuration
    SUPABASE_URL: str = Field(default="", description="Supabase project URL")
    SUPABASE_ANON_KEY: str = Field(default="", description="Supabase anon public key")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(
        default="", description="Supabase service role key (server-side only)"
    )
    SUPABASE_JWT_SECRET: str = Field(
        default="", description="Optional Supabase JWT signing secret for local verification"
    )
    SUPABASE_IMAGES_BUCKET: str = Field(
        default="health-images", description="Supabase Storage bucket for user health images"
    )
    SUPABASE_REPORTS_BUCKET: str = Field(
        default="health-reports", description="Supabase Storage bucket for generated PDF reports"
    )

    # Google Gemini AI configuration
    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API key")
    GEMINI_MODEL: str = Field(
        default="gemini-4-hydrogen", description="Gemini model identifier"
    )

    # Voice AI (Text-to-Speech & Speech) configuration
    VOICE_PROVIDER: str = Field(
        default="elevenlabs",
        description="Active voice TTS provider: elevenlabs | openai | web_speech | auto",
    )
    ELEVENLABS_API_KEY: str = Field(default="", description="ElevenLabs API key")
    ELEVENLABS_VOICE_ID: str = Field(
        default="EXAVITQu4vr4xnSDxMaL",  # "Sarah" (warm, calming healthcare voice)
        description="ElevenLabs Voice ID",
    )
    ELEVENLABS_MODEL_ID: str = Field(
        default="eleven_multilingual_v2",
        description="ElevenLabs model identifier (eleven_multilingual_v2, eleven_turbo_v2_5, eleven_flash_v2_5)",
    )
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key (optional alternative TTS)")
    OPENAI_VOICE: str = Field(
        default="alloy",
        description="OpenAI voice: alloy | echo | fable | onyx | nova | shimmer",
    )
    VOICE_ENABLED: bool = Field(default=True, description="Master toggle for Voice TTS")

    # Application configuration
    APP_ENV: str = Field(default="development", description="Environment: development|staging|production")
    APP_SECRET_KEY: str = Field(
        default="", description="Application secret key for internal token operations"
    )
    FRONTEND_URL: str = Field(
        default="http://localhost:5173", description="Allowed frontend origin URL"
    )
    BACKEND_URL: str = Field(
        default="http://localhost:8000", description="Public backend base URL"
    )

    # Rate limits (requests per minute)
    RATE_LIMIT_GENERAL: int = Field(default=100, ge=1)
    RATE_LIMIT_AI: int = Field(default=10, ge=1)

    # Image upload limits
    MAX_IMAGE_SIZE_MB: int = Field(default=10, ge=1, le=50)
    ALLOWED_IMAGE_TYPES: str = Field(
        default="image/jpeg,image/png,image/webp",
        description="Comma-separated list of allowed MIME types",
    )
    MAX_IMAGE_DIMENSION: int = Field(default=4096, ge=256)

    @field_validator("APP_ENV")
    @classmethod
    def validate_app_env(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"development", "staging", "production", "test"}
        if normalized not in allowed:
            return "development"
        return normalized

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def max_image_size_bytes(self) -> int:
        return self.MAX_IMAGE_SIZE_MB * 1024 * 1024

    @property
    def allowed_image_types_list(self) -> List[str]:
        return [
            item.strip().lower()
            for item in self.ALLOWED_IMAGE_TYPES.split(",")
            if item.strip()
        ]

    @property
    def general_rate_limit_str(self) -> str:
        return f"{self.RATE_LIMIT_GENERAL}/minute"

    @property
    def ai_rate_limit_str(self) -> str:
        return f"{self.RATE_LIMIT_AI}/minute"


@lru_cache()
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()


settings = get_settings()
