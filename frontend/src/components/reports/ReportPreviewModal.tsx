import { Download, FileText } from 'lucide-react';
import type { HealthReport } from '../../types';
import { formatDateTime } from '../../utils/formatDate';
import { markdownToHtml } from '../../utils/markdown';
import { Modal } from '../common/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface ReportPreviewModalProps {
  report: HealthReport | null;
  onClose: () => void;
  onDownload: (report: HealthReport) => void;
  downloading?: boolean;
}

function renderContentValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? `- ${item}` : `- ${JSON.stringify(item)}`))
      .join('\n');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return '';
}

export function ReportPreviewModal({
  report,
  onClose,
  onDownload,
  downloading = false,
}: ReportPreviewModalProps) {
  if (!report) return null;

  const entries = Object.entries(report.content || {}).filter(
    ([, val]) => val !== null && val !== undefined && val !== ''
  );

  return (
    <Modal
      isOpen={Boolean(report)}
      onClose={onClose}
      title="Health Report Preview"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => onDownload(report)}
            loading={downloading}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download PDF
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span className="font-semibold capitalize text-gray-900">
              {report.report_type.replace(/_/g, ' ')} Report
            </span>
          </div>
          <Badge variant="blue">{formatDateTime(report.generated_at)}</Badge>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-gray-600">
            Report content is packaged in the downloadable PDF file.
          </p>
        ) : (
          <div className="space-y-4">
            {entries.map(([key, value]) => {
              const formattedKey = key
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());
              const strValue = renderContentValue(value);

              return (
                <section
                  key={key}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {formattedKey}
                  </h3>
                  {typeof value === 'string' || Array.isArray(value) ? (
                    <div
                      className="markdown-content text-sm text-gray-800"
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(strValue),
                      }}
                    />
                  ) : (
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-800">
                      {strValue}
                    </pre>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Medical Disclaimer:</strong> This AI-generated health summary is for
          informational and record-keeping purposes only. Share it with a licensed
          healthcare provider for clinical interpretation and medical decisions.
        </div>
      </div>
    </Modal>
  );
}
