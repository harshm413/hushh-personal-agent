'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { PersonaSelector } from '@/components/chat/PersonaSelector';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';

export default function ChatPage() {
  const params = useParams<{ conversationId: string }>();
  const searchParams = useSearchParams();
  const conversationId = params.conversationId;
  const isNew = conversationId === 'new';

  const personaFromQuery = searchParams.get('persona');
  const [selectedPersonaId, setSelectedPersonaId] = useState(personaFromQuery || 'kai');
  const [conversationPersonaId, setConversationPersonaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [chatStarted, setChatStarted] = useState(false);

  useEffect(() => {
    if (isNew) {
      setConversationPersonaId(null);
      setLoading(false);
      setChatStarted(false);
      return;
    }

    let cancelled = false;
    async function fetchConversation() {
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setConversationPersonaId(data.personaId);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchConversation();
    return () => { cancelled = true; };
  }, [conversationId, isNew]);

  const handleConversationCreated = useCallback(
    (newId: string) => {
      // Use history API to update URL without triggering a full page remount
      window.history.replaceState(null, '', `/chat/${newId}`);
    },
    []
  );

  const activePersonaId = conversationPersonaId ?? selectedPersonaId;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation sidebar — hidden on mobile */}
      <div className="hidden md:flex shrink-0">
        <ConversationSidebar activeConversationId={isNew ? undefined : conversationId} />
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {isNew && !chatStarted && (
          <PersonaSelector
            currentPersonaId={selectedPersonaId}
            onSelect={setSelectedPersonaId}
          />
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading conversation…
          </div>
        ) : (
          <ChatWindow
            key={conversationId}
            conversationId={isNew ? undefined : conversationId}
            personaId={activePersonaId}
            onConversationCreated={handleConversationCreated}
            onFirstMessageSent={() => setChatStarted(true)}
          />
        )}
      </div>
    </div>
  );
}
