import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Shield,
  Trash2,
} from 'lucide-react';
import { api, ApiClientError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { PrivacySettings } from '../types';
import { formatDateTime } from '../utils/formatDate';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Modal } from '../components/common/Modal';

export function PrivacyPage() {
  const { user, reauthenticate, signOut } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Account deletion modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.privacy.getSettings();
      setSettings(data);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to load privacy settings.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleToggle = async (
    field: 'data_collection_consent' | 'ai_processing_consent'
  ) => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    const nextPayload = {
      data_collection_consent:
        field === 'data_collection_consent'
          ? !settings.data_collection_consent
          : settings.data_collection_consent,
      ai_processing_consent:
        field === 'ai_processing_consent'
          ? !settings.ai_processing_consent
          : settings.ai_processing_consent,
    };

    try {
      const updated = await api.privacy.updateSettings(nextPayload);
      setSettings(updated);
      setSaveMessage('Privacy preferences updated.');
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to update privacy settings.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await api.users.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-health-monitor-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to export your account data.';
      setExportError(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    setDeleteError(null);

    if (!confirmPassword) {
      setDeleteError('Please enter your password to re-authenticate.');
      return;
    }

    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm permanent account deletion.');
      return;
    }

    setDeleting(true);
    try {
      const authCheck = await reauthenticate(confirmPassword);
      if (authCheck.error) {
        setDeleteError(authCheck.error);
        return;
      }

      await api.users.deleteAccount();
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Unable to delete account. Please try again.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading privacy controls..." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Privacy & Data Controls</h1>
        <p className="mt-1 text-sm text-gray-600">
          Control how your health data is stored, processed by AI, exported, or
          permanently deleted.
        </p>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => void loadSettings()} />}

      {saveMessage && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          {saveMessage}
        </div>
      )}

      {/* Consent Toggles */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <h2 className="text-base font-semibold text-gray-900">
            Consent Preferences
          </h2>
        </div>

        {settings && (
          <div className="divide-y divide-gray-200">
            <div className="flex items-start justify-between gap-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Health Data Collection & Storage
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Allow AI Health Monitor to store your symptom logs, vital signs,
                  conversations, and medical image history securely in your private
                  account.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.data_collection_consent}
                aria-label="Toggle health data collection consent"
                disabled={saving}
                onClick={() => void handleToggle('data_collection_consent')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
                  settings.data_collection_consent ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    settings.data_collection_consent
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-start justify-between gap-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  AI Processing Consent
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Allow your submitted text messages, health records, and uploaded
                  images to be processed by our AI model to generate health guidance,
                  summaries, and PDF reports.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.ai_processing_consent}
                aria-label="Toggle AI processing consent"
                disabled={saving}
                onClick={() => void handleToggle('ai_processing_consent')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
                  settings.ai_processing_consent ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    settings.ai_processing_consent ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="pt-3 text-xs text-gray-500">
              Consent last updated: {formatDateTime(settings.consent_updated_at)}
            </div>
          </div>
        )}
      </Card>

      {/* Export My Data */}
      <Card>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Export Your Data
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Download a complete machine-readable JSON copy of your profile,
              conversations, vital signs, image analyses, and reports.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void handleExportData()}
            loading={exporting}
            className="shrink-0"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export My Data (JSON)
          </Button>
        </div>
        {exportError && (
          <div className="mt-4">
            <ErrorMessage title="Export Failed" message={exportError} />
          </div>
        )}
      </Card>

      {/* Delete Account */}
      <Card className="border-red-200">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-red-700">
              Delete My Account
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Permanently delete your account and erase all conversations, health
              records, uploaded images, and reports. This action cannot be undone.
            </p>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmPassword('');
              setConfirmText('');
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="shrink-0"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Account
          </Button>
        </div>
      </Card>

      <Modal
        isOpen={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title="Confirm Permanent Account Deletion"
        size="sm"
      >
        <form
          onSubmit={(e) => void handleDeleteAccount(e)}
          noValidate
          className="space-y-4"
        >
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              This will permanently remove your account (
              <strong>{user?.email}</strong>) and cascade-delete every health record,
              chat history, image analysis, and generated report.
            </p>
          </div>

          {deleteError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {deleteError}
            </p>
          )}

          <Input
            id="delete-reauth-password"
            type="password"
            label="Verify your password"
            required
            placeholder="Enter your current password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Input
            id="delete-confirm-text"
            type="text"
            label='Type "DELETE" to confirm'
            required
            placeholder="DELETE"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={deleting}>
              Permanently Delete
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
