'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PERSONAS = [
  {
    id: 'kai',
    name: 'Kai',
    description: 'Your personal financial advisor',
    initial: 'K',
  },
  {
    id: 'nav',
    name: 'Nav',
    description: 'Your lifestyle concierge',
    initial: 'N',
  },
] as const;

interface PersonaSelectorProps {
  currentPersonaId: string;
  onSelect: (personaId: string) => void;
}

export function PersonaSelector({
  currentPersonaId,
  onSelect,
}: PersonaSelectorProps) {
  return (
    <div className="flex gap-3 p-4">
      {PERSONAS.map((persona) => {
        const isActive = currentPersonaId === persona.id;
        return (
          <Card
            key={persona.id}
            className={cn(
              'flex-1 cursor-pointer transition-all hover:bg-muted/50',
              isActive && 'ring-2 ring-primary'
            )}
            onClick={() => onSelect(persona.id)}
          >
            <CardContent className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback>{persona.initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium">{persona.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {persona.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
