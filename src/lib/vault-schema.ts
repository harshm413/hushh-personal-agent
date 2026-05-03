import { z } from 'zod';
import type { VaultEntryData } from '@/types/vault';

const financialRecordSchema = z.object({
  type: z.literal('financial_record'),
  subtype: z.enum(['transaction', 'holding', 'budget']),
  data: z.object({
    description: z.string(),
    amount: z.number(),
    currency: z.string(),
    category: z.string(),
    date: z.string(),
    account: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

const contactSchema = z.object({
  type: z.literal('contact'),
  data: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    relationshipType: z.enum(['personal', 'professional', 'family']),
    importantDates: z.array(z.object({ label: z.string(), date: z.string() })),
    notes: z.string().optional(),
    tags: z.array(z.string()),
    communicationHistory: z.array(z.object({ date: z.string(), summary: z.string() })),
  }),
});

const calendarEventSchema = z.object({
  type: z.literal('calendar_event'),
  data: z.object({
    title: z.string(),
    description: z.string().optional(),
    startTime: z.string(),
    endTime: z.string(),
    location: z.string().optional(),
    recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']),
  }),
});

const preferenceSchema = z.object({
  type: z.literal('preference'),
  data: z.object({
    category: z.enum(['financial', 'lifestyle', 'notification']),
    key: z.string(),
    value: z.unknown(),
  }),
});

const bookingSchema = z.object({
  type: z.literal('booking'),
  data: z.object({
    serviceType: z.enum(['restaurant', 'appointment', 'service']),
    venue: z.string(),
    date: z.string(),
    time: z.string(),
    preferences: z.string().optional(),
    status: z.enum(['pending', 'confirmed', 'cancelled']),
  }),
});

export const vaultEntrySchema = z.discriminatedUnion('type', [
  financialRecordSchema,
  contactSchema,
  calendarEventSchema,
  preferenceSchema,
  bookingSchema,
]);

export function validateVaultEntry(data: unknown): {
  valid: boolean;
  data?: VaultEntryData;
  errors?: { field: string; message: string }[];
} {
  const result = vaultEntrySchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data as VaultEntryData };
  }
  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
