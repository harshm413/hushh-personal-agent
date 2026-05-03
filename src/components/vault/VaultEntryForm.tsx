'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface VaultEntryFormProps {
  entryType?: string;
  initialData?: any;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

const ENTRY_TYPES = [
  { value: 'financial_record', label: 'Financial Record' },
  { value: 'contact', label: 'Contact' },
  { value: 'calendar_event', label: 'Calendar Event' },
  { value: 'preference', label: 'Preference' },
  { value: 'booking', label: 'Booking' },
];

function getDefaultFields(type: string): Record<string, unknown> {
  switch (type) {
    case 'financial_record':
      return { subtype: 'transaction', description: '', amount: 0, currency: 'USD', category: '', date: '', account: '' };
    case 'contact':
      return { name: '', email: '', phone: '', relationshipType: 'personal', notes: '', tags: '', importantDates: [], communicationHistory: [] };
    case 'calendar_event':
      return { title: '', description: '', date: '', startTime: '', endTime: '', endDate: '', location: '', recurrence: 'none' };
    case 'preference':
      return { category: 'financial', key: '', value: '' };
    case 'booking':
      return { serviceType: 'restaurant', venue: '', date: '', time: '', preferences: '', status: 'pending' };
    default:
      return {};
  }
}

function parseInitialData(type: string, initial: any): Record<string, unknown> {
  const d = initial?.decryptedData?.data ?? initial?.data ?? {};
  const defaults = getDefaultFields(type);
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(defaults)) {
    if (key === 'tags' && Array.isArray(d.tags)) {
      result.tags = d.tags.join(', ');
    } else {
      result[key] = d[key] ?? defaults[key];
    }
  }

  // Handle subtype at top level of decryptedData for financial_record
  if (type === 'financial_record' && initial?.decryptedData?.subtype) {
    result.subtype = initial.decryptedData.subtype;
  }

  // Convert ISO datetime strings to YYYY-MM-DD for date inputs
  const pad = (n: number) => String(n).padStart(2, '0');
  const toDateStr = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const toTimeStr = (dt: Date) => `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

  // Financial record: convert ISO date to YYYY-MM-DD for the date input
  if (type === 'financial_record' && d.date) {
    const parsed = new Date(d.date);
    if (!isNaN(parsed.getTime()) && String(d.date).includes('T')) {
      result.date = toDateStr(parsed);
    }
  }

  // Booking: convert ISO date to YYYY-MM-DD for the date input
  if (type === 'booking' && d.date) {
    const parsed = new Date(d.date);
    if (!isNaN(parsed.getTime()) && String(d.date).includes('T')) {
      result.date = toDateStr(parsed);
    }
  }

  // Split ISO datetimes into separate date/time fields for calendar events
  if (type === 'calendar_event') {
    if (d.startTime) {
      const startDt = new Date(d.startTime);
      result.date = toDateStr(startDt);
      result.startTime = toTimeStr(startDt);
    }
    if (d.endTime) {
      const endDt = new Date(d.endTime);
      result.endTime = toTimeStr(endDt);
      if (d.recurrence && d.recurrence !== 'none') {
        result.endDate = toDateStr(endDt);
      }
    }
  }

  return result;
}

export function VaultEntryForm({ entryType: initialType, initialData, onSubmit, onCancel }: VaultEntryFormProps) {
  const [selectedType, setSelectedType] = useState(
    initialType ?? initialData?.decryptedData?.type ?? initialData?.entryType ?? 'financial_record'
  );
  const [fields, setFields] = useState<Record<string, unknown>>(() =>
    initialData ? parseInitialData(selectedType, initialData) : getDefaultFields(selectedType)
  );

  useEffect(() => {
    if (!initialData) {
      setFields(getDefaultFields(selectedType));
    }
  }, [selectedType, initialData]);

  function updateField(key: string, value: unknown) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = { ...fields };

    // Convert tags from comma-separated string to array
    if (selectedType === 'contact' && typeof formData.tags === 'string') {
      formData.tags = (formData.tags as string).split(',').map((t: string) => t.trim()).filter(Boolean);
      // Convert empty optional strings to undefined for Zod validation
      if (formData.email === '') formData.email = undefined;
      if (formData.phone === '') formData.phone = undefined;
      if (formData.notes === '') formData.notes = undefined;
    }

    // Convert amount to number for financial records
    if (selectedType === 'financial_record') {
      formData.amount = Number(formData.amount);
      // Extract subtype to top level (schema expects { type, subtype, data })
      const { subtype, ...dataFields } = formData;
      onSubmit({ type: selectedType, subtype, data: dataFields } as any);
      return;
    }

    // Combine date + time into ISO strings for calendar events
    if (selectedType === 'calendar_event') {
      const startIso = new Date(`${formData.date}T${formData.startTime}`).toISOString();
      const endDateStr = (formData.recurrence as string) !== 'none' && formData.endDate
        ? (formData.endDate as string)
        : (formData.date as string);
      const endIso = new Date(`${endDateStr}T${formData.endTime}`).toISOString();
      formData.startTime = startIso;
      formData.endTime = endIso;
      // Remove helper fields that aren't part of the stored schema
      delete formData.date;
      delete formData.endDate;
      // Convert empty optional strings to undefined for Zod validation
      if (formData.description === '') formData.description = undefined;
      if (formData.location === '') formData.location = undefined;
    }

    // Convert empty optional strings to undefined for booking
    if (selectedType === 'booking') {
      if (formData.preferences === '') formData.preferences = undefined;
    }

    onSubmit({ type: selectedType, data: formData });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Type selector — only show if no fixed type */}
      {!initialType && !initialData && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Entry Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ENTRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dynamic fields based on type */}
      {selectedType === 'financial_record' && (
        <>
          <FormSelect label="Subtype" value={fields.subtype as string} onChange={(v) => updateField('subtype', v)}
            options={[{ value: 'transaction', label: 'Transaction' }, { value: 'holding', label: 'Holding' }, { value: 'budget', label: 'Budget' }]} />
          <FormInput label="Description" value={fields.description as string} onChange={(v) => updateField('description', v)} />
          <FormInput label="Amount" type="number" value={String(fields.amount)} onChange={(v) => updateField('amount', v)} />
          <FormInput label="Currency" value={fields.currency as string} onChange={(v) => updateField('currency', v)} />
          <FormInput label="Category" value={fields.category as string} onChange={(v) => updateField('category', v)} />
          <FormInput label="Date" type="date" value={fields.date as string} onChange={(v) => updateField('date', v)} />
          <FormInput label="Account" value={fields.account as string} onChange={(v) => updateField('account', v)} />
        </>
      )}

      {selectedType === 'contact' && (
        <>
          <FormInput label="Name" value={fields.name as string} onChange={(v) => updateField('name', v)} required />
          <FormInput label="Email" type="email" value={fields.email as string} onChange={(v) => updateField('email', v)} />
          <FormInput label="Phone" value={fields.phone as string} onChange={(v) => updateField('phone', v)} />
          <FormSelect label="Relationship Type" value={fields.relationshipType as string} onChange={(v) => updateField('relationshipType', v)}
            options={[{ value: 'personal', label: 'Personal' }, { value: 'professional', label: 'Professional' }, { value: 'family', label: 'Family' }]} />
          <FormInput label="Notes" value={fields.notes as string} onChange={(v) => updateField('notes', v)} />
          <FormInput label="Tags (comma-separated)" value={fields.tags as string} onChange={(v) => updateField('tags', v)} />
        </>
      )}

      {selectedType === 'calendar_event' && (
        <>
          <FormInput label="Title" value={fields.title as string} onChange={(v) => updateField('title', v)} required />
          <FormInput label="Description" value={fields.description as string} onChange={(v) => updateField('description', v)} />
          <FormInput label="Date" type="date" value={fields.date as string} onChange={(v) => updateField('date', v)} required />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Start Time" type="time" value={fields.startTime as string} onChange={(v) => updateField('startTime', v)} required />
            <FormInput label="End Time" type="time" value={fields.endTime as string} onChange={(v) => updateField('endTime', v)} required />
          </div>
          <FormInput label="Location" value={fields.location as string} onChange={(v) => updateField('location', v)} />
          <FormSelect label="Recurrence" value={fields.recurrence as string} onChange={(v) => updateField('recurrence', v)}
            options={[{ value: 'none', label: 'None' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} />
          {(fields.recurrence as string) !== 'none' && (
            <FormInput label="Repeat Until" type="date" value={fields.endDate as string} onChange={(v) => updateField('endDate', v)} required />
          )}
        </>
      )}

      {selectedType === 'preference' && (
        <>
          <FormSelect label="Category" value={fields.category as string} onChange={(v) => updateField('category', v)}
            options={[{ value: 'financial', label: 'Financial' }, { value: 'lifestyle', label: 'Lifestyle' }, { value: 'notification', label: 'Notification' }]} />
          <FormInput label="Key" value={fields.key as string} onChange={(v) => updateField('key', v)} required />
          <FormInput label="Value" value={String(fields.value ?? '')} onChange={(v) => updateField('value', v)} />
        </>
      )}

      {selectedType === 'booking' && (
        <>
          <FormSelect label="Service Type" value={fields.serviceType as string} onChange={(v) => updateField('serviceType', v)}
            options={[{ value: 'restaurant', label: 'Restaurant' }, { value: 'appointment', label: 'Appointment' }, { value: 'service', label: 'Service' }]} />
          <FormInput label="Venue" value={fields.venue as string} onChange={(v) => updateField('venue', v)} required />
          <FormInput label="Date" type="date" value={fields.date as string} onChange={(v) => updateField('date', v)} />
          <FormInput label="Time" type="time" value={fields.time as string} onChange={(v) => updateField('time', v)} />
          <FormInput label="Preferences" value={fields.preferences as string} onChange={(v) => updateField('preferences', v)} />
          <FormSelect label="Status" value={fields.status as string} onChange={(v) => updateField('status', v)}
            options={[{ value: 'pending', label: 'Pending' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'cancelled', label: 'Cancelled' }]} />
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initialData ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

/* ---- Helper sub-components ---- */

function FormInput({
  label, value, onChange, type = 'text', required = false,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

function FormSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value ?? options[0]?.value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
