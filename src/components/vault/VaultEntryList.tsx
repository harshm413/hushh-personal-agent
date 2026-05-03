'use client';

import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatInTimezone } from '@/hooks/useTimezone';

interface VaultEntryListProps {
  entries: any[];
  onEdit: (entry: any) => void;
  onDelete: (entryId: string) => void;
  timezone?: string;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  financial_record: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  contact: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  calendar_event: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  preference: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  booking: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
};

const TYPE_LABELS: Record<string, string> = {
  financial_record: 'Financial',
  contact: 'Contact',
  calendar_event: 'Calendar',
  preference: 'Preference',
  booking: 'Booking',
};

function getEntryDetails(entry: any, tz: string): { primary: string; secondary: string } {
  const d = entry.decryptedData;
  const data = d?.data ?? {};
  const type = d?.type ?? entry.entryType;

  switch (type) {
    case 'financial_record':
      return {
        primary: data.description ?? 'Untitled',
        secondary: `${data.amount ?? 0} ${data.currency ?? ''}`.trim(),
      };
    case 'contact':
      return {
        primary: data.name ?? 'Unknown',
        secondary: data.relationshipType ?? '',
      };
    case 'calendar_event':
      return {
        primary: data.title ?? 'Untitled',
        secondary: data.startTime
          ? formatInTimezone(data.startTime, tz, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
      };
    case 'preference':
      return {
        primary: data.key ?? 'Unknown',
        secondary: data.category ?? '',
      };
    case 'booking':
      return {
        primary: data.venue ?? 'Unknown venue',
        secondary: [data.date, data.time, data.status].filter(Boolean).join(' · '),
      };
    default:
      return { primary: 'Unknown entry', secondary: '' };
  }
}

export function VaultEntryList({ entries, onEdit, onDelete, timezone = 'UTC' }: VaultEntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No vault entries found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const type = entry.decryptedData?.type ?? entry.entryType;
        const { primary, secondary } = getEntryDetails(entry, timezone);
        const badgeColor = TYPE_BADGE_COLORS[type] ?? '';

        return (
          <Card key={entry.id} size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold',
                    badgeColor
                  )}
                >
                  {TYPE_LABELS[type] ?? type}
                </span>
              </CardTitle>
              <CardAction>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(entry)}
                    aria-label="Edit entry"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(entry.id)}
                    aria-label="Delete entry"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="truncate font-medium">{primary}</p>
              {secondary && (
                <p className="truncate text-xs text-muted-foreground">{secondary}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
