import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpDown,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { api, ApiClientError } from '../services/api';
import type { Conversation, HealthRecord, ImageAnalysis } from '../types';
import { useConversations } from '../hooks/useConversations';
import { useHealthRecords } from '../hooks/useHealthRecords';
import { formatDateTime } from '../utils/formatDate';
import { markdownToHtml } from '../utils/markdown';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { QuickVitalsModal } from '../components/dashboard/QuickVitalsModal';

type HistoryTab = 'conversations' | 'records' | 'images';
type SortOrder = 'newest' | 'oldest';

export function HistoryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<HistoryTab>('conversations');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const {
    conversations,
    loading: convLoading,
    error: convError,
    refresh: refreshConversations,
    deleteConversation,
  } = useConversations();

  const {
    records,
    loading: recordsLoading,
    saving: recordSaving,
    error: recordsError,
    refreshRecords,
    addRecord,
  } = useHealthRecords();

  const [analyses, setAnalyses] = useState<ImageAnalysis[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [analysesError, setAnalysesError] = useState<string | null>(null);

  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<ImageAnalysis | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);

  const loadAnalyses = useCallback(async () => {
    setAnalysesLoading(true);
    setAnalysesError(null);
    try {
      const list = await api.images.listAnalyses();
      setAnalyses(list);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to load image analyses.';
      setAnalysesError(msg);
    } finally {
      setAnalysesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalyses();
  }, [loadAnalyses]);

  const query = searchQuery.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    const list = conversations.filter((c) =>
      (c.title || 'Untitled').toLowerCase().includes(query)
    );
    return [...list].sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.updated_at || b.created_at).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [conversations, query, sortOrder]);

  const filteredRecords = useMemo(() => {
    const list = records.filter((r) => {
      const haystack = `${r.record_type} ${r.source} ${JSON.stringify(
        r.data
      )}`.toLowerCase();
      return haystack.includes(query);
    });
    return [...list].sort((a, b) => {
      const timeA = new Date(a.recorded_at).getTime();
      const timeB = new Date(b.recorded_at).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [records, query, sortOrder]);

  const filteredAnalyses = useMemo(() => {
    const list = analyses.filter((a) =>
      `${a.question} ${a.analysis}`.toLowerCase().includes(query)
    );
    return [...list].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [analyses, query, sortOrder]);

  const handleConfirmDeleteConversation = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const ok = await deleteConversation(deleteTarget.id);
      if (ok) setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const tabs: { id: HistoryTab; label: string; count: number }[] = [
    { id: 'conversations', label: 'Conversations', count: conversations.length },
    { id: 'records', label: 'Health Records', count: records.length },
    { id: 'images', label: 'Image Analyses', count: analyses.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health History</h1>
          <p className="mt-1 text-sm text-gray-600">
            Search and review all your past consultations, health records, and image
            analyses.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setVitalsModalOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Log Vital Signs
        </Button>
      </div>

      {/* Tabs + Search / Sort Controls */}
      <Card padding="sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div role="tablist" aria-label="History categories" className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-xs',
                    activeTab === tab.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history..."
                aria-label="Search history"
                className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
              }
            >
              <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <Card>
          {convLoading ? (
            <LoadingSpinner label="Loading conversations..." />
          ) : convError ? (
            <ErrorMessage
              message={convError}
              onRetry={() => void refreshConversations()}
            />
          ) : filteredConversations.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title={
                query ? 'No matching conversations' : 'No conversations recorded'
              }
              description={
                query
                  ? 'Try adjusting your search keywords.'
                  : 'Your AI health consultations will appear here once you start chatting.'
              }
              actionLabel={query ? undefined : 'Start New Chat'}
              onAction={query ? undefined : () => navigate('/chat')}
            />
          ) : (
            <ul className="divide-y divide-gray-200" role="list">
              {filteredConversations.map((conv) => (
                <li
                  key={conv.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/chat?conversation=${encodeURIComponent(conv.id)}`)
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-gray-900 hover:text-blue-600">
                      {conv.title || 'Health Consultation'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Updated {formatDateTime(conv.updated_at || conv.created_at)}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="blue">{conv.status}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/chat?conversation=${encodeURIComponent(conv.id)}`)
                      }
                    >
                      Open Chat
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${conv.title}`}
                      onClick={() => setDeleteTarget(conv)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Health Records Tab */}
      {activeTab === 'records' && (
        <Card>
          {recordsLoading ? (
            <LoadingSpinner label="Loading health records..." />
          ) : recordsError ? (
            <ErrorMessage
              message={recordsError}
              onRetry={() => void refreshRecords()}
            />
          ) : filteredRecords.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-6 w-6" />}
              title={query ? 'No matching records' : 'No health records yet'}
              description={
                query
                  ? 'Try another search term.'
                  : 'Log vital signs, symptoms, or medications to build your personal health timeline.'
              }
              actionLabel={query ? undefined : 'Log Vital Signs'}
              onAction={query ? undefined : () => setVitalsModalOpen(true)}
            />
          ) : (
            <ul className="divide-y divide-gray-200" role="list">
              {filteredRecords.map((record) => {
                const previewPairs = Object.entries(record.data)
                  .filter(([k]) => k !== 'systolic' && k !== 'diastolic')
                  .slice(0, 3);

                return (
                  <li
                    key={record.id}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="green">
                          {record.record_type.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="gray">
                          {record.source.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatDateTime(record.recorded_at)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm text-gray-800">
                        {previewPairs
                          .map(
                            ([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`
                          )
                          .join(' · ') || 'View full record details'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRecord(record)}
                    >
                      View Details
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {/* Image Analyses Tab */}
      {activeTab === 'images' && (
        <Card>
          {analysesLoading ? (
            <LoadingSpinner label="Loading image analyses..." />
          ) : analysesError ? (
            <ErrorMessage
              message={analysesError}
              onRetry={() => void loadAnalyses()}
            />
          ) : filteredAnalyses.length === 0 ? (
            <EmptyState
              icon={<ImageIcon className="h-6 w-6" />}
              title={
                query ? 'No matching image analyses' : 'No image analyses yet'
              }
              description={
                query
                  ? 'Try adjusting your search keywords.'
                  : 'Upload medical images on the Image Analysis page to see them listed here.'
              }
              actionLabel={query ? undefined : 'Go to Image Analysis'}
              onAction={query ? undefined : () => navigate('/images')}
            />
          ) : (
            <ul className="divide-y divide-gray-200" role="list">
              {filteredAnalyses.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {(item.image_url || item.image_path) && (
                      <img
                        src={item.image_url || item.image_path}
                        alt={item.question}
                        className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {item.question}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-600">
                        {item.analysis}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDateTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAnalysis(item)}
                  >
                    View Analysis
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Record Details Modal */}
      <Modal
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title="Health Record Details"
        size="md"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="green">
                {selectedRecord.record_type.replace(/_/g, ' ')}
              </Badge>
              <span className="text-xs text-gray-500">
                {formatDateTime(selectedRecord.recorded_at)}
              </span>
            </div>
            <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {Object.entries(selectedRecord.data).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                >
                  <dt className="capitalize text-gray-600">
                    {key.replace(/_/g, ' ')}
                  </dt>
                  <dd className="font-medium text-gray-900">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Modal>

      {/* Image Analysis Details Modal */}
      <Modal
        isOpen={Boolean(selectedAnalysis)}
        onClose={() => setSelectedAnalysis(null)}
        title="Image Analysis Details"
        size="lg"
      >
        {selectedAnalysis && (
          <div className="space-y-4">
            {(selectedAnalysis.image_url || selectedAnalysis.image_path) && (
              <img
                src={selectedAnalysis.image_url || selectedAnalysis.image_path}
                alt={selectedAnalysis.question}
                className="max-h-72 w-full rounded-lg border border-gray-200 bg-gray-50 object-contain p-2"
              />
            )}
            <p className="text-xs text-gray-500">
              Analyzed on {formatDateTime(selectedAnalysis.created_at)}
            </p>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase text-blue-800">
                Question
              </p>
              <p className="mt-1 text-sm text-gray-900">
                {selectedAnalysis.question}
              </p>
            </div>
            <div
              className="markdown-content text-sm text-gray-800"
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(selectedAnalysis.analysis),
              }}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDeleteConversation()}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${
          deleteTarget?.title || 'this conversation'
        }"?`}
        confirmLabel="Delete"
        loading={deleting}
      />

      <QuickVitalsModal
        isOpen={vitalsModalOpen}
        onClose={() => setVitalsModalOpen(false)}
        saving={recordSaving}
        onSave={async (payload) => {
          const created = await addRecord(payload);
          return Boolean(created);
        }}
      />
    </div>
  );
}
