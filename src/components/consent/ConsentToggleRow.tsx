'use client';

import { Switch } from '@/components/ui/switch';

interface ConsentToggleRowProps {
  fieldId: string;
  label: string;
  description: string;
  kaiEnabled: boolean;
  navEnabled: boolean;
  kaiAllowed?: boolean;
  navAllowed?: boolean;
  onChange: (fieldId: string, persona: 'kai' | 'nav', enabled: boolean) => void;
}

export function ConsentToggleRow({
  fieldId,
  label,
  description,
  kaiEnabled,
  navEnabled,
  kaiAllowed = true,
  navAllowed = true,
  onChange,
}: ConsentToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className={`flex items-center gap-1.5${!kaiAllowed ? ' opacity-40' : ''}`}>
          <span className="text-xs text-muted-foreground">Kai</span>
          <Switch
            checked={kaiAllowed ? kaiEnabled : false}
            onCheckedChange={(checked) => onChange(fieldId, 'kai', !!checked)}
            disabled={!kaiAllowed}
            aria-label={kaiAllowed ? `Allow Kai access to ${label}` : `Kai cannot access ${label}`}
          />
        </div>
        <div className={`flex items-center gap-1.5${!navAllowed ? ' opacity-40' : ''}`}>
          <span className="text-xs text-muted-foreground">Nav</span>
          <Switch
            checked={navAllowed ? navEnabled : false}
            onCheckedChange={(checked) => onChange(fieldId, 'nav', !!checked)}
            disabled={!navAllowed}
            aria-label={navAllowed ? `Allow Nav access to ${label}` : `Nav cannot access ${label}`}
          />
        </div>
      </div>
    </div>
  );
}
