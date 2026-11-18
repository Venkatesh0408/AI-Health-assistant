"""API router package exporting all 7 domain routers."""

from app.routers import auth, chat, health, images, privacy, reports, users

__all__ = ["auth", "chat", "health", "images", "privacy", "reports", "users"]
