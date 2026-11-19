import { useState } from 'react';
import { AlertTriangle, Bot, Square, User as UserIcon, Volume2 } from 'lucide-react';
import clsx from 'clsx';
import type { Message } from '../../types';
import { formatTime } from '../../utils/formatDate';
import { markdownToHtml } from '../../utils/markdown';
import { getLanguageByCode } from '../../utils/languages';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../../utils/speech';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isEmergency = Boolean(
    message.metadata?.is_emergency === true ||
      (message.metadata?.emergency as { is_emergency?: boolean } | undefined)
        ?.is_emergency
  );

  const langCode = typeof message.metadata?.language === 'string' ? message.metadata.language : 'en';
  const langInfo = getLanguageByCode(langCode);
  const speechSupported = isSpeechSynthesisSupported();

  const handleToggleSpeak = () => {
    if (isPlayingVoice) {
      stopSpeaking();
      setIsPlayingVoice(false);
      return;
    }

    setIsPlayingVoice(true);
    speakText(message.content, {
      speechLang: langInfo.speechCode,
      onStart: () => setIsPlayingVoice(true),
      onEnd: () => setIsPlayingVoice(false),
      onError: () => setIsPlayingVoice(false),
    });
  };

  if (isSystem) {
    return (
      <div className="my-2 flex justify-center">
        <div className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex w-full gap-2.5',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div
          className={clsx(
            'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            isEmergency
              ? 'bg-red-100 text-red-700'
              : 'bg-emerald-100 text-emerald-700'
          )}
          aria-hidden="true"
        >
          {isEmergency ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>
      )}

      <div
        className={clsx(
          'group relative max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%]',
          isUser
            ? 'rounded-br-sm bg-blue-600 text-white'
            : isEmergency
            ? 'rounded-bl-sm border border-red-300 bg-red-50 text-gray-900'
            : 'rounded-bl-sm border border-gray-200 bg-gray-100 text-gray-900'
        )}
      >
        {message.image_url && (
          <div className="mb-2.5">
            <img
              src={message.image_url}
              alt="Attached medical image"
              className="max-h-60 rounded-lg border border-black/10 object-contain"
            />
          </div>
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
        ) : (
          <div
            className="markdown-content text-sm text-gray-900"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(message.content) }}
          />
        )}

        <div
          className={clsx(
            'mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-1.5 text-[11px]',
            isUser
              ? 'border-blue-500/40 text-blue-100'
              : 'border-gray-200 text-gray-500'
          )}
        >
          <div className="flex items-center gap-2">
            <span>{formatTime(message.created_at)}</span>
            {!isUser && isEmergency && (
              <span className="font-semibold text-red-700">Emergency Alert</span>
            )}
            {!isUser && langCode !== 'en' && (
              <span className="inline-flex items-center gap-1 rounded bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                {langInfo.flag} {langInfo.nativeName}
              </span>
            )}
          </div>

          {/* Voice Read-Aloud Button for Assistant Messages */}
          {!isUser && speechSupported && (
            <button
              type="button"
              onClick={handleToggleSpeak}
              title={isPlayingVoice ? 'Stop voice playback' : `Read aloud in ${langInfo.name}`}
              aria-label={isPlayingVoice ? 'Stop reading message' : 'Read message aloud'}
              className={clsx(
                'flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                isPlayingVoice
                  ? 'bg-blue-600 text-white animate-pulse'
                  : 'bg-white/80 text-gray-700 hover:bg-white hover:text-blue-600 border border-gray-200'
              )}
            >
              {isPlayingVoice ? (
                <>
                  <Square className="h-3 w-3" /> Stop
                </>
              ) : (
                <>
                  <Volume2 className="h-3 w-3" /> Listen
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"
          aria-hidden="true"
        >
          <UserIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
