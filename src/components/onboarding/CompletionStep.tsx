'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Sparkles } from 'lucide-react';

interface CompletionStepProps {
  onComplete: () => void;
  saving: boolean;
}

export function CompletionStep({ onComplete, saving }: CompletionStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold">You're All Set!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal agents are ready to help
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="size-8 text-green-500" />
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Here's what's been set up:</p>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center justify-center gap-2">
                  <Sparkles className="size-3 text-blue-500" />
                  Kai is ready for financial insights
                </li>
                <li className="flex items-center justify-center gap-2">
                  <Sparkles className="size-3 text-purple-500" />
                  Nav is ready for lifestyle assistance
                </li>
                <li className="flex items-center justify-center gap-2">
                  <Sparkles className="size-3 text-green-500" />
                  Your preferences and consent have been saved
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              You can update your preferences and consent settings anytime from the settings page.
            </p>

            <Button onClick={onComplete} disabled={saving} size="lg" className="mt-2">
              {saving ? 'Saving...' : 'Get Started'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
