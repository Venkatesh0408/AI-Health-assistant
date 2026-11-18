import { AlertTriangle, Bot, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import type { Message } from '../../types';
import { formatTime } from '../../utils/formatDate';
import { markdownToHtml } from '../../utils/markdown';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isEmergency = Boolean(
    message.metadata?.is_emergency === true ||
      (message.metadata?.emergency as { is_emergency?: boolean } | undefined)
        ?.is_emergency
  );

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
          'max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%]',
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
            'mt-1.5 flex items-center gap-2 text-[11px]',
            isUser ? 'justify-end text-blue-100' : 'justify-start text-gray-500'
          )}
        >
          <span>{formatTime(message.created_at)}</span>
          {!isUser && isEmergency && (
            <span className="font-semibold text-red-700">Emergency Alert</span>
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
