import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, MessageSquare, PanelLeft } from 'lucide-react';
import type { Conversation } from '../types';
import { useConversations } from '../hooks/useConversations';
import { useMessages } from '../hooks/useMessages';
import { ConversationList } from '../components/chat/ConversationList';
import { MessageBubble } from '../components/chat/MessageBubble';
import { MessageInput } from '../components/chat/MessageInput';
import { EmergencyBanner } from '../components/chat/EmergencyBanner';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlConvId = searchParams.get('conversation');

  const {
    conversations,
    loading: convLoading,
    creating: convCreating,
    error: convError,
    refresh: refreshConversations,
    createConversation,
    deleteConversation,
    updateLocalTitle,
  } = useConversations();

  const [activeId, setActiveId] = useState<string | null>(urlConvId);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync URL query param -> activeId
  useEffect(() => {
    if (urlConvId) {
      setActiveId(urlConvId);
    } else if (!activeId && conversations.length > 0) {
      const firstId = conversations[0].id;
      setActiveId(firstId);
      setSearchParams({ conversation: firstId }, { replace: true });
    }
  }, [urlConvId, activeId, conversations, setSearchParams]);

  const {
    conversation,
    messages,
    loading: msgLoading,
    sending,
    error: msgError,
    emergency,
    dismissEmergency,
    refresh: refreshMessages,
    sendMessage,
  } = useMessages(activeId);

  // Auto-scroll to bottom on new messages or while AI responds
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    setSearchParams({ conversation: id });
    setMobileListOpen(false);
  };

  const handleCreateConversation = async () => {
    const created = await createConversation();
    if (created) {
      handleSelectConversation(created.id);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const ok = await deleteConversation(pendingDelete.id);
      if (ok) {
        if (activeId === pendingDelete.id) {
          const next = conversations.find((c) => c.id !== pendingDelete.id);
          if (next) {
            setActiveId(next.id);
            setSearchParams({ conversation: next.id }, { replace: true });
          } else {
            setActiveId(null);
            setSearchParams({}, { replace: true });
          }
        }
        setPendingDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleSend = async (content: string, imageFile?: File | null) => {
    let targetId = activeId;

    // Auto-create a conversation if none is currently selected
    if (!targetId) {
      const autoTitle =
        content.trim().length > 48
          ? `${content.trim().slice(0, 48)}...`
          : content.trim() || 'Image Consultation';
      const created = await createConversation(autoTitle);
      if (!created) return;
      targetId = created.id;
      setActiveId(created.id);
      setSearchParams({ conversation: created.id }, { replace: true });
    }

    const result = await sendMessage(content, imageFile, targetId);
    if (result.success && result.generatedTitle && targetId) {
      updateLocalTitle(targetId, result.generatedTitle);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-white">
      {/* Desktop Conversation Sidebar */}
      <div className="hidden w-72 shrink-0 md:block">
        <ErrorBoundary sectionName="Conversations">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            loading={convLoading}
            creating={convCreating}
            onSelect={handleSelectConversation}
            onCreate={() => void handleCreateConversation()}
            onDeleteRequest={(conv) => setPendingDelete(conv)}
          />
        </ErrorBoundary>
      </div>

      {/* Mobile Conversation Drawer */}
      {mobileListOpen && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-gray-900/50"
            onClick={() => setMobileListOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] bg-white shadow-xl">
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              loading={convLoading}
              creating={convCreating}
              onSelect={handleSelectConversation}
              onCreate={() => void handleCreateConversation()}
              onDeleteRequest={(conv) => setPendingDelete(conv)}
            />
          </div>
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="flex min-w-0 flex-1 flex-col bg-gray-50">
        {/* Chat Sub-Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileListOpen(true)}
              aria-label="Open conversations list"
              className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-gray-900 sm:text-base">
                {conversation?.title || 'AI Health Assistant'}
              </h1>
              <p className="text-xs text-gray-500">
                Confidential AI health consultation
              </p>
            </div>
          </div>
        </div>

        {/* Emergency Alert Banner */}
        {emergency?.is_emergency && (
          <EmergencyBanner emergency={emergency} onDismiss={dismissEmergency} />
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {convError && (
              <ErrorMessage
                title="Could not load conversations"
                message={convError}
                onRetry={() => void refreshConversations()}
              />
            )}

            {msgError && (
              <ErrorMessage
                title="Message error"
                message={msgError}
                onRetry={() => void refreshMessages()}
              />
            )}

            {msgLoading ? (
              <LoadingSpinner label="Loading conversation..." />
            ) : !activeId && conversations.length === 0 && !convLoading ? (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title="Start your first health consultation"
                description="Ask about symptoms, medications, lab reports, or attach a medical photo. Your conversations are saved privately so you can generate reports later."
                actionLabel="Start New Chat"
                onAction={() => void handleCreateConversation()}
              />
            ) : messages.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Bot className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">
                  How can I help with your health today?
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
                  Describe your symptoms, how long they have lasted, or attach a clear
                  photo for multimodal analysis.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}

            {sending && (
              <div className="flex items-start gap-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
                  aria-hidden="true"
                >
                  <Bot className="h-4 w-4" />
                </div>
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600"
                >
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                  <span>Analyzing your message...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input Bar */}
        <div className="mx-auto w-full max-w-4xl">
          <MessageInput onSend={handleSend} disabled={sending} />
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${
          pendingDelete?.title || 'this conversation'
        }"? This conversation will be removed from your active history.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
