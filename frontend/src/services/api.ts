import { supabase } from './supabase';
import type {
  ApiError,
  Conversation,
  EmergencyInfo,
  HealthRecord,
  HealthRecordCreate,
  HealthRecordType,
  HealthReport,
  HealthSummary,
  ImageAnalysis,
  ImageUploadResponse,
  Message,
  PrivacySettings,
  PrivacySettingsUpdate,
  ReportGenerateRequest,
  SendMessageResponse,
  UserProfile,
  UserProfileUpdate,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'ai_health_access_token';

export class ApiClientError extends Error implements ApiError {
  public readonly detail: string;
  public readonly status_code: number;

  constructor(detail: string, statusCode: number) {
    super(detail);
    this.name = 'ApiClientError';
    this.detail = detail;
    this.status_code = statusCode;
  }
}

let cachedAccessToken: string | null = null;

export function setAuthToken(token: string | null): void {
  cachedAccessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
}

async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      cachedAccessToken = data.session.access_token;
      return cachedAccessToken;
    }
  } catch {
    // Fallback to sessionStorage
  }

  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      setAuthToken(data.session.access_token);
      return data.session.access_token;
    }
  } catch {
    // Refresh failed
  }
  return null;
}

async function parseErrorResponse(response: Response): Promise<ApiClientError> {
  let detail = `Request failed with status ${response.status}`;

  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as Record<string, unknown>;
      if (typeof body.detail === 'string') {
        detail = body.detail;
      } else if (Array.isArray(body.detail) && body.detail.length > 0) {
        const first = body.detail[0] as Record<string, unknown>;
        if (typeof first.msg === 'string') {
          detail = first.msg;
        }
      } else if (typeof body.message === 'string') {
        detail = body.message;
      } else if (typeof body.error === 'string') {
        detail = body.error;
      }
    } else {
      const text = await response.text();
      if (text.trim()) {
        detail = text.trim().slice(0, 300);
      }
    }
  } catch {
    // Keep default error detail
  }

  return new ApiClientError(detail, response.status);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  isFormData?: boolean;
  requiresAuth?: boolean;
  responseType?: 'json' | 'blob' | 'void';
  signal?: AbortSignal;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
  hasRetried = false
): Promise<T> {
  const {
    method = 'GET',
    body,
    isFormData = false,
    requiresAuth = true,
    responseType = 'json',
    signal,
  } = options;

  const headers = new Headers();
  if (!isFormData && body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (requiresAuth) {
    const token = await getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError('Request was cancelled.', 0);
    }
    throw new ApiClientError(
      'Unable to reach the server. Please check your connection and try again.',
      0
    );
  }

  if (response.status === 401 && requiresAuth && !hasRetried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(endpoint, options, true);
    }
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (responseType === 'void' || response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new ApiClientError(
      'Backend API endpoint returned HTML instead of JSON. Ensure VITE_API_BASE_URL points to your active backend server.',
      502
    );
  }

  if (responseType === 'blob') {
    return (await response.blob()) as T;
  }

  return (await response.json()) as T;
}

function extractArray<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as T[];
      }
    }
  }
  return [];
}

function extractEmergencyInfo(
  payload: Record<string, unknown>,
  message?: Message
): EmergencyInfo | undefined {
  const direct = payload.emergency as EmergencyInfo | undefined;
  if (direct && typeof direct.is_emergency === 'boolean') {
    return direct;
  }
  const metaEmergency = message?.metadata?.emergency as EmergencyInfo | undefined;
  if (metaEmergency && typeof metaEmergency.is_emergency === 'boolean') {
    return metaEmergency;
  }
  if (message?.metadata?.is_emergency === true) {
    return {
      is_emergency: true,
      category:
        typeof message.metadata.category === 'string'
          ? message.metadata.category
          : undefined,
      severity:
        typeof message.metadata.severity === 'string'
          ? message.metadata.severity
          : 'critical',
      message:
        typeof message.metadata.emergency_message === 'string'
          ? message.metadata.emergency_message
          : undefined,
    };
  }
  return undefined;
}

export const api = {
  auth: {
    async register(payload: {
      email: string;
      password: string;
      display_name: string;
    }): Promise<{ message: string; user_id?: string }> {
      return request('/auth/register', {
        method: 'POST',
        body: payload,
        requiresAuth: false,
      });
    },

    async login(payload: {
      email: string;
      password: string;
    }): Promise<{ access_token: string; refresh_token?: string; user?: Record<string, unknown> }> {
      const result = await request<{
        access_token: string;
        refresh_token?: string;
        user?: Record<string, unknown>;
      }>('/auth/login', {
        method: 'POST',
        body: payload,
        requiresAuth: false,
      });
      if (result.access_token) {
        setAuthToken(result.access_token);
      }
      return result;
    },

    async logout(): Promise<void> {
      try {
        await request('/auth/logout', { method: 'POST', responseType: 'void' });
      } finally {
        setAuthToken(null);
      }
    },

    async forgotPassword(email: string): Promise<{ message: string }> {
      return request('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        requiresAuth: false,
      });
    },

    async verifyEmail(token: string): Promise<{ message: string; verified?: boolean }> {
      return request(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        requiresAuth: false,
      });
    },
  },

  chat: {
    async createConversation(title?: string): Promise<Conversation> {
      return request<Conversation>('/chat/conversations', {
        method: 'POST',
        body: title ? { title } : {},
      });
    },

    async listConversations(params?: {
      limit?: number;
      offset?: number;
    }): Promise<Conversation[]> {
      const search = new URLSearchParams();
      if (params?.limit !== undefined) search.set('limit', String(params.limit));
      if (params?.offset !== undefined) search.set('offset', String(params.offset));
      const qs = search.toString();
      const payload = await request<unknown>(
        `/chat/conversations${qs ? `?${qs}` : ''}`
      );
      return extractArray<Conversation>(payload, ['conversations', 'items', 'data']);
    },

    async getConversation(id: string): Promise<Conversation> {
      return request<Conversation>(`/chat/conversations/${encodeURIComponent(id)}`);
    },

    async sendMessage(
      conversationId: string,
      payload: { content: string; image_url?: string; language?: string }
    ): Promise<SendMessageResponse> {
      const raw = await request<Record<string, unknown>>(
        `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: 'POST',
          body: payload,
        }
      );

      // Normalize various response shapes cleanly
      const assistantMessage =
        (raw.assistant_message as Message | undefined) ||
        (raw.ai_message as Message | undefined) ||
        (raw.response as Message | undefined) ||
        (raw.message && typeof raw.message === 'object'
          ? (raw.message as Message)
          : undefined) ||
        (typeof raw.content === 'string' ? (raw as unknown as Message) : undefined);

      if (!assistantMessage) {
        throw new ApiClientError('Invalid response received from AI service.', 500);
      }

      const userMessage = raw.user_message as Message | undefined;
      const emergency = extractEmergencyInfo(raw, assistantMessage);
      const conversationTitle =
        typeof raw.conversation_title === 'string'
          ? raw.conversation_title
          : typeof raw.title === 'string'
          ? raw.title
          : undefined;

      return {
        user_message: userMessage,
        assistant_message: assistantMessage,
        emergency,
        conversation_title: conversationTitle,
      };
    },

    async deleteConversation(id: string): Promise<void> {
      await request<void>(`/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        responseType: 'void',
      });
    },
  },

  images: {
    async uploadImage(file: File): Promise<ImageUploadResponse> {
      const formData = new FormData();
      formData.append('file', file);
      const raw = await request<Record<string, unknown>>('/images/upload', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });

      const imageUrl =
        (typeof raw.image_url === 'string' && raw.image_url) ||
        (typeof raw.url === 'string' && raw.url) ||
        (typeof raw.image_path === 'string' && raw.image_path) ||
        '';

      return {
        image_url: imageUrl,
        image_path: typeof raw.image_path === 'string' ? raw.image_path : imageUrl,
        filename: typeof raw.filename === 'string' ? raw.filename : file.name,
        size_bytes: typeof raw.size_bytes === 'number' ? raw.size_bytes : file.size,
      };
    },

    async analyzeImage(payload: {
      image_url: string;
      question: string;
      conversation_id?: string;
    }): Promise<ImageAnalysis> {
      return request<ImageAnalysis>('/images/analyze', {
        method: 'POST',
        body: payload,
      });
    },

    async listAnalyses(): Promise<ImageAnalysis[]> {
      const payload = await request<unknown>('/images/analyses');
      return extractArray<ImageAnalysis>(payload, ['analyses', 'items', 'data']);
    },
  },

  health: {
    async getRecords(recordType?: HealthRecordType): Promise<HealthRecord[]> {
      const qs = recordType ? `?record_type=${encodeURIComponent(recordType)}` : '';
      const payload = await request<unknown>(`/health/records${qs}`);
      return extractArray<HealthRecord>(payload, ['records', 'items', 'data']);
    },

    async addRecord(payload: HealthRecordCreate): Promise<HealthRecord> {
      return request<HealthRecord>('/health/records', {
        method: 'POST',
        body: payload,
      });
    },

    async getSummary(): Promise<HealthSummary> {
      const raw = await request<Record<string, unknown>>('/health/summary');
      return {
        summary:
          typeof raw.summary === 'string'
            ? raw.summary
            : typeof raw.message === 'string'
            ? raw.message
            : '',
        record_count:
          typeof raw.record_count === 'number' ? raw.record_count : undefined,
        generated_at:
          typeof raw.generated_at === 'string' ? raw.generated_at : undefined,
        highlights: Array.isArray(raw.highlights)
          ? raw.highlights.filter((item): item is string => typeof item === 'string')
          : undefined,
        recommendations: Array.isArray(raw.recommendations)
          ? raw.recommendations.filter(
              (item): item is string => typeof item === 'string'
            )
          : undefined,
      };
    },
  },

  reports: {
    async generateReport(payload: ReportGenerateRequest): Promise<HealthReport> {
      return request<HealthReport>('/reports/generate', {
        method: 'POST',
        body: payload,
      });
    },

    async listReports(): Promise<HealthReport[]> {
      const payload = await request<unknown>('/reports');
      return extractArray<HealthReport>(payload, ['reports', 'items', 'data']);
    },

    async downloadReport(id: string): Promise<Blob> {
      return request<Blob>(`/reports/${encodeURIComponent(id)}/download`, {
        method: 'GET',
        responseType: 'blob',
      });
    },
  },

  users: {
    async getProfile(): Promise<UserProfile> {
      return request<UserProfile>('/users/profile');
    },

    async updateProfile(payload: UserProfileUpdate): Promise<UserProfile> {
      return request<UserProfile>('/users/profile', {
        method: 'PUT',
        body: payload,
      });
    },

    async deleteAccount(): Promise<void> {
      await request<void>('/users/account', {
        method: 'DELETE',
        responseType: 'void',
      });
      setAuthToken(null);
    },

    async exportData(): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>('/users/export');
    },
  },

  privacy: {
    async getSettings(): Promise<PrivacySettings> {
      return request<PrivacySettings>('/privacy/settings');
    },

    async updateSettings(payload: PrivacySettingsUpdate): Promise<PrivacySettings> {
      return request<PrivacySettings>('/privacy/settings', {
        method: 'PUT',
        body: payload,
      });
    },
  },

  voice: {
    async getStatus(): Promise<{
      enabled: boolean;
      provider: string;
      ready: boolean;
      has_elevenlabs_key: boolean;
      has_openai_key: boolean;
      voice_id: string;
      model_id: string;
      recommended_voices: Array<{
        id: string;
        name: string;
        provider: string;
        gender: string;
        description: string;
      }>;
    }> {
      return request('/voice/status', { requiresAuth: false });
    },

    async synthesize(text: string, voiceId?: string): Promise<Blob> {
      return request<Blob>('/voice/synthesize', {
        method: 'POST',
        body: { text, voice_id: voiceId },
        responseType: 'blob',
        requiresAuth: false,
      });
    },
  },
};
