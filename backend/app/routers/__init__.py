"""API router package exporting all 8 domain routers."""

from app.routers import auth, chat, health, images, privacy, reports, users, voice

__all__ = ["auth", "chat", "health", "images", "privacy", "reports", "users", "voice"]
