"""Pydantic schemas for all domain entities and API requests/responses."""

from app.models.conversation import (
    ConversationCreate,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    SendMessageResponse,
)
from app.models.health_record import (
    HealthRecordCreate,
    HealthRecordListResponse,
    HealthRecordResponse,
    HealthSummaryResponse,
)
from app.models.image_analysis import (
    ImageAnalysisListResponse,
    ImageAnalysisResponse,
    ImageAnalyzeRequest,
    ImageUploadResponse,
)
from app.models.report import (
    DateRange,
    ReportGenerateRequest,
    ReportListResponse,
    ReportResponse,
)
from app.models.user import (
    AuthResponse,
    ForgotPasswordRequest,
    MessageStatusResponse,
    PrivacySettings,
    PrivacySettingsUpdate,
    UserDataExport,
    UserInfo,
    UserLogin,
    UserProfile,
    UserProfileUpdate,
    UserRegister,
)

__all__ = [
    "AuthResponse",
    "ConversationCreate",
    "ConversationDetailResponse",
    "ConversationListResponse",
    "ConversationResponse",
    "DateRange",
    "ForgotPasswordRequest",
    "HealthRecordCreate",
    "HealthRecordListResponse",
    "HealthRecordResponse",
    "HealthSummaryResponse",
    "ImageAnalysisListResponse",
    "ImageAnalysisResponse",
    "ImageAnalyzeRequest",
    "ImageUploadResponse",
    "MessageCreate",
    "MessageResponse",
    "MessageStatusResponse",
    "PrivacySettings",
    "PrivacySettingsUpdate",
    "ReportGenerateRequest",
    "ReportListResponse",
    "ReportResponse",
    "SendMessageResponse",
    "UserDataExport",
    "UserInfo",
    "UserLogin",
    "UserProfile",
    "UserProfileUpdate",
    "UserRegister",
]
