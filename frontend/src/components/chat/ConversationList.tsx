import { MessageSquarePlus, MessageSquare, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Conversation } from '../../types';
import { formatShortDate } from '../../utils/formatDate';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDeleteRequest: (conversation: Conversation) => void;
}

export function ConversationList({
  conversations,
  activeId,
  loading,
  creating,
  onSelect,
  onCreate,
  onDeleteRequest,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-3">
        <Button
          variant="primary"
          size="sm"
          onClick={onCreate}
          loading={creating}
          className="w-full"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <LoadingSpinner size="sm" label="Loading chats..." />
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare
              className="mx-auto mb-2 h-6 w-6 text-gray-400"
              aria-hidden="true"
            />
            <p className="text-xs text-gray-500">
              No conversations yet. Click &ldquo;New Chat&rdquo; to start a health consultation.
            </p>
          </div>
        ) : (
          <ul className="space-y-1" role="list">
            {conversations.map((conv) => {
              const isActive = conv.id === activeId;
              return (
                <li key={conv.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(conv.id)}
                    className={clsx(
                      'flex w-full flex-col rounded-lg px-3 py-2.5 pr-9 text-left transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <span className="truncate text-sm font-medium">
                      {conv.title || 'New Health Chat'}
                    </span>
                    <span className="mt-0.5 text-xs text-gray-500">
                      {formatShortDate(conv.updated_at || conv.created_at)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRequest(conv);
                    }}
                    aria-label={`Delete conversation ${conv.title || 'Untitled'}`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
