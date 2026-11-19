import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  Globe,
  ImagePlus,
  Mic,
  MicOff,
  Send,
  Square,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import type { SupportedLanguage } from '../../types';
import { validateImageFile } from '../../utils/validators';
import {
  LANGUAGE_PLACEHOLDERS,
  SUPPORTED_LANGUAGES,
} from '../../utils/languages';
import {
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  type SpeechRecognitionController,
} from '../../utils/speech';

interface MessageInputProps {
  onSend: (content: string, imageFile?: File | null, language?: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  selectedLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder,
  selectedLanguage,
  onLanguageChange,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const isSpeechSupported = isSpeechRecognitionSupported();

  // Close language menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        langMenuRef.current &&
        !langMenuRef.current.contains(event.target as Node)
      ) {
        setShowLangMenu(false);
      }
    }
    if (showLangMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLangMenu]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
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

  const handleToggleVoice = () => {
    if (disabled) return;

    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
      setVoiceNotice(null);
      return;
    }

    setVoiceNotice(`Listening in ${selectedLanguage.name}... (Speak clearly)`);
    setIsListening(true);

    recognitionRef.current = startSpeechRecognition({
      lang: selectedLanguage.speechCode,
      onStart: () => {
        setIsListening(true);
      },
      onResult: (transcript) => {
        setText((prev) => {
          const base = prev.trim();
          const separator = base ? ' ' : '';
          return `${base}${separator}${transcript}`.trimStart();
        });
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(
            textareaRef.current.scrollHeight,
            140
          )}px`;
        }
      },
      onError: (errMsg) => {
        setVoiceNotice(errMsg);
        setIsListening(false);
        recognitionRef.current = null;
      },
      onEnd: () => {
        setIsListening(false);
        setVoiceNotice(null);
        recognitionRef.current = null;
      },
    });
  };

  const handleSubmit = async () => {
    if (disabled) return;
    if (isListening) {
      handleToggleVoice();
    }
    if (!text.trim() && !selectedImage) return;

    const contentToSend = text;
    const fileToSend = selectedImage;

    setText('');
    clearImage();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSend(contentToSend, fileToSend, selectedLanguage.code);
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
  const activePlaceholder =
    placeholder ||
    LANGUAGE_PLACEHOLDERS[selectedLanguage.code] ||
    'Describe your symptoms or ask a health question...';

  return (
    <div className="border-t border-gray-200 bg-white p-3 sm:p-4">
      {fileError && (
        <p role="alert" className="mb-2 text-xs text-red-600">
          {fileError}
        </p>
      )}

      {/* Voice listening status banner */}
      {isListening && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600"></span>
            </span>
            <span className="font-medium">{voiceNotice}</span>
          </div>
          <button
            type="button"
            onClick={handleToggleVoice}
            className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-200"
          >
            <Square className="h-3 w-3" /> Stop
          </button>
        </div>
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
        {/* Hidden image input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Attach an image"
        />

        {/* Language selector dropdown */}
        <div className="relative" ref={langMenuRef}>
          <button
            type="button"
            onClick={() => setShowLangMenu((prev) => !prev)}
            disabled={disabled}
            title={`Current language: ${selectedLanguage.name}. Click to change.`}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <span className="text-base leading-none">{selectedLanguage.flag}</span>
            <span className="hidden sm:inline">{selectedLanguage.nativeName}</span>
            <Globe className="h-3.5 w-3.5 text-gray-500" />
          </button>

          {showLangMenu && (
            <div className="absolute bottom-12 left-0 z-50 w-56 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                Choose Conversation Language
              </div>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onLanguageChange(lang);
                    setShowLangMenu(false);
                  }}
                  className={clsx(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors',
                    selectedLanguage.code === lang.code
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.nativeName}</span>
                  </span>
                  <span className="text-[11px] text-gray-600">({lang.name})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attach image button */}
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

        {/* Microphone / Speech-to-Text Button */}
        {isSpeechSupported && (
          <button
            type="button"
            onClick={handleToggleVoice}
            disabled={disabled}
            title={
              isListening
                ? 'Stop listening'
                : `Voice input in ${selectedLanguage.name} (Click and speak)`
            }
            aria-label={isListening ? 'Stop recording voice' : 'Start voice input'}
            className={clsx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              isListening
                ? 'border-red-400 bg-red-600 text-white hover:bg-red-700 animate-pulse'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-red-600'
            )}
          >
            {isListening ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        )}

        {/* Text Input area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={activePlaceholder}
          aria-label="Message input"
          className="max-h-36 min-h-[40px] flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
        />

        {/* Send button */}
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

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-gray-500">
        <span>
          AI Health Monitor provides informational guidance only and does not replace professional medical advice.
        </span>
        <span className="font-medium text-gray-600">
          Speaking: {selectedLanguage.flag} {selectedLanguage.name}
        </span>
      </div>
    </div>
  );
}
