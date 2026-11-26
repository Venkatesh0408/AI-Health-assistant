import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, MessageSquare, PanelLeft, Volume2, VolumeX } from 'lucide-react';
import clsx from 'clsx';
import type { Conversation, SupportedLanguage } from '../types';
import { api } from '../services/api';
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
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../utils/languages';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../utils/speech';

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

  // Multi-language & Voice preferences
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem('ai_health_lang');
    if (saved) {
      const match = SUPPORTED_LANGUAGES.find((l) => l.code === saved);
      if (match) return match;
    }
    return DEFAULT_LANGUAGE;
  });

  const [autoSpeakReplies, setAutoSpeakReplies] = useState<boolean>(() => {
    return localStorage.getItem('ai_health_auto_speak') === 'true';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const failedMessageRef = useRef<{
    content: string;
    imageFile?: File | null;
    language?: string;
  } | null>(null);
  const [slowWait, setSlowWait] = useState(false);

  // Proactively wake up the backend server when entering Chat
  useEffect(() => {
    void api.wakeUp();
  }, []);

  // Save language preference
  const handleLanguageChange = (lang: SupportedLanguage) => {
    setSelectedLanguage(lang);
    localStorage.setItem('ai_health_lang', lang.code);
  };

  // Toggle auto-speak
  const handleToggleAutoSpeak = () => {
    setAutoSpeakReplies((prev) => {
      const next = !prev;
      localStorage.setItem('ai_health_auto_speak', String(next));
      if (!next) {
        stopSpeaking();
      }
      return next;
    });
  };

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

  // Show cold-start hint if a response takes longer than 5 seconds
  useEffect(() => {
    if (!sending) {
      setSlowWait(false);
      return;
    }
    const timer = setTimeout(() => setSlowWait(true), 5000);
    return () => clearTimeout(timer);
  }, [sending]);

  const handleSelectConversation = (id: string) => {
    stopSpeaking();
    setActiveId(id);
    setSearchParams({ conversation: id });
    setMobileListOpen(false);
  };

  const handleCreateConversation = async () => {
    stopSpeaking();
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

  const handleSend = async (content: string, imageFile?: File | null, language?: string) => {
    let targetId = activeId;
    const activeLang = language || selectedLanguage.code;

    // Auto-create a conversation if none is currently selected
    if (!targetId) {
      const autoTitle =
        content.trim().length > 48
          ? `${content.trim().slice(0, 48)}...`
          : content.trim() || 'Health Consultation';
      const created = await createConversation(autoTitle);
      if (!created) {
        failedMessageRef.current = { content, imageFile, language: activeLang };
        return;
      }
      targetId = created.id;
      setActiveId(created.id);
      setSearchParams({ conversation: created.id }, { replace: true });
    }

    const result = await sendMessage(content, imageFile, targetId, activeLang);
    if (!result.success) {
      failedMessageRef.current = { content, imageFile, language: activeLang };
      return;
    }

    failedMessageRef.current = null;

    if (result.generatedTitle && targetId) {
      updateLocalTitle(targetId, result.generatedTitle);
    }

    // Auto-speak response using the actual newly received assistant message
    if (autoSpeakReplies && isSpeechSynthesisSupported() && result.assistantMessage) {
      speakText(result.assistantMessage.content, {
        speechLang: selectedLanguage.speechCode,
      });
    }
  };

  const handleRetryFailedOrRefresh = async () => {
    const failed = failedMessageRef.current;
    if (failed) {
      failedMessageRef.current = null;
      await handleSend(failed.content, failed.imageFile, failed.language);
    } else {
      await refreshMessages();
    }
  };

  const isSpeechSupported = isSpeechSynthesisSupported();

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
        {/* Chat Sub-Header with Language & Voice Auto-Play toggles */}
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
                Multi-lingual Voice & Text Health Consultation
              </p>
            </div>
          </div>

          {/* Quick controls: Active Language indicator + Auto-speak toggle */}
          <div className="flex items-center gap-2">
            {isSpeechSupported && (
              <button
                type="button"
                onClick={handleToggleAutoSpeak}
                title={
                  autoSpeakReplies
                    ? 'Auto-speak replies: ON (Click to mute)'
                    : 'Auto-speak replies: OFF (Click to hear AI replies automatically)'
                }
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                  autoSpeakReplies
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                )}
              >
                {autoSpeakReplies ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                    <span className="hidden sm:inline">Voice: Auto-On</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-gray-400" />
                    <span className="hidden sm:inline">Voice: Off</span>
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
              <span>{selectedLanguage.flag}</span>
              <span>{selectedLanguage.nativeName}</span>
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
                onRetry={() => void handleRetryFailedOrRefresh()}
              />
            )}

            {msgLoading ? (
              <LoadingSpinner label="Loading conversation..." />
            ) : !activeId && conversations.length === 0 && !convLoading ? (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title="Start your first health consultation"
                description="Ask about symptoms, medications, or speak into your microphone in any language. Your conversations are saved privately."
                actionLabel="Start New Chat"
                onAction={() => void handleCreateConversation()}
              />
            ) : messages.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Bot className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">
                  {selectedLanguage.code === 'hi'
                    ? 'मैं आज आपके स्वास्थ्य में कैसे मदद कर सकता हूँ?'
                    : selectedLanguage.code === 'ta'
                    ? 'இன்று உங்கள் உடல்நலத்திற்கு நான் எவ்வாறு உதவ முடியும்?'
                    : selectedLanguage.code === 'te'
                    ? 'నేను ఈ రోజు మీ ఆరోగ్యానికి ఎలా సహాయపడగలను?'
                    : 'How can I help with your health today?'}
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
                  Type or click the microphone to speak in{' '}
                  <span className="font-semibold text-gray-800">
                    {selectedLanguage.name} ({selectedLanguage.nativeName})
                  </span>
                  .
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUPPORTED_LANGUAGES.slice(0, 6).map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleLanguageChange(lang)}
                      className={clsx(
                        'rounded-full border px-3 py-1 text-xs transition-colors',
                        selectedLanguage.code === lang.code
                          ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      {lang.flag} {lang.nativeName}
                    </button>
                  ))}
                </div>
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
                  <span>
                    {slowWait
                      ? `Waking AI service & generating response in ${selectedLanguage.flag} ${selectedLanguage.name}...`
                      : `Responding in ${selectedLanguage.flag} ${selectedLanguage.name}...`}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input Bar with Voice & Multi-language Selection */}
        <div className="mx-auto w-full max-w-4xl">
          <MessageInput
            onSend={handleSend}
            disabled={sending}
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
          />
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
