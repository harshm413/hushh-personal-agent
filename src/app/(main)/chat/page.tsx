'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function ChatPage() {
  const router = useRouter();
  const { status } = useSession();
  const [creating, setCreating] = useState(false);

  async function startConversation(personaId: string) {
    if (creating) return;
    setCreating(true);
    // Navigate to /chat/new — the conversation will be created when the first message is sent,
    // using the message text as the title instead of a generic "New conversation"
    router.push(`/chat/new?persona=${personaId}`);
    setCreating(false);
  }

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Start a conversation</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Choose a persona to begin chatting. Kai is your financial advisor and Nav is your lifestyle concierge.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => startConversation('kai')}
          disabled={creating}
          className="flex flex-col items-center gap-3 rounded-xl border p-6 hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-2xl font-bold">
            K
          </div>
          <span className="font-medium">Kai</span>
          <span className="text-xs text-muted-foreground">Financial Advisor</span>
        </button>
        <button
          onClick={() => startConversation('nav')}
          disabled={creating}
          className="flex flex-col items-center gap-3 rounded-xl border p-6 hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl font-bold">
            N
          </div>
          <span className="font-medium">Nav</span>
          <span className="text-xs text-muted-foreground">Lifestyle Concierge</span>
        </button>
      </div>
    </div>
  );
}
