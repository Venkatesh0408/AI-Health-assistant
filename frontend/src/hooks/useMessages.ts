import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '../services/api';
import type { Conversation, EmergencyInfo, Message } from '../types';

export interface UseMessagesReturn {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  emergency: EmergencyInfo | null;
  dismissEmergency: () => void;
  refresh: () => Promise<void>;
  sendMessage: (
    content: string,
    imageFile?: File | null,
    overrideConversationId?: string
  ) => Promise<{ success: boolean; generatedTitle?: string }>;
}

function generateTitleFromMessage(content: string): string {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Health Consultation';
  return cleaned.length > 48 ? `${cleaned.slice(0, 48).trim()}...` : cleaned;
}

export function useMessages(conversationId: string | null): UseMessagesReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [emergency, setEmergency] = useState<EmergencyInfo | null>(null);
  const skipNextRefreshIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setConversation(null);
      setMessages([]);
      setEmergency(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (skipNextRefreshIdRef.current === conversationId) {
      skipNextRefreshIdRef.current = null;
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.chat.getConversation(conversationId);
      setConversation(data);
      const msgs = data.messages ?? [];
      setMessages(msgs);

      const lastEmergencyMsg = [...msgs]
        .reverse()
        .find((m) => m.metadata?.is_emergency === true || m.metadata?.emergency);
      if (lastEmergencyMsg?.metadata) {
        const meta = lastEmergencyMsg.metadata;
        const nested = meta.emergency as EmergencyInfo | undefined;
        if (nested?.is_emergency) {
          setEmergency(nested);
        } else if (meta.is_emergency === true) {
          setEmergency({
            is_emergency: true,
            category: typeof meta.category === 'string' ? meta.category : undefined,
            severity: typeof meta.severity === 'string' ? meta.severity : 'critical',
            message:
              typeof meta.emergency_message === 'string'
                ? meta.emergency_message
                : undefined,
          });
        } else {
          setEmergency(null);
        }
      } else {
        setEmergency(null);
      }
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to load conversation messages.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendMessage = useCallback(
    async (
      content: string,
      imageFile?: File | null,
      overrideConversationId?: string
    ): Promise<{ success: boolean; generatedTitle?: string }> => {
      const targetId = overrideConversationId ?? conversationId;
      if (!targetId) {
        return { success: false };
      }

      if (overrideConversationId && overrideConversationId !== conversationId) {
        skipNextRefreshIdRef.current = overrideConversationId;
      }

      const trimmed = content.trim();
      if (!trimmed && !imageFile) {
        return { success: false };
      }

      setSending(true);
      setError(null);

      let uploadedImageUrl: string | undefined;
      const localPreviewUrl = imageFile ? URL.createObjectURL(imageFile) : undefined;
      const optimisticId = `temp-${Date.now()}`;
      const isFirstMessage = messages.length === 0;

      const optimisticMessage: Message = {
        id: optimisticId,
        conversation_id: targetId,
        role: 'user',
        content: trimmed || 'Please analyze this attached image.',
        image_url: localPreviewUrl,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        if (imageFile) {
          const uploadRes = await api.images.uploadImage(imageFile);
          uploadedImageUrl = uploadRes.image_url;
        }

        const result = await api.chat.sendMessage(targetId, {
          content: trimmed || 'Please analyze this attached image.',
          image_url: uploadedImageUrl,
        });

        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== optimisticId);
          const confirmedUser: Message = result.user_message ?? {
            ...optimisticMessage,
            id: `user-${Date.now()}`,
            image_url: uploadedImageUrl ?? localPreviewUrl,
          };
          return [...withoutTemp, confirmedUser, result.assistant_message];
        });

        if (result.emergency?.is_emergency) {
          setEmergency(result.emergency);
        }

        const generatedTitle =
          result.conversation_title ||
          (isFirstMessage ? generateTitleFromMessage(trimmed) : undefined);

        if (generatedTitle) {
          setConversation((prev) =>
            prev ? { ...prev, title: generatedTitle } : prev
          );
        }

        return { success: true, generatedTitle };
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        const msg =
          err instanceof ApiClientError
            ? err.detail
            : 'Failed to send message. Please try again.';
        setError(msg);
        return { success: false };
      } finally {
        if (localPreviewUrl && uploadedImageUrl) {
          URL.revokeObjectURL(localPreviewUrl);
        }
        setSending(false);
      }
    },
    [conversationId, messages.length]
  );

  const dismissEmergency = useCallback(() => {
    setEmergency(null);
  }, []);

  return {
    conversation,
    messages,
    loading,
    sending,
    error,
    emergency,
    dismissEmergency,
    refresh,
    sendMessage,
  };
}
