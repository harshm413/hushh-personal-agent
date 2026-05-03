'use client';

import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ActionResult {
  success: boolean;
  action: string;
  entryType?: string;
  entryId?: string;
  error?: string;
}

function stripActionBlocks(text: string): string {
  let result = text;
  while (true) {
    const startIdx = result.indexOf('<<<ACTION>>>');
    if (startIdx === -1) break;
    const endIdx = result.indexOf('<<<END_ACTION>>>', startIdx);
    if (endIdx === -1) break;
    result = result.slice(0, startIdx) + result.slice(endIdx + '<<<END_ACTION>>>'.length);
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [actionResults, setActionResults] = useState<ActionResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string, personaId: string) => {
      setError(null);

      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationId, personaId }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setError('AI service unavailable');
          setIsStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const resetTimeout = () => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            setError('Response timed out. Please try again.');
            setIsStreaming(false);
            controller.abort();
          }, 30000);
        };

        resetTimeout();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);

            if (payload === '[DONE]') {
              if (timeoutId) clearTimeout(timeoutId);
              setIsStreaming(false);
              return;
            }

            try {
              const data = JSON.parse(payload);

              if (data.conversationId) {
                setConversationId(data.conversationId);
              }

              if (data.titleUpdate) {
                window.dispatchEvent(
                  new CustomEvent('conversation-title-update', {
                    detail: data.titleUpdate,
                  })
                );
              }

              if (data.token) {
                resetTimeout();
                accumulated += data.token;
                const displayText = stripActionBlocks(accumulated);
                setMessages((prev) => {
                  const copy = [...prev];
                  const lastIdx = copy.length - 1;
                  if (
                    lastIdx >= 0 &&
                    copy[lastIdx].role === 'assistant'
                  ) {
                    copy[lastIdx] = {
                      ...copy[lastIdx],
                      content: displayText,
                    };
                  } else {
                    copy.push({
                      role: 'assistant',
                      content: displayText,
                      createdAt: new Date().toISOString(),
                    });
                  }
                  return copy;
                });
              }

              if (data.actionResult) {
                setActionResults((prev) => [...prev, data.actionResult]);
                // Append a status line to the assistant message
                const result = data.actionResult as ActionResult;
                const statusMsg = result.success
                  ? `\n\n✅ Created ${result.entryType?.replace('_', ' ')} in your vault.`
                  : `\n\n❌ Failed to create ${result.entryType?.replace('_', ' ')}: ${result.error}`;
                setMessages((prev) => {
                  const copy = [...prev];
                  const lastIdx = copy.length - 1;
                  if (lastIdx >= 0 && copy[lastIdx].role === 'assistant') {
                    copy[lastIdx] = {
                      ...copy[lastIdx],
                      content: copy[lastIdx].content + statusMsg,
                    };
                  }
                  return copy;
                });
              }

              if (data.error) {
                setError(data.error);
                setIsStreaming(false);
                if (timeoutId) clearTimeout(timeoutId);
                return;
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }

        if (timeoutId) clearTimeout(timeoutId);
        setIsStreaming(false);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('AI service unavailable');
        setIsStreaming(false);
      }
    },
    [conversationId]
  );

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${id}`);
      if (!res.ok) {
        setError('Failed to load conversation');
        return;
      }
      const data = await res.json();
      setConversationId(data.id);
      setMessages(
        (data.messages || []).map(
          (m: { role: string; content: string; createdAt: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: m.createdAt,
          })
        )
      );
    } catch {
      setError('Failed to load conversation');
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setActionResults([]);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    conversationId,
    actionResults,
    sendMessage,
    loadConversation,
    clearMessages,
  };
}
