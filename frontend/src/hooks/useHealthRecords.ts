import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '../services/api';
import type {
  HealthRecord,
  HealthRecordCreate,
  HealthRecordType,
  HealthSummary,
} from '../types';

export interface UseHealthRecordsReturn {
  records: HealthRecord[];
  summary: HealthSummary | null;
  loading: boolean;
  summaryLoading: boolean;
  saving: boolean;
  error: string | null;
  summaryError: string | null;
  refreshRecords: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  addRecord: (payload: HealthRecordCreate) => Promise<HealthRecord | null>;
}

export function useHealthRecords(
  recordType?: HealthRecordType,
  options?: { fetchSummary?: boolean }
): UseHealthRecordsReturn {
  const fetchSummaryFlag = options?.fetchSummary ?? false;

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(fetchSummaryFlag);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const refreshRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.health.getRecords(recordType);
      setRecords(data);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to load health records.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [recordType]);

  const refreshSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await api.health.getSummary();
      setSummary(data);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Unable to load health summary.';
      setSummaryError(msg);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRecords();
  }, [refreshRecords]);

  useEffect(() => {
    if (fetchSummaryFlag) {
      void refreshSummary();
    }
  }, [fetchSummaryFlag, refreshSummary]);

  const addRecord = useCallback(
    async (payload: HealthRecordCreate): Promise<HealthRecord | null> => {
      setSaving(true);
      setError(null);
      try {
        const created = await api.health.addRecord(payload);
        setRecords((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? err.detail
            : 'Failed to save health record.';
        setError(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return {
    records,
    summary,
    loading,
    summaryLoading,
    saving,
    error,
    summaryError,
    refreshRecords,
    refreshSummary,
    addRecord,
  };
}
