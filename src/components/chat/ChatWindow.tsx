'use client';

import { useEffect, useRef, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';

interface ChatWindowProps {
  conversationId?: string;
  personaId: string;
  onConversationCreated?: (id: string) => void;
  onFirstMessageSent?: () => void;
}

const PERSONA_META: Record<string, { name: string; initial: string }> = {
  kai: { name: 'Kai', initial: 'K' },
  nav: { name: 'Nav', initial: 'N' },
};

export function ChatWindow({
  conversationId: initialConversationId,
  personaId,
  onConversationCreated,
  onFirstMessageSent,
}: ChatWindowProps) {
  const {
    messages,
    isStreaming,
    error,
    conversationId,
    sendMessage,
    loadConversation,
  } = useChat();

  const bottomRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const pendingNavRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialConversationId && !loadedRef.current) {
      loadedRef.current = true;
      loadConversation(initialConversationId);
    }
  }, [initialConversationId, loadConversation]);

  // When a new conversation is created during streaming, defer navigation until streaming ends
  useEffect(() => {
    if (conversationId && onConversationCreated) {
      // Notify sidebar to refresh its list
      window.dispatchEvent(new Event('conversation-created'));
      if (isStreaming) {
        pendingNavRef.current = conversationId;
      } else {
        onConversationCreated(conversationId);
      }
    }
  }, [conversationId, onConversationCreated, isStreaming]);

  // Navigate after streaming completes if we have a pending conversation
  useEffect(() => {
    if (!isStreaming && pendingNavRef.current && onConversationCreated) {
      const id = pendingNavRef.current;
      pendingNavRef.current = null;
      onConversationCreated(id);
    }
  }, [isStreaming, onConversationCreated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = useCallback(
    (message: string) => {
      onFirstMessageSent?.();
      sendMessage(message, personaId);
    },
    [sendMessage, personaId, onFirstMessageSent]
  );

  const meta = PERSONA_META[personaId] || { name: 'Assistant', initial: 'A' };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col py-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
              Start a conversation with {meta.name}
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              personaName={meta.name}
              personaAvatar={meta.initial}
            />
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <TypingIndicator />
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {error && (
        <div className="border-t bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
