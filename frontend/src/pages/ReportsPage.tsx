import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Eye, FilePlus2, FileText } from 'lucide-react';
import { api, ApiClientError } from '../services/api';
import type { HealthReport } from '../types';
import { useConversations } from '../hooks/useConversations';
import { formatDate, formatDateTime } from '../utils/formatDate';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { ReportPreviewModal } from '../components/reports/ReportPreviewModal';

export function ReportsPage() {
  const {
    conversations,
    loading: convLoading,
    error: convError,
    refresh: refreshConversations,
  } = useConversations();

  const [reports, setReports] = useState<HealthReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);

  // Generator form state
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [includeVitals, setIncludeVitals] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportType, setReportType] = useState('comprehensive');
  const [formError, setFormError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [previewReport, setPreviewReport] = useState<HealthReport | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const list = await api.reports.listReports();
      setReports(list);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to load health reports.';
      setReportsError(msg);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    void api.wakeUp();
    void loadReports();
  }, [loadReports]);

  const toggleConversation = (id: string) => {
    setSelectedConvIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    if (formError) setFormError(null);
  };

  const selectAllConversations = () => {
    if (selectedConvIds.length === conversations.length) {
      setSelectedConvIds([]);
    } else {
      setSelectedConvIds(conversations.map((c) => c.id));
    }
    if (formError) setFormError(null);
  };

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (selectedConvIds.length === 0 && !includeVitals) {
      setFormError(
        'Select at least one conversation or enable "Include vital signs & health records".'
      );
      return;
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setFormError('Start date cannot be later than end date.');
      return;
    }

    setGenerating(true);
    try {
      const created = await api.reports.generateReport({
        conversation_ids: selectedConvIds,
        include_vitals: includeVitals,
        report_type: reportType,
        date_range:
          startDate || endDate
            ? {
                start_date: startDate || undefined,
                end_date: endDate || undefined,
              }
            : undefined,
      });

      setReports((prev) => [created, ...prev]);
      setPreviewReport(created);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to generate report. Please try again.';
      setFormError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (report: HealthReport) => {
    setDownloadingId(report.id);
    setDownloadError(null);
    try {
      const blob = await api.reports.downloadReport(report.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `health-report-${report.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to download PDF report.';
      setDownloadError(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Health Reports</h1>
        <p className="mt-1 text-sm text-gray-600">
          Generate structured PDF summaries from your AI consultations and vital signs
          to share with your healthcare provider.
        </p>
      </div>

      {/* Generate New Report Card */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <FilePlus2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <h2 className="text-base font-semibold text-gray-900">
            Generate New Report
          </h2>
        </div>

        <form onSubmit={(e) => void handleGenerate(e)} className="space-y-5">
          {formError && <ErrorMessage title="Validation Error" message={formError} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="report-type"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Report Type
              </label>
              <select
                id="report-type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="comprehensive">Comprehensive Health Summary</option>
                <option value="consultation">Consultation Summary</option>
                <option value="vitals">Vital Signs Summary</option>
              </select>
            </div>

            <Input
              id="report-start-date"
              type="date"
              label="From Date (optional)"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <Input
              id="report-end-date"
              type="date"
              label="To Date (optional)"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={includeVitals}
              onChange={(e) => setIncludeVitals(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Include recorded vital signs and health records in this report</span>
          </label>

          {/* Select Conversations */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Include Conversations ({selectedConvIds.length} selected)
              </span>
              {conversations.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllConversations}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  {selectedConvIds.length === conversations.length
                    ? 'Deselect all'
                    : 'Select all'}
                </button>
              )}
            </div>

            {convLoading ? (
              <LoadingSpinner size="sm" label="Loading conversations..." />
            ) : convError ? (
              <ErrorMessage
                message={convError}
                onRetry={() => void refreshConversations()}
              />
            ) : conversations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                No conversations available yet. You can still generate a report from
                your vital signs if enabled above.
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {conversations.map((conv) => {
                  const checked = selectedConvIds.includes(conv.id);
                  return (
                    <label
                      key={conv.id}
                      className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-sm hover:bg-gray-50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleConversation(conv.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate font-medium text-gray-900">
                          {conv.title || 'Health Consultation'}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-gray-500">
                        {formatDate(conv.updated_at || conv.created_at)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={generating}>
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              {generating ? 'Generating Report...' : 'Generate Health Report'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Past Reports List */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Generated Reports
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadReports()}
            disabled={reportsLoading}
          >
            Refresh
          </Button>
        </div>

        {downloadError && (
          <div className="mb-4">
            <ErrorMessage title="Download Error" message={downloadError} />
          </div>
        )}

        {reportsLoading ? (
          <LoadingSpinner label="Loading generated reports..." />
        ) : reportsError ? (
          <ErrorMessage
            message={reportsError}
            onRetry={() => void loadReports()}
          />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No reports generated yet"
            description="Configure your options above and click Generate Health Report to create a downloadable PDF summary."
          />
        ) : (
          <ul className="divide-y divide-gray-200" role="list">
            {reports.map((report) => (
              <li
                key={report.id}
                className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText
                      className="h-4 w-4 shrink-0 text-blue-600"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold capitalize text-gray-900">
                      {report.report_type.replace(/_/g, ' ')} Report
                    </span>
                    <Badge variant="blue">PDF</Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Generated {formatDateTime(report.generated_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewReport(report)}
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    Preview
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={downloadingId === report.id}
                    onClick={() => void handleDownload(report)}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download PDF
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReportPreviewModal
        report={previewReport}
        onClose={() => setPreviewReport(null)}
        onDownload={(r) => void handleDownload(r)}
        downloading={previewReport !== null && downloadingId === previewReport.id}
      />
    </div>
  );
}
