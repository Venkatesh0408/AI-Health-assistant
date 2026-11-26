import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  FileText,
  History,
  Image as ImageIcon,
  MessageSquare,
  MessageSquarePlus,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useConversations } from '../hooks/useConversations';
import { useHealthRecords } from '../hooks/useHealthRecords';
import { formatDateTime, formatRelativeTime } from '../utils/formatDate';
import { markdownToHtml } from '../utils/markdown';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { QuickVitalsModal } from '../components/dashboard/QuickVitalsModal';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    conversations,
    loading: convLoading,
    creating: convCreating,
    error: convError,
    refresh: refreshConversations,
    createConversation,
  } = useConversations(5);

  const {
    records: vitalRecords,
    summary,
    loading: vitalsLoading,
    summaryLoading,
    saving: vitalSaving,
    error: vitalsError,
    summaryError,
    refreshRecords: refreshVitals,
    refreshSummary,
    addRecord,
  } = useHealthRecords('vital_signs', { fetchSummary: true });

  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);

  useEffect(() => {
    void api.wakeUp();
  }, []);

  const displayName =
    user?.display_name || user?.email?.split('@')[0] || 'there';

  const handleStartNewChat = async () => {
    const created = await createConversation();
    if (created) {
      navigate(`/chat?conversation=${encodeURIComponent(created.id)}`);
    } else {
      navigate('/chat');
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {displayName}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Track your symptoms, review vital signs, and consult your AI health
            assistant.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => void handleStartNewChat()}
          loading={convCreating}
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          Start New Chat
        </Button>
      </div>

      {/* Quick Actions */}
      <section aria-labelledby="quick-actions-heading">
        <h2
          id="quick-actions-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500"
        >
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => void handleStartNewChat()}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">New Chat</p>
              <p className="text-xs text-gray-500">Ask AI about symptoms</p>
            </div>
          </button>

          <Link
            to="/images"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Upload Image</p>
              <p className="text-xs text-gray-500">Analyze medical photos</p>
            </div>
          </Link>

          <Link
            to="/history"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <History className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">View History</p>
              <p className="text-xs text-gray-500">Records & consultations</p>
            </div>
          </Link>

          <Link
            to="/reports"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Generate Report</p>
              <p className="text-xs text-gray-500">Export PDF for doctor</p>
            </div>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* AI Health Summary Card */}
        <ErrorBoundary sectionName="Health Summary">
          <Card className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <h2 className="text-base font-semibold text-gray-900">
                  Health Summary
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refreshSummary()}
                disabled={summaryLoading}
              >
                Refresh
              </Button>
            </div>

            {summaryLoading ? (
              <LoadingSpinner size="sm" label="Generating your health summary..." />
            ) : summaryError ? (
              <ErrorMessage
                title="Could not load health summary"
                message={summaryError}
                onRetry={() => void refreshSummary()}
              />
            ) : !summary || !summary.summary ? (
              <EmptyState
                icon={<Activity className="h-6 w-6" />}
                title="No health summary yet"
                description="Log your vital signs or start an AI health conversation so we can compile a personalized overview of your recent health trends."
                actionLabel="Log Vital Signs"
                onAction={() => setVitalsModalOpen(true)}
              />
            ) : (
              <div className="space-y-4">
                <div
                  className="markdown-content text-sm text-gray-700"
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(summary.summary),
                  }}
                />

                {summary.highlights && summary.highlights.length > 0 && (
                  <div className="rounded-lg bg-blue-50/60 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                      Key Highlights
                    </h3>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-gray-700">
                      {summary.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.generated_at && (
                  <p className="text-xs text-gray-500">
                    Last updated {formatRelativeTime(summary.generated_at)}
                  </p>
                )}
              </div>
            )}
          </Card>
        </ErrorBoundary>

        {/* Recent Conversations */}
        <ErrorBoundary sectionName="Recent Conversations">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Recent Conversations
              </h2>
              <Link
                to="/chat"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {convLoading ? (
              <LoadingSpinner size="sm" label="Loading conversations..." />
            ) : convError ? (
              <ErrorMessage
                title="Failed to load chats"
                message={convError}
                onRetry={() => void refreshConversations()}
              />
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title="No conversations yet"
                description="Start a consultation to discuss symptoms or ask health questions."
                actionLabel="New Chat"
                onAction={() => void handleStartNewChat()}
              />
            ) : (
              <ul className="divide-y divide-gray-100" role="list">
                {conversations.slice(0, 5).map((conv) => (
                  <li key={conv.id}>
                    <Link
                      to={`/chat?conversation=${encodeURIComponent(conv.id)}`}
                      className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-blue-600"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {conv.title || 'Health Consultation'}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {formatRelativeTime(conv.updated_at || conv.created_at)}
                        </p>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-gray-400"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </ErrorBoundary>
      </div>

      {/* Recent Vital Signs */}
      <ErrorBoundary sectionName="Recent Vital Signs">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Recent Vital Signs
              </h2>
              <p className="text-xs text-gray-500">
                Your latest recorded blood pressure, heart rate, temperature, and SpO2.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setVitalsModalOpen(true)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Log Vitals
            </Button>
          </div>

          {vitalsLoading ? (
            <LoadingSpinner size="sm" label="Loading vital signs..." />
          ) : vitalsError ? (
            <ErrorMessage
              title="Could not load vital signs"
              message={vitalsError}
              onRetry={() => void refreshVitals()}
            />
          ) : vitalRecords.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-6 w-6" />}
              title="No vital signs recorded"
              description="Record your blood pressure, heart rate, temperature, or oxygen saturation to track your health over time."
              actionLabel="Log First Reading"
              onAction={() => setVitalsModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vitalRecords.slice(0, 6).map((record) => {
                const entries = Object.entries(record.data).filter(
                  ([k, v]) =>
                    k !== 'systolic' &&
                    k !== 'diastolic' &&
                    v !== null &&
                    v !== undefined &&
                    v !== ''
                );

                return (
                  <div
                    key={record.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge variant="green">Vitals</Badge>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(record.recorded_at)}
                      </span>
                    </div>
                    <dl className="space-y-1 text-sm">
                      {entries.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2"
                        >
                          <dt className="capitalize text-gray-600">
                            {key.replace(/_/g, ' ')}
                          </dt>
                          <dd className="font-semibold text-gray-900">
                            {String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </ErrorBoundary>

      <QuickVitalsModal
        isOpen={vitalsModalOpen}
        onClose={() => setVitalsModalOpen(false)}
        saving={vitalSaving}
        onSave={async (payload) => {
          const created = await addRecord(payload);
          if (created) {
            void refreshSummary();
            return true;
          }
          return false;
        }}
      />
    </div>
  );
}
