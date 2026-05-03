'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: { role: string; content: string; createdAt?: string };
  personaAvatar?: string;
  personaName?: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function MessageBubble({
  message,
  personaAvatar,
  personaName,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex gap-2 px-4 py-1.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <Avatar size="sm" className="mt-1 shrink-0">
          <AvatarFallback>
            {personaAvatar || personaName?.charAt(0) || 'A'}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex max-w-[75%] flex-col gap-0.5')}>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                if (isBlock) {
                  return (
                    <code
                      className={cn(
                        'block overflow-x-auto rounded-md bg-black/10 p-2 text-xs',
                        isUser ? 'bg-white/10' : 'bg-black/5'
                      )}
                    >
                      {children}
                    </code>
                  );
                }
                return (
                  <code
                    className={cn(
                      'rounded px-1 py-0.5 text-xs',
                      isUser
                        ? 'bg-white/15'
                        : 'bg-foreground/10'
                    )}
                  >
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="my-2 overflow-x-auto">{children}</pre>
              ),
              ul: ({ children }) => (
                <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>
              ),
              li: ({ children }) => <li className="mb-0.5">{children}</li>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  {children}
                </a>
              ),
              table: ({ children }) => (
                <div className="my-2 overflow-x-auto">
                  <table className="min-w-full text-xs">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border-b px-2 py-1 text-left font-semibold">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border-b px-2 py-1">{children}</td>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {message.createdAt && (
          <span
            className={cn(
              'px-1 text-[10px] text-muted-foreground',
              isUser ? 'text-right' : 'text-left'
            )}
          >
            {relativeTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
