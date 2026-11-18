import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '../services/api';
import type { UserProfile, UserProfileUpdate } from '../types';

export interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (payload: UserProfileUpdate) => Promise<UserProfile | null>;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.users.getProfile();
      setProfile(data);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to load your profile.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateProfile = useCallback(
    async (payload: UserProfileUpdate): Promise<UserProfile | null> => {
      setSaving(true);
      setError(null);
      try {
        const updated = await api.users.updateProfile(payload);
        setProfile(updated);
        return updated;
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? err.detail
            : 'Failed to update profile.';
        setError(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return {
    profile,
    loading,
    saving,
    error,
    refresh,
    updateProfile,
  };
}
