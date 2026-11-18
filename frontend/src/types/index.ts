export interface User {
  id: string;
  email: string;
  display_name?: string;
}

export type GenderOption = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  date_of_birth?: string;
  gender?: GenderOption;
  medical_conditions: string[];
  allergies: string[];
}

export interface UserProfileUpdate {
  display_name?: string;
  date_of_birth?: string | null;
  gender?: GenderOption | null;
  medical_conditions?: string[];
  allergies?: string[];
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  image_url?: string;
  created_at: string;
}

export type HealthRecordType =
  | 'vital_signs'
  | 'symptom'
  | 'medication'
  | 'allergy'
  | 'condition'
  | 'note';

export type HealthRecordSource = 'user_entered' | 'ai_observed' | 'device_measured';

export interface HealthRecord {
  id: string;
  user_id: string;
  record_type: HealthRecordType;
  data: Record<string, unknown>;
  source: HealthRecordSource;
  recorded_at: string;
}

export interface HealthRecordCreate {
  record_type: HealthRecordType;
  data: Record<string, unknown>;
  source?: HealthRecordSource;
  recorded_at?: string;
}

export interface HealthSummary {
  summary: string;
  record_count?: number;
  generated_at?: string;
  highlights?: string[];
  recommendations?: string[];
}

export interface ImageAnalysis {
  id: string;
  user_id: string;
  image_path: string;
  image_url?: string;
  question: string;
  analysis: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ImageUploadResponse {
  image_url: string;
  image_path?: string;
  filename?: string;
  size_bytes?: number;
}

export interface HealthReport {
  id: string;
  user_id: string;
  report_type: string;
  content: Record<string, unknown>;
  pdf_path?: string;
  generated_at: string;
}

export interface ReportGenerateRequest {
  conversation_ids: string[];
  include_vitals: boolean;
  report_type?: string;
  date_range?: {
    start_date?: string;
    end_date?: string;
  };
}

export interface PrivacySettings {
  data_collection_consent: boolean;
  ai_processing_consent: boolean;
  consent_updated_at: string;
}

export interface PrivacySettingsUpdate {
  data_collection_consent: boolean;
  ai_processing_consent: boolean;
}

export interface EmergencyInfo {
  is_emergency: boolean;
  category?: string;
  severity?: string;
  message?: string;
}

export interface SendMessageResponse {
  user_message?: Message;
  assistant_message: Message;
  emergency?: EmergencyInfo;
  conversation_title?: string;
}

export interface ApiError {
  detail: string;
  status_code: number;
}
