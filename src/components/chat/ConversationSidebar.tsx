'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string;
  personaId: string;
  lastMessageAt: string;
  messagePreview: string | null;
  createdAt: string;
  updatedAt: string;
}

type PersonaFilter = 'all' | 'kai' | 'nav';

interface ConversationSidebarProps {
  activeConversationId?: string;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function truncateTitle(title: string, maxLen = 40): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 1) + '…';
}

export function ConversationSidebar({ activeConversationId }: ConversationSidebarProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [personaFilter, setPersonaFilter] = useState<PersonaFilter>('all');
  const [loading, setLoading] = useState(true);

  const [animatingTitles, setAnimatingTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch('/api/chat/conversations');
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();

    // Listen for new conversation events to refresh the list
    const handleRefresh = () => {
      fetchConversations();
    };

    // Listen for AI-generated title updates — animate typewriter style
    const handleTitleUpdate = (e: Event) => {
      const { conversationId: cId, title } = (e as CustomEvent).detail as {
        conversationId: string;
        title: string;
      };

      // Update the conversation in state with final title
      setConversations((prev) =>
        prev.map((c) => (c.id === cId ? { ...c, title } : c))
      );

      // Animate: type out the title character by character
      let i = 0;
      setAnimatingTitles((prev) => ({ ...prev, [cId]: '' }));
      const interval = setInterval(() => {
        i++;
        if (i > title.length) {
          clearInterval(interval);
          setAnimatingTitles((prev) => {
            const next = { ...prev };
            delete next[cId];
            return next;
          });
          return;
        }
        setAnimatingTitles((prev) => ({ ...prev, [cId]: title.slice(0, i) }));
      }, 40);
    };

    window.addEventListener('conversation-created', handleRefresh);
    window.addEventListener('conversation-title-update', handleTitleUpdate);
    return () => {
      window.removeEventListener('conversation-created', handleRefresh);
      window.removeEventListener('conversation-title-update', handleTitleUpdate);
    };
  }, []);

  const filtered = useMemo(() => {
    let result = conversations;
    if (personaFilter !== 'all') {
      result = result.filter((c) => c.personaId === personaFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }
    return result;
  }, [conversations, personaFilter, searchQuery]);

  async function handleRename(conv: Conversation) {
    const newTitle = window.prompt('Rename conversation', conv.title);
    if (!newTitle || newTitle === conv.title) return;
    try {
      const res = await fetch(`/api/chat/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, title: newTitle } : c))
        );
      }
    } catch {
      // silently fail
    }
  }

  async function handleDelete(conv: Conversation) {
    if (!window.confirm(`Delete "${truncateTitle(conv.title)}"?`)) return;
    try {
      const res = await fetch(`/api/chat/conversations/${conv.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        if (activeConversationId === conv.id) {
          router.push(`/chat/new`);
        }
      }
    } catch {
      // silently fail
    }
  }

  const PERSONA_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' }> = {
    kai: { label: 'K', variant: 'default' },
    nav: { label: 'N', variant: 'secondary' },
  };

  return (
    <aside className="flex h-full w-72 flex-col border-r bg-muted/30">
      {/* New Chat button */}
      <div className="p-3">
        <Button
          className="w-full justify-start gap-2"
          variant="outline"
          size="sm"
          onClick={() => { window.location.href = '/chat/new'; }}
        >
          <Plus className="size-4" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="relative px-3 pb-2">
        <Search className="absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search conversations…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 text-sm"
        />
      </div>

      {/* Filter buttons */}
      <div className="flex gap-1 px-3 pb-2">
        {(['all', 'kai', 'nav'] as const).map((f) => (
          <Button
            key={f}
            variant={personaFilter === f ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs capitalize"
            onClick={() => setPersonaFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'kai' ? 'Kai' : 'Nav'}
          </Button>
        ))}
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {loading && (
            <div className="px-2 py-8 text-center text-xs text-muted-foreground">
              Loading…
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="px-2 py-8 text-center text-xs text-muted-foreground">
              No conversations found
            </div>
          )}

          {filtered.map((conv) => {
            const badge = PERSONA_BADGE[conv.personaId] ?? { label: '?', variant: 'secondary' as const };
            const isActive = conv.id === activeConversationId;

            return (
              <div
                key={conv.id}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer transition-colors hover:bg-muted',
                  isActive && 'bg-muted'
                )}
                onClick={() => router.push(`/chat/${conv.id}`)}
              >
                <Badge variant={badge.variant} className="shrink-0 text-[10px]">
                  {badge.label}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">
                    {animatingTitles[conv.id] !== undefined
                      ? animatingTitles[conv.id] || '\u00A0'
                      : truncateTitle(conv.title)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(conv.lastMessageAt)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-muted-foreground/10 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(conv);
                      }}
                    >
                      <Pencil className="size-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(conv);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
