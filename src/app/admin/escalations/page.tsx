'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTimezone, formatInTimezone } from '@/hooks/useTimezone';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  MessageSquare,
  Send,
  User,
} from 'lucide-react';

interface EscalationUser {
  name: string | null;
  email: string | null;
}

interface Escalation {
  id: string;
  userId: string;
  personaId: string;
  originalQuery: string;
  preliminaryResponse: string | null;
  escalationReason: string;
  status: string;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  user: EscalationUser;
}

type StatusFilter = 'All' | 'pending' | 'in-review' | 'resolved';

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'All' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Review', value: 'in-review' },
  { label: 'Resolved', value: 'resolved' },
];

const PERSONA_OPTIONS = ['All', 'kai', 'nav'];

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <Clock className="mr-1 size-3" />
          Pending
        </Badge>
      );
    case 'in-review':
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Eye className="mr-1 size-3" />
          In Review
        </Badge>
      );
    case 'resolved':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="mr-1 size-3" />
          Resolved
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatTimestamp(iso: string, tz: string): string {
  return formatInTimezone(iso, tz);
}

export default function AdminEscalationsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [personaFilter, setPersonaFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [resolutionTexts, setResolutionTexts] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { timezone } = useTimezone();

  // Auth guard: redirect non-admin users
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session?.user?.email) {
      router.replace('/chat/new');
      return;
    }
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());
    if (!adminEmails.includes(session.user.email.toLowerCase())) {
      router.replace('/chat/new');
    }
  }, [session, sessionStatus, router]);

  const fetchEscalations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (personaFilter !== 'All') params.set('personaId', personaFilter);

      const res = await fetch(`/api/escalation?${params.toString()}`);
      if (!res.ok) {
        toast.error('Failed to fetch escalations');
        return;
      }
      const data: Escalation[] = await res.json();

      // Client-side date filtering
      let filtered = data;
      if (dateFrom) {
        const from = new Date(dateFrom);
        filtered = filtered.filter((e) => new Date(e.createdAt) >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter((e) => new Date(e.createdAt) <= to);
      }

      setEscalations(filtered);
    } catch {
      toast.error('Failed to fetch escalations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, personaFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchEscalations();
    }
  }, [sessionStatus, fetchEscalations]);

  async function handleResolve(escalationId: string) {
    const resolution = resolutionTexts[escalationId]?.trim();
    if (!resolution) {
      toast.error('Please enter a resolution');
      return;
    }

    setResolvingId(escalationId);
    try {
      const res = await fetch(`/api/escalation/${escalationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });

      if (!res.ok) {
        toast.error('Failed to resolve escalation');
        return;
      }

      toast.success('Escalation resolved');
      setResolutionTexts((prev) => {
        const next = { ...prev };
        delete next[escalationId];
        return next;
      });
      fetchEscalations();
    } catch {
      toast.error('Failed to resolve escalation');
    } finally {
      setResolvingId(null);
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-6 text-yellow-600" />
        <h1 className="text-xl font-semibold">Escalation Dashboard</h1>
      </div>

      {/* Filter controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Persona</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={personaFilter}
                onChange={(e) => setPersonaFilter(e.target.value)}
              >
                {PERSONA_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p === 'All' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Date From</label>
              <Input
                type="date"
                className="w-40"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Date To</label>
              <Input
                type="date"
                className="w-40"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={fetchEscalations}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Escalation list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading escalations…
        </div>
      ) : escalations.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No escalations found.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {escalations.map((esc) => (
            <Card key={esc.id}>
              <CardContent className="flex flex-col gap-4 pt-6">
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(esc.status)}
                    <Badge variant="outline">
                      {esc.personaId === 'kai' ? 'Kai' : 'Nav'}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(esc.createdAt, timezone)}
                  </span>
                </div>

                {/* User info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="size-4" />
                  <span>{esc.user.name ?? 'Unknown'}</span>
                  {esc.user.email && (
                    <span className="text-xs">({esc.user.email})</span>
                  )}
                </div>

                <Separator />

                {/* Original query */}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Original Query</p>
                  <p className="text-sm">{esc.originalQuery}</p>
                </div>

                {/* Preliminary AI response */}
                {esc.preliminaryResponse && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <MessageSquare className="size-3" />
                      AI Response
                    </p>
                    <p className="rounded-md bg-muted p-3 text-sm">{esc.preliminaryResponse}</p>
                  </div>
                )}

                {/* Escalation reason */}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Escalation Reason</p>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                    {esc.escalationReason}
                  </p>
                </div>

                {/* Resolution (if resolved) */}
                {esc.status === 'resolved' && esc.resolution && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Resolution</p>
                    <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
                      {esc.resolution}
                    </p>
                  </div>
                )}

                {/* Resolution form for pending/in-review */}
                {(esc.status === 'pending' || esc.status === 'in-review') && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Resolve this escalation
                      </label>
                      <textarea
                        className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Enter resolution details…"
                        value={resolutionTexts[esc.id] ?? ''}
                        onChange={(e) =>
                          setResolutionTexts((prev) => ({
                            ...prev,
                            [esc.id]: e.target.value,
                          }))
                        }
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleResolve(esc.id)}
                          disabled={resolvingId === esc.id}
                        >
                          <Send className="mr-1 size-4" />
                          {resolvingId === esc.id ? 'Resolving…' : 'Resolve'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
