'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PersonaIntroStep } from './PersonaIntroStep';
import { PreferencesStep } from './PreferencesStep';
import { ConsentStep } from './ConsentStep';
import { CompletionStep } from './CompletionStep';

export interface Preferences {
  riskTolerance: string;
  investmentGoals: string;
  wellnessInterests: string[];
  favoriteCategories: string[];
}

export interface ConsentSelections {
  financial_records: boolean;
  contacts: boolean;
  calendar: boolean;
  wellness: boolean;
  preferences: boolean;
}

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({
    riskTolerance: '',
    investmentGoals: '',
    wellnessInterests: [],
    favoriteCategories: [],
  });
  const [consentSelections, setConsentSelections] = useState<ConsentSelections>({
    financial_records: false,
    contacts: false,
    calendar: false,
    wellness: false,
    preferences: false,
  });

  const saveAndRedirect = useCallback(async () => {
    setSaving(true);
    try {
      // Save preferences via profile API
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskTolerance: preferences.riskTolerance || null,
          investmentGoals: preferences.investmentGoals || null,
          wellnessInterests: preferences.wellnessInterests,
          favoriteCategories: preferences.favoriteCategories,
        }),
      });

      // Save consent toggles
      const consentMap: Record<string, { fieldId: string; personaScope: string }> = {
        financial_records: { fieldId: 'financial_record', personaScope: 'kai' },
        contacts: { fieldId: 'contact', personaScope: 'nav' },
        calendar: { fieldId: 'calendar_event', personaScope: 'both' },
        wellness: { fieldId: 'preference', personaScope: 'nav' },
        preferences: { fieldId: 'preference', personaScope: 'both' },
      };

      for (const [key, config] of Object.entries(consentMap)) {
        const enabled = consentSelections[key as keyof ConsentSelections];
        if (enabled) {
          await fetch('/api/consent', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fieldId: config.fieldId,
              enabled: true,
              personaScope: config.personaScope,
            }),
          });
        }
      }

      // Mark onboarding as done
      await fetch('/api/onboarding/complete', { method: 'PATCH' });

      toast.success('Welcome aboard! Let\'s get started.');
      router.push('/chat/new');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [preferences, consentSelections, router]);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkip = () => {
    saveAndRedirect();
  };

  const steps = [
    <PersonaIntroStep key="intro" />,
    <PreferencesStep key="prefs" preferences={preferences} onChange={setPreferences} />,
    <ConsentStep key="consent" selections={consentSelections} onChange={setConsentSelections} />,
    <CompletionStep key="complete" onComplete={saveAndRedirect} saving={saving} />,
  ];

  return (
    <div className="w-full max-w-2xl">
      {/* Progress indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors duration-200 ${
              i === currentStep
                ? 'bg-primary scale-125'
                : i < currentStep
                  ? 'bg-primary/50'
                  : 'bg-muted-foreground/30'
            }`}
          />
        ))}
        <span className="ml-3 text-xs text-muted-foreground">
          Step {currentStep + 1} of {TOTAL_STEPS}
        </span>
      </div>

      {/* Step content with transitions */}
      <div className="relative overflow-hidden">
        <div
          className="transition-all duration-300 ease-in-out"
          style={{
            transform: `translateX(-${currentStep * 100}%)`,
          }}
        >
          <div className="flex">
            {steps.map((step, i) => (
              <div
                key={i}
                className="w-full flex-shrink-0 px-1"
                style={{
                  opacity: i === currentStep ? 1 : 0,
                  transition: 'opacity 300ms ease-in-out',
                }}
              >
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      {currentStep < TOTAL_STEPS - 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <Button variant="ghost" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSkip} disabled={saving}>
              Skip
            </Button>
            <Button onClick={handleNext}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
