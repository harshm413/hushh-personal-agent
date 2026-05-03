'use client';

import { cn } from '@/lib/utils';

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 px-4 py-2">
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
        <span
          className={cn(
            'inline-block size-2 rounded-full bg-muted-foreground/60 animate-bounce'
          )}
          style={{ animationDelay: '0ms' }}
        />
        <span
          className={cn(
            'inline-block size-2 rounded-full bg-muted-foreground/60 animate-bounce'
          )}
          style={{ animationDelay: '150ms' }}
        />
        <span
          className={cn(
            'inline-block size-2 rounded-full bg-muted-foreground/60 animate-bounce'
          )}
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}
