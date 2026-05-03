'use client';

import { useEffect, useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { VaultEntryList } from '@/components/vault/VaultEntryList';
import { VaultEntryForm } from '@/components/vault/VaultEntryForm';
import { useTimezone } from '@/hooks/useTimezone';

const ENTRY_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'financial_record', label: 'Financial Records' },
  { value: 'contact', label: 'Contacts' },
  { value: 'calendar_event', label: 'Calendar Events' },
  { value: 'preference', label: 'Preferences' },
  { value: 'booking', label: 'Bookings' },
];

export default function VaultPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { timezone } = useTimezone();

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/vault');
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filteredEntries =
    selectedType === 'all'
      ? entries
      : entries.filter(
          (e) => (e.decryptedData?.type ?? e.entryType) === selectedType
        );

  async function handleSubmit(formData: Record<string, unknown>) {
    try {
      if (editingEntry) {
        const res = await fetch(`/api/vault/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const updated = await res.json();
          setEntries((prev) =>
            prev.map((e) => (e.id === editingEntry.id ? updated : e))
          );
        }
      } else {
        const res = await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const created = await res.json();
          setEntries((prev) => [created, ...prev]);
        }
      }
    } catch {
      // silently fail
    } finally {
      setShowForm(false);
      setEditingEntry(null);
    }
  }

  async function handleDelete(entryId: string) {
    if (!window.confirm('Are you sure you want to delete this vault entry?')) return;
    try {
      const res = await fetch(`/api/vault/${entryId}`, { method: 'DELETE' });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
      }
    } catch {
      // silently fail
    }
  }

  function handleEdit(entry: any) {
    setEditingEntry(entry);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingEntry(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vault</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="size-4" />
          Add Entry
        </Button>
      </div>

      <Tabs value={selectedType} onValueChange={setSelectedType}>
        <TabsList className="flex-wrap gap-2">
          {ENTRY_TYPES.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-4">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {ENTRY_TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading vault entries…
              </div>
            ) : (
              <VaultEntryList
                entries={filteredEntries}
                onEdit={handleEdit}
                onDelete={handleDelete}
                timezone={timezone}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleCloseForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Entry' : 'Add Vault Entry'}</DialogTitle>
          </DialogHeader>
          <VaultEntryForm
            entryType={editingEntry ? (editingEntry.decryptedData?.type ?? editingEntry.entryType) : undefined}
            initialData={editingEntry}
            onSubmit={handleSubmit}
            onCancel={handleCloseForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
