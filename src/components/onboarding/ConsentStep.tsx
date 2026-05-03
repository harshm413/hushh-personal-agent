'use client';

import type { ConsentSelections } from './OnboardingWizard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Shield } from 'lucide-react';

const CONSENT_CATEGORIES = [
  {
    key: 'financial_records' as const,
    label: 'Financial Records',
    description: 'Transaction history, portfolio, and budget data',
    persona: 'Kai',
  },
  {
    key: 'contacts' as const,
    label: 'Contacts',
    description: 'Contact information and relationship data',
    persona: 'Nav',
  },
  {
    key: 'calendar' as const,
    label: 'Calendar',
    description: 'Calendar events and scheduling data',
    persona: 'Both',
  },
  {
    key: 'wellness' as const,
    label: 'Wellness Data',
    description: 'Health and wellness preferences',
    persona: 'Nav',
  },
  {
    key: 'preferences' as const,
    label: 'Preferences',
    description: 'Personal preferences and settings',
    persona: 'Both',
  },
];

interface ConsentStepProps {
  selections: ConsentSelections;
  onChange: (selections: ConsentSelections) => void;
}

export function ConsentStep({ selections, onChange }: ConsentStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold">Data Access Consent</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which data Kai and Nav can access to personalize your experience
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Data Categories</CardTitle>
          </div>
          <CardDescription>
            All toggles default to off. You can change these anytime in settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {CONSENT_CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat.description} · <span className="font-medium">For {cat.persona}</span>
                  </p>
                </div>
                <Switch
                  checked={selections[cat.key]}
                  onCheckedChange={(checked) =>
                    onChange({ ...selections, [cat.key]: checked })
                  }
                  aria-label={`Toggle ${cat.label}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
