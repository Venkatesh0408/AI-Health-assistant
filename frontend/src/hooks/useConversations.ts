import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '../services/api';
import type { Conversation } from '../types';

export interface UseConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  creating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation | null>;
  deleteConversation: (id: string) => Promise<boolean>;
  updateLocalTitle: (id: string, title: string) => void;
}

export function useConversations(limit?: number): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.chat.listConversations(limit ? { limit } : undefined);
      setConversations(list);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to load conversations.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createConversation = useCallback(
    async (title?: string): Promise<Conversation | null> => {
      setCreating(true);
      setError(null);
      try {
        const created = await api.chat.createConversation(title);
        setConversations((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? err.detail
            : 'Failed to create conversation.';
        setError(msg);
        return null;
      } finally {
        setCreating(false);
      }
    },
    []
  );

  const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      await api.chat.deleteConversation(id);
      setConversations((prev) => prev.filter((item) => item.id !== id));
      return true;
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to delete conversation.';
      setError(msg);
      return false;
    }
  }, []);

  const updateLocalTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, title, updated_at: new Date().toISOString() }
          : item
      )
    );
  }, []);

  return {
    conversations,
    loading,
    creating,
    error,
    refresh,
    createConversation,
    deleteConversation,
    updateLocalTitle,
  };
}
