import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Image as ImageIcon, Search, Sparkles } from 'lucide-react';
import { api, ApiClientError } from '../services/api';
import type { ImageAnalysis } from '../types';
import { formatDateTime } from '../utils/formatDate';
import { markdownToHtml } from '../utils/markdown';
import { validateRequired } from '../utils/validators';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ImageDropzone } from '../components/images/ImageDropzone';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Modal } from '../components/common/Modal';

export function ImageAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [questionError, setQuestionError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<ImageAnalysis | null>(null);

  const [analyses, setAnalyses] = useState<ImageAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [viewingAnalysis, setViewingAnalysis] = useState<ImageAnalysis | null>(null);

  const loadAnalyses = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const list = await api.images.listAnalyses();
      setAnalyses(list);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Failed to load past image analyses.';
      setHistoryError(msg);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalyses();
  }, [loadAnalyses]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setSubmitError(null);
  };

  const handleClearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!selectedFile) {
      setFileError('Please select an image to analyze.');
      return;
    }

    const qCheck = validateRequired(question, 'Question');
    if (!qCheck.valid) {
      setQuestionError(qCheck.error || 'Please describe what you would like analyzed.');
      return;
    }
    setQuestionError(null);

    setSubmitting(true);
    try {
      const uploaded = await api.images.uploadImage(selectedFile);
      const result = await api.images.analyzeImage({
        image_url: uploaded.image_url,
        question: question.trim(),
      });

      const normalized: ImageAnalysis = {
        ...result,
        image_url: result.image_url || uploaded.image_url,
      };
      setLatestResult(normalized);
      setAnalyses((prev) => [normalized, ...prev]);
      setQuestion('');
      handleClearFile();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.detail
          : 'Unable to analyze image. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Medical Image Analysis</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload a clear photo (skin concerns, prescriptions, lab results) and ask a
          specific question for structured AI insights.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upload & Question Form */}
        <Card>
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Upload Image for Analysis
          </h2>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
            {submitError && (
              <ErrorMessage title="Analysis Failed" message={submitError} />
            )}

            <ImageDropzone
              file={selectedFile}
              previewUrl={previewUrl}
              onFileSelect={handleFileSelect}
              onClear={handleClearFile}
              error={fileError}
              onError={setFileError}
              disabled={submitting}
            />

            <div>
              <label
                htmlFor="image-question"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                What would you like to know about this image?{' '}
                <span className="text-red-600">*</span>
              </label>
              <textarea
                id="image-question"
                rows={3}
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  if (questionError) setQuestionError(null);
                }}
                disabled={submitting}
                placeholder="e.g., This rash appeared on my forearm two days ago and is mildly itchy. What could it indicate and when should I see a doctor?"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
              />
              {questionError && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {questionError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              className="w-full"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {submitting ? 'Uploading & Analyzing...' : 'Analyze Image'}
            </Button>
          </form>
        </Card>

        {/* Analysis Output */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Analysis Result
            </h2>
            {latestResult && (
              <Badge variant="green">
                {formatDateTime(latestResult.created_at)}
              </Badge>
            )}
          </div>

          {submitting ? (
            <LoadingSpinner label="Reviewing your image with multimodal AI..." />
          ) : latestResult ? (
            <div className="space-y-4">
              {(latestResult.image_url || latestResult.image_path) && (
                <img
                  src={latestResult.image_url || latestResult.image_path}
                  alt="Analyzed medical image"
                  className="max-h-56 w-full rounded-lg border border-gray-200 bg-gray-50 object-contain p-2"
                />
              )}

              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                  Your Question
                </p>
                <p className="mt-1 text-sm text-gray-900">{latestResult.question}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  AI Observations
                </p>
                <div
                  className="markdown-content text-sm text-gray-800"
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(latestResult.analysis),
                  }}
                />
              </div>

              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Disclaimer:</strong> Automated image analysis cannot confirm a
                clinical diagnosis. Please consult a healthcare professional for an
                in-person evaluation.
              </p>
            </div>
          ) : (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="Ready to analyze"
              description="Upload an image and enter your question on the left. Your structured AI review will appear here."
            />
          )}
        </Card>
      </div>

      {/* History of Past Analyses */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Past Image Analyses
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadAnalyses()}
            disabled={historyLoading}
          >
            Refresh
          </Button>
        </div>

        {historyLoading ? (
          <LoadingSpinner size="sm" label="Loading analysis history..." />
        ) : historyError ? (
          <ErrorMessage
            title="Could not load past analyses"
            message={historyError}
            onRetry={() => void loadAnalyses()}
          />
        ) : analyses.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="h-6 w-6" />}
            title="No image analyses yet"
            description="Your previously uploaded medical images and their AI analyses will be saved here for easy reference."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analyses.map((item) => {
              const imgSrc = item.image_url || item.image_path;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setViewingAnalysis(item)}
                  className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-colors hover:border-blue-300"
                >
                  <div className="flex h-36 w-full items-center justify-center bg-gray-100">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={item.question}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3.5">
                    <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                      {item.question}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                      {item.analysis}
                    </p>
                    <p className="mt-auto pt-2 text-[11px] text-gray-400">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        isOpen={Boolean(viewingAnalysis)}
        onClose={() => setViewingAnalysis(null)}
        title="Image Analysis Details"
        size="lg"
      >
        {viewingAnalysis && (
          <div className="space-y-4">
            {(viewingAnalysis.image_url || viewingAnalysis.image_path) && (
              <img
                src={viewingAnalysis.image_url || viewingAnalysis.image_path}
                alt={viewingAnalysis.question}
                className="max-h-72 w-full rounded-lg border border-gray-200 bg-gray-50 object-contain p-2"
              />
            )}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Recorded {formatDateTime(viewingAnalysis.created_at)}</span>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase text-blue-800">Question</p>
              <p className="mt-1 text-sm text-gray-900">{viewingAnalysis.question}</p>
            </div>
            <div
              className="markdown-content text-sm text-gray-800"
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(viewingAnalysis.analysis),
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
