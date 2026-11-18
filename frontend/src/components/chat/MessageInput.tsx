import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { ImagePlus, Send, X } from 'lucide-react';
import { validateImageFile } from '../../utils/validators';

interface MessageInputProps {
  onSend: (content: string, imageFile?: File | null) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Describe your symptoms or ask a health question... (Shift+Enter for new line)',
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setFileError(validation.error || 'Invalid image file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImage(null);
    setPreviewUrl(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (disabled) return;
    if (!text.trim() && !selectedImage) return;

    const contentToSend = text;
    const fileToSend = selectedImage;

    setText('');
    clearImage();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSend(contentToSend, fileToSend);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const canSend = !disabled && (Boolean(text.trim()) || Boolean(selectedImage));

  return (
    <div className="border-t border-gray-200 bg-white p-3 sm:p-4">
      {fileError && (
        <p role="alert" className="mb-2 text-xs text-red-600">
          {fileError}
        </p>
      )}

      {previewUrl && selectedImage && (
        <div className="mb-2.5 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
          <img
            src={previewUrl}
            alt="Selected attachment preview"
            className="h-14 w-14 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-gray-800">
              {selectedImage.name}
            </p>
            <p className="text-xs text-gray-500">
              {(selectedImage.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
          <button
            type="button"
            onClick={clearImage}
            aria-label="Remove attached image"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Attach an image"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Attach image (JPG, PNG, WebP up to 10MB)"
          aria-label="Attach image"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImagePlus className="h-5 w-5" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Message input"
          className="max-h-36 min-h-[40px] flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
        />

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-1.5 text-[11px] text-gray-500">
        AI Health Monitor provides informational guidance only and does not replace professional medical advice.
      </p>
    </div>
  );
}
