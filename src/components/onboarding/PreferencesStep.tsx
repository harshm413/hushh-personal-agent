'use client';

import type { Preferences } from './OnboardingWizard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const WELLNESS_OPTIONS = ['Fitness', 'Meditation', 'Spa', 'Nutrition', 'Yoga', 'Mental Health'];
const CATEGORY_OPTIONS = ['Restaurants', 'Travel', 'Wellness', 'Entertainment', 'Shopping', 'Sports'];

interface PreferencesStepProps {
  preferences: Preferences;
  onChange: (prefs: Preferences) => void;
}

export function PreferencesStep({ preferences, onChange }: PreferencesStepProps) {
  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold">Set Your Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          All fields are optional — you can update these later in settings
        </p>
      </div>

      {/* Financial Preferences for Kai */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Financial Preferences (for Kai)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Risk Tolerance</label>
            <div className="flex gap-3">
              {['conservative', 'moderate', 'aggressive'].map((level) => (
                <label
                  key={level}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="radio"
                    name="riskTolerance"
                    value={level}
                    checked={preferences.riskTolerance === level}
                    onChange={(e) => onChange({ ...preferences, riskTolerance: e.target.value })}
                    className="accent-primary"
                  />
                  <span className="capitalize">{level}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="investmentGoals" className="text-sm font-medium mb-2 block">
              Investment Goals
            </label>
            <textarea
              id="investmentGoals"
              value={preferences.investmentGoals}
              onChange={(e) => onChange({ ...preferences, investmentGoals: e.target.value })}
              placeholder="e.g., Save for retirement, build an emergency fund..."
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none resize-none dark:bg-input/30"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lifestyle Preferences for Nav */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifestyle Preferences (for Nav)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Wellness Interests</label>
            <div className="flex flex-wrap gap-2">
              {WELLNESS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...preferences,
                      wellnessInterests: toggleArrayItem(preferences.wellnessInterests, option.toLowerCase()),
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    preferences.wellnessInterests.includes(option.toLowerCase())
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Favorite Service Categories</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...preferences,
                      favoriteCategories: toggleArrayItem(preferences.favoriteCategories, option.toLowerCase()),
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    preferences.favoriteCategories.includes(option.toLowerCase())
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
