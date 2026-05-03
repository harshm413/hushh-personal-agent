import { validateVaultEntry } from './vault-schema';
import type { VaultEntryData, VaultEntryType } from '@/types/vault';

export type ValidationResult = {
  valid: boolean;
  errors?: { field: string; message: string }[];
};

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce((sorted, key) => {
      (sorted as Record<string, unknown>)[key] = sortKeys((obj as Record<string, unknown>)[key]);
      return sorted;
    }, {} as Record<string, unknown>);
}

export function parse(json: string): VaultEntryData {
  const parsed = JSON.parse(json);
  const result = validateVaultEntry(parsed);
  if (!result.valid || !result.data) {
    throw new Error(`Invalid vault entry: ${JSON.stringify(result.errors)}`);
  }
  return result.data;
}

export function serialize(entry: VaultEntryData): string {
  return JSON.stringify(sortKeys(entry));
}

export function prettyPrint(entry: VaultEntryData): string {
  return JSON.stringify(entry, null, 2);
}

export function validate(json: string, entryType: VaultEntryType): ValidationResult {
  try {
    const parsed = JSON.parse(json);
    if (parsed.type !== entryType) {
      return {
        valid: false,
        errors: [{ field: 'type', message: `Expected type '${entryType}', got '${parsed.type}'` }],
      };
    }
    const result = validateVaultEntry(parsed);
    return { valid: result.valid, errors: result.errors };
  } catch (e) {
    return {
      valid: false,
      errors: [{ field: '', message: `Invalid JSON: ${(e as Error).message}` }],
    };
  }
}
