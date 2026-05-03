'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { TrendingUp, Wallet, BarChart3, Heart, CalendarDays, Users } from 'lucide-react';

const KAI_CAPABILITIES = [
  { icon: Wallet, text: 'Portfolio analysis & tracking' },
  { icon: BarChart3, text: 'Spending insights & budgeting' },
  { icon: TrendingUp, text: 'Investment recommendations' },
];

const NAV_CAPABILITIES = [
  { icon: Heart, text: 'Wellness recommendations' },
  { icon: CalendarDays, text: 'Booking & scheduling assistance' },
  { icon: Users, text: 'Contact & relationship management' },
];

export function PersonaIntroStep() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Meet Your Personal Agents</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Two AI personas ready to help you manage your life
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kai Card */}
        <Card className="border-blue-500/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <TrendingUp className="size-6" />
              </div>
              <div>
                <CardTitle>Kai</CardTitle>
                <CardDescription>Your Financial Advisor</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {KAI_CAPABILITIES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="size-4 text-blue-500 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Nav Card */}
        <Card className="border-purple-500/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Heart className="size-6" />
              </div>
              <div>
                <CardTitle>Nav</CardTitle>
                <CardDescription>Your Lifestyle Concierge</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {NAV_CAPABILITIES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="size-4 text-purple-500 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
