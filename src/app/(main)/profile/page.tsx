'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ProfileData {
  name: string;
  email: string;
  avatar: string;
  timezone: string;
  preferredLanguage: string;
  riskTolerance: string | null;
  investmentGoals: string | null;
  incomeRange: string | null;
  wellnessInterests: string[];
  dietaryPreferences: string[];
  favoriteCategories: string[];
}

const TIMEZONES = [
  'UTC',
  // Americas
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Lima',
  // Europe
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Europe/Zurich',
  // Asia
  'Asia/Kolkata',
  'Asia/Mumbai',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Jakarta',
  'Asia/Taipei',
  'Asia/Manila',
  // Oceania
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Honolulu',
  // Africa
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Africa/Nairobi',
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
];

const INCOME_RANGES = [
  'Under $50k',
  '$50k-$100k',
  '$100k-$250k',
  '$250k-$500k',
  '$500k+',
];

const WELLNESS_OPTIONS = ['fitness', 'meditation', 'spa', 'nutrition', 'yoga', 'hiking'];
const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'gluten-free', 'keto', 'none'];
const CATEGORY_OPTIONS = ['restaurants', 'travel', 'wellness', 'entertainment', 'shopping'];

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [totpDialogOpen, setTotpDialogOpen] = useState(false);
  const [totpQrCode, setTotpQrCode] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        setProfile(await res.json());
      }
    } catch {
      toast.error('Failed to load profile');
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  function updateField<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleArrayItem(key: 'wellnessInterests' | 'dietaryPreferences' | 'favoriteCategories', item: string) {
    setProfile((prev) => {
      if (!prev) return prev;
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item],
      };
    });
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          avatar: profile.avatar,
          timezone: profile.timezone,
          preferredLanguage: profile.preferredLanguage,
          riskTolerance: profile.riskTolerance,
          investmentGoals: profile.investmentGoals,
          incomeRange: profile.incomeRange,
          wellnessInterests: profile.wellnessInterests,
          dietaryPreferences: profile.dietaryPreferences,
          favoriteCategories: profile.favoriteCategories,
        }),
      });
      if (res.ok) {
        setProfile(await res.json());
        toast.success('Profile saved');
      } else {
        toast.error('Failed to save profile');
      }
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleWebAuthnSetup() {
    try {
      const res = await fetch('/api/auth/webauthn/register', { method: 'POST' });
      if (res.ok) {
        toast.success('WebAuthn credential registered');
      } else {
        toast.error('WebAuthn setup failed');
      }
    } catch {
      toast.error('WebAuthn setup failed');
    }
  }

  async function handleTotpSetup() {
    try {
      const res = await fetch('/api/auth/totp/setup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTotpQrCode(data.qrCode ?? data.qr ?? null);
        setTotpDialogOpen(true);
      } else {
        toast.error('TOTP setup failed');
      }
    } catch {
      toast.error('TOTP setup failed');
    }
  }

  if (!profile) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Profile &amp; Preferences</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Name</span>
              <Input
                value={profile.name ?? ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Your name"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Avatar URL</span>
              <Input
                value={profile.avatar ?? ''}
                onChange={(e) => updateField('avatar', e.target.value)}
                placeholder="https://example.com/avatar.png"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Timezone</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={profile.timezone}
                onChange={(e) => updateField('timezone', e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Preferred Language</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={profile.preferredLanguage}
                onChange={(e) => updateField('preferredLanguage', e.target.value)}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Financial Preferences (Kai) */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Preferences (Kai)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Risk Tolerance</legend>
            <div className="flex gap-4">
              {(['conservative', 'moderate', 'aggressive'] as const).map((level) => (
                <label key={level} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="riskTolerance"
                    value={level}
                    checked={profile.riskTolerance === level}
                    onChange={() => updateField('riskTolerance', level)}
                    className="accent-primary"
                  />
                  <span className="capitalize">{level}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Investment Goals</span>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={profile.investmentGoals ?? ''}
              onChange={(e) => updateField('investmentGoals', e.target.value)}
              placeholder="Describe your investment goals…"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Income Range</span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={profile.incomeRange ?? ''}
              onChange={(e) => updateField('incomeRange', e.target.value)}
            >
              <option value="">Select…</option>
              {INCOME_RANGES.map((range) => (
                <option key={range} value={range}>{range}</option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      <Separator />

      {/* Lifestyle Preferences (Nav) */}
      <Card>
        <CardHeader>
          <CardTitle>Lifestyle Preferences (Nav)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Wellness Interests</legend>
            <div className="flex flex-wrap gap-3">
              {WELLNESS_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.wellnessInterests.includes(opt)}
                    onChange={() => toggleArrayItem('wellnessInterests', opt)}
                    className="accent-primary"
                  />
                  <span className="capitalize">{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Dietary Preferences</legend>
            <div className="flex flex-wrap gap-3">
              {DIETARY_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.dietaryPreferences.includes(opt)}
                    onChange={() => toggleArrayItem('dietaryPreferences', opt)}
                    className="accent-primary"
                  />
                  <span className="capitalize">{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Favorite Categories</legend>
            <div className="flex flex-wrap gap-3">
              {CATEGORY_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.favoriteCategories.includes(opt)}
                    onChange={() => toggleArrayItem('favoriteCategories', opt)}
                    className="accent-primary"
                  />
                  <span className="capitalize">{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Separator />

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Register a passkey for passwordless sign-in using biometrics or a security key.
            </p>
            <Button variant="outline" onClick={handleWebAuthnSetup}>
              Set Up WebAuthn / Passkey
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Enable two-factor authentication with an authenticator app (TOTP).
            </p>
            <Button variant="outline" onClick={handleTotpSetup}>
              Set Up 2FA (TOTP)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TOTP QR Code Dialog */}
      <Dialog open={totpDialogOpen} onOpenChange={setTotpDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).
          </p>
          {totpQrCode && (
            <img
              src={totpQrCode}
              alt="TOTP QR Code"
              className="mx-auto my-4 h-48 w-48"
            />
          )}
          <Button onClick={() => setTotpDialogOpen(false)} className="w-full">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
