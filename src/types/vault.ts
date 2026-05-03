export type VaultEntryType = 'financial_record' | 'contact' | 'calendar_event' | 'preference' | 'booking' | 'escalation';

export interface FinancialRecord {
  type: 'financial_record';
  subtype: 'transaction' | 'holding' | 'budget';
  data: {
    description: string;
    amount: number;
    currency: string;
    category: string;
    date: string;
    account: string;
    metadata?: Record<string, unknown>;
  };
}

export interface Contact {
  type: 'contact';
  data: {
    name: string;
    email?: string;
    phone?: string;
    relationshipType: 'personal' | 'professional' | 'family';
    importantDates: { label: string; date: string }[];
    notes?: string;
    tags: string[];
    communicationHistory: { date: string; summary: string }[];
  };
}

export interface CalendarEvent {
  type: 'calendar_event';
  data: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: string;
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  };
}

export interface Preference {
  type: 'preference';
  data: {
    category: 'financial' | 'lifestyle' | 'notification';
    key: string;
    value: unknown;
  };
}

export interface Booking {
  type: 'booking';
  data: {
    serviceType: 'restaurant' | 'appointment' | 'service';
    venue: string;
    date: string;
    time: string;
    preferences?: string;
    status: 'pending' | 'confirmed' | 'cancelled';
  };
}

export type VaultEntryData = FinancialRecord | Contact | CalendarEvent | Preference | Booking;
