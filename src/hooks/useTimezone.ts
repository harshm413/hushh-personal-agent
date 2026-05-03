'use client';

import { useState, useEffect, useCallback } from 'react';

let cachedTimezone: string | null = null;

export function useTimezone() {
  const [timezone, setTimezone] = useState<string>(
    cachedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );

  useEffect(() => {
    if (cachedTimezone) {
      setTimezone(cachedTimezone);
      return;
    }
    // Fetch user's timezone from profile
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.timezone) {
          cachedTimezone = data.timezone;
          setTimezone(data.timezone);
        }
      })
      .catch(() => {
        // fallback to browser timezone
      });
  }, []);

  const invalidateCache = useCallback(() => {
    cachedTimezone = null;
  }, []);

  return { timezone, invalidateCache };
}

/** Format a date string or Date in the given timezone */
export function formatInTimezone(
  dateInput: string | Date,
  tz: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  const defaults: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  return new Intl.DateTimeFormat('en-US', defaults).format(date);
}

/** Format just the date portion */
export function formatDateOnly(dateInput: string | Date, tz: string): string {
  return formatInTimezone(dateInput, tz, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: undefined,
    minute: undefined,
  });
}

/** Format just the time portion */
export function formatTimeOnly(dateInput: string | Date, tz: string): string {
  return formatInTimezone(dateInput, tz, {
    year: undefined,
    month: undefined,
    day: undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}
