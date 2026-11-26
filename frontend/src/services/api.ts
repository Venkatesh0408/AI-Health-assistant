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

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://ai-health-assistant-a5g8.onrender.com/api'
).replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'ai_health_access_token';
const WAKEUP_COOLDOWN_MS = 90_000;
let lastWakeupAt = 0;
let inflightWakeup: Promise<boolean> | null = null;

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
  timeoutMs?: number;
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
    timeoutMs = 25000,
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('REQUEST_TIMEOUT'));
  }, timeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
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
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isTimeoutAbort =
      controller.signal.aborted &&
      (!signal || !signal.aborted);

    // Retry safe idempotent GET requests once on cold-start transient failures
    if (method === 'GET' && !hasRetried && (!signal || !signal.aborted)) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return request<T>(endpoint, options, true);
    }

    if (isTimeoutAbort) {
      throw new ApiClientError(
        'Request timed out while waiting for the backend server (it may be waking from sleep). Please try again in a few seconds.',
        408
      );
    }
    if ((err instanceof DOMException && err.name === 'AbortError') || signal?.aborted) {
      throw new ApiClientError('Request was cancelled.', 0);
    }
    throw new ApiClientError(
      'Unable to reach the backend server. Please verify your internet connection or try again in a few seconds while the server wakes up.',
      0
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401 && requiresAuth && !hasRetried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(endpoint, options, true);
    }
  }

  if ((response.status === 502 || response.status === 503) && method === 'GET' && !hasRetried) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return request<T>(endpoint, options, true);
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
  /**
   * Silently ping /health so free-tier Render containers wake up before the user sends a prompt.
   */
  async wakeUp(force = false): Promise<boolean> {
    const now = Date.now();
    if (!force && now - lastWakeupAt < WAKEUP_COOLDOWN_MS) {
      return true;
    }
    if (inflightWakeup) {
      return inflightWakeup;
    }
    lastWakeupAt = now;
    inflightWakeup = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55000);
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          signal: controller.signal,
          keepalive: true,
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
        inflightWakeup = null;
      }
    })();
    return inflightWakeup;
  },

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
      // 1. Direct Supabase create for instant sub-50ms speed
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('conversations')
            .insert({
              user_id: authData.user.id,
              title: title || 'New Health Consultation',
            })
            .select()
            .single();

          if (!error && data) {
            return {
              id: data.id,
              user_id: data.user_id,
              title: data.title || 'New Health Consultation',
              status: 'active',
              created_at: data.created_at,
              updated_at: data.updated_at,
              messages: [],
            };
          }
        }
      } catch {
        // Fallback to backend API
      }

      return request<Conversation>('/chat/conversations', {
        method: 'POST',
        body: title ? { title } : {},
      });
    },

    async listConversations(params?: {
      limit?: number;
      offset?: number;
    }): Promise<Conversation[]> {
      // 1. Direct Supabase query for instant sub-50ms speed
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          let query = supabase
            .from('conversations')
            .select('*')
            .eq('user_id', authData.user.id)
            .neq('status', 'deleted')
            .order('updated_at', { ascending: false });

          if (params?.limit !== undefined) {
            query = query.limit(params.limit);
          }
          if (params?.offset !== undefined) {
            query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            return data.map((item) => ({
              id: item.id,
              user_id: item.user_id,
              title: item.title || 'Health Consultation',
              status: (item.status as 'active' | 'archived' | 'deleted') || 'active',
              created_at: item.created_at,
              updated_at: item.updated_at,
            }));
          }
        }
      } catch {
        // Fallback to backend API
      }

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
      // 1. Direct Supabase query for instant loading
      try {
        const { data: conv, error: convErr } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', id)
          .neq('status', 'deleted')
          .single();

        if (!convErr && conv) {
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', id)
            .order('created_at', { ascending: true });

          return {
            id: conv.id,
            user_id: conv.user_id,
            title: conv.title || 'Health Consultation',
            status: (conv.status as 'active' | 'archived' | 'deleted') || 'active',
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            messages: (msgs as Message[]) || [],
          };
        }
      } catch {
        // Fallback to backend API
      }

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
          timeoutMs: 65000, // 65s for Render cold-start + AI inference
        }
      );

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
      try {
        const { error } = await supabase
          .from('conversations')
          .update({
            status: 'deleted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (!error) {
          return;
        }
      } catch {
        // Fallback to backend API
      }
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
        timeoutMs: 45000,
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
        timeoutMs: 65000,
      });
    },

    async listAnalyses(): Promise<ImageAnalysis[]> {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('image_analyses')
            .select('*')
            .eq('user_id', authData.user.id)
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            const signMarker = '/storage/v1/object/sign/health-images/';
            const enriched = await Promise.all(
              (data as ImageAnalysis[]).map(async (item) => {
                const rawPath = item.image_path || '';
                let relPath: string | null = null;
                if (rawPath.startsWith(`${authData.user!.id}/`)) {
                  relPath = rawPath;
                } else if (rawPath.includes(signMarker)) {
                  const candidate = rawPath.split(signMarker, 2)[1].split('?', 1)[0];
                  if (candidate.startsWith(`${authData.user!.id}/`)) {
                    relPath = candidate;
                  }
                }
                if (relPath) {
                  const { data: signed } = await supabase.storage
                    .from('health-images')
                    .createSignedUrl(relPath, 3600);
                  if (signed?.signedUrl) {
                    return { ...item, image_url: signed.signedUrl };
                  }
                }
                return { ...item, image_url: item.image_url || item.image_path };
              })
            );
            return enriched;
          }
        }
      } catch {
        // Fallback
      }

      const payload = await request<unknown>('/images/analyses');
      return extractArray<ImageAnalysis>(payload, ['analyses', 'items', 'data']);
    },
  },

  health: {
    async getRecords(recordType?: HealthRecordType): Promise<HealthRecord[]> {
      // 1. Direct Supabase query for instant sub-50ms loading
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          let query = supabase
            .from('health_records')
            .select('*')
            .eq('user_id', authData.user.id)
            .order('recorded_at', { ascending: false });

          if (recordType) {
            query = query.eq('record_type', recordType);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            return data as HealthRecord[];
          }
        }
      } catch {
        // Fallback
      }

      const qs = recordType ? `?record_type=${encodeURIComponent(recordType)}` : '';
      const payload = await request<unknown>(`/health/records${qs}`);
      return extractArray<HealthRecord>(payload, ['records', 'items', 'data']);
    },

    async addRecord(payload: HealthRecordCreate): Promise<HealthRecord> {
      // 1. Direct Supabase insert for instant sub-50ms speed
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('health_records')
            .insert({
              user_id: authData.user.id,
              record_type: payload.record_type,
              data: payload.data,
              source: payload.source || 'user_entered',
              recorded_at: payload.recorded_at || new Date().toISOString(),
            })
            .select()
            .single();

          if (!error && data) {
            return data as HealthRecord;
          }
        }
      } catch {
        // Fallback
      }

      return request<HealthRecord>('/health/records', {
        method: 'POST',
        body: payload,
      });
    },

    async getSummary(): Promise<HealthSummary> {
      // 1. Check existing records in Supabase directly
      let cachedRecords: HealthRecord[] = [];
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data: records, error } = await supabase
            .from('health_records')
            .select('*')
            .eq('user_id', authData.user.id)
            .order('recorded_at', { ascending: false })
            .limit(20);

          if (!error) {
            cachedRecords = (records as HealthRecord[]) || [];
            if (cachedRecords.length === 0) {
              // Return instant empty summary for fresh users
              return {
                summary:
                  "You haven't logged any health records yet. Once you add vital signs, symptoms, or medications, we will compile a personalized overview of your recent trends to review with your doctor.",
                record_count: 0,
                generated_at: new Date().toISOString(),
                highlights: [],
                recommendations: [
                  'Log your vital signs (blood pressure, heart rate, SpO2) using the "+ Log Vitals" button.',
                  'Start an AI health conversation to discuss symptoms or ask health questions.',
                ],
              };
            }
          }
        }
      } catch {
        // Continue
      }

      // 2. If records exist, try backend AI summary with generous timeout
      try {
        const raw = await request<Record<string, unknown>>('/health/summary', {
          timeoutMs: 35000,
        });
        return {
          summary:
            typeof raw.summary === 'string'
              ? raw.summary
              : typeof raw.message === 'string'
              ? raw.message
              : '',
          record_count:
            typeof raw.record_count === 'number' ? raw.record_count : cachedRecords.length,
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
      } catch {
        // 3. Graceful fallback from client records
        const categories = Array.from(
          new Set(cachedRecords.map((r) => r.record_type.replace(/_/g, ' ')))
        );
        return {
          summary:
            `You have ${cachedRecords.length || 1} recent health record(s) securely logged. Consult a qualified medical practitioner for clinical evaluation.`,
          record_count: cachedRecords.length || 1,
          generated_at: new Date().toISOString(),
          highlights:
            categories.length > 0
              ? [`Categories logged: ${categories.join(', ')}`]
              : ['Health metrics recorded in Supabase'],
          recommendations: ['Review your recorded trends with your doctor during your next appointment.'],
        };
      }
    },
  },

  reports: {
    async generateReport(payload: ReportGenerateRequest): Promise<HealthReport> {
      return request<HealthReport>('/reports/generate', {
        method: 'POST',
        body: payload,
        timeoutMs: 60000,
      });
    },

    async listReports(): Promise<HealthReport[]> {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('health_reports')
            .select('*')
            .eq('user_id', authData.user.id)
            .order('generated_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            return data as HealthReport[];
          }
        }
      } catch {
        // Fallback
      }

      const payload = await request<unknown>('/reports');
      return extractArray<HealthReport>(payload, ['reports', 'items', 'data']);
    },

    async downloadReport(id: string): Promise<Blob> {
      return request<Blob>(`/reports/${encodeURIComponent(id)}/download`, {
        method: 'GET',
        responseType: 'blob',
        timeoutMs: 45000,
      });
    },
  },

  users: {
    async getProfile(): Promise<UserProfile> {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', authData.user.id)
            .single();

          if (!error && data) {
            return data as UserProfile;
          }

          return {
            id: authData.user.id,
            user_id: authData.user.id,
            display_name:
              (authData.user.user_metadata?.display_name as string) ||
              authData.user.email?.split('@')[0] ||
              'User',
            medical_conditions: [],
            allergies: [],
          };
        }
      } catch {
        // Fallback
      }
      return request<UserProfile>('/users/profile');
    },

    async updateProfile(payload: UserProfileUpdate): Promise<UserProfile> {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('user_profiles')
            .upsert(
              {
                user_id: authData.user.id,
                ...payload,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            )
            .select()
            .single();

          if (!error && data) {
            return data as UserProfile;
          }
        }
      } catch {
        // Fallback
      }
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
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('privacy_settings')
            .select('*')
            .eq('user_id', authData.user.id)
            .single();

          if (!error && data) {
            return data as PrivacySettings;
          }

          return {
            data_collection_consent: true,
            ai_processing_consent: true,
            consent_updated_at: new Date().toISOString(),
          };
        }
      } catch {
        // Fallback
      }
      return request<PrivacySettings>('/privacy/settings');
    },

    async updateSettings(payload: PrivacySettingsUpdate): Promise<PrivacySettings> {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('privacy_settings')
            .upsert(
              {
                user_id: authData.user.id,
                ...payload,
                consent_updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            )
            .select()
            .single();

          if (!error && data) {
            return data as PrivacySettings;
          }
        }
      } catch {
        // Fallback
      }
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
      return request('/voice/status', { requiresAuth: false, timeoutMs: 25000 });
    },

    async synthesize(text: string, voiceId?: string): Promise<Blob> {
      return request<Blob>('/voice/synthesize', {
        method: 'POST',
        body: { text, voice_id: voiceId },
        responseType: 'blob',
        requiresAuth: false,
        timeoutMs: 30000,
      });
    },
  },
};
