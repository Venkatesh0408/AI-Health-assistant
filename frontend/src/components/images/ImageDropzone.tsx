import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import { MAX_IMAGE_SIZE_MB, validateImageFile } from '../../utils/validators';
import { Button } from '../ui/Button';

interface ImageDropzoneProps {
  file: File | null;
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  error: string | null;
  onError: (message: string | null) => void;
  disabled?: boolean;
}

export function ImageDropzone({
  file,
  previewUrl,
  onFileSelect,
  onClear,
  error,
  onError,
  disabled = false,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (candidate: File | undefined) => {
    onError(null);
    if (!candidate) return;
    const validation = validateImageFile(candidate);
    if (!validation.valid) {
      onError(validation.error || 'Invalid image file.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    onFileSelect(candidate);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    processFile(event.target.files?.[0]);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    processFile(event.dataTransfer.files?.[0]);
  };

  const handleClear = () => {
    if (inputRef.current) inputRef.current.value = '';
    onError(null);
    onClear();
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
        aria-label="Upload medical image"
      />

      {previewUrl && file ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div className="relative flex items-center justify-center bg-gray-900/5 p-4">
            <img
              src={previewUrl}
              alt="Selected medical image preview"
              className="max-h-72 rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              aria-label="Remove image"
              className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-gray-700 shadow hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2.5 text-xs text-gray-600">
            <span className="flex items-center gap-2 truncate font-medium text-gray-800">
              <ImageIcon className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
              <span className="truncate">{file.name}</span>
            </span>
            <span className="shrink-0 pl-2">
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </span>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Upload medical image by clicking or dragging and dropping"
          className={clsx(
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Upload className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-gray-900">
            Drag and drop your image here, or click to browse
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Supported formats: JPG, PNG, WebP (Max {MAX_IMAGE_SIZE_MB} MB)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            disabled={disabled}
          >
            Choose Image
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
