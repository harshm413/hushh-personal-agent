import { prisma } from './prisma';
import { deriveUserKey, encrypt, decrypt, getMasterKey } from './crypto';
import { validateVaultEntry } from './vault-schema';
import { consentService } from './consent';
import { auditService } from './audit';
import type { VaultEntry } from '@prisma/client';
import type { VaultEntryData, VaultEntryType } from '@/types/vault';

export interface CreateVaultEntryInput {
  type: VaultEntryType;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UpdateVaultEntryInput {
  type: VaultEntryType;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VaultQuery {
  entryType?: VaultEntryType;
}

export class AccessDeniedError extends Error {
  constructor(message = 'Access denied: consent not granted for this data') {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

export const vaultService = {
  async create(
    userId: string,
    entry: CreateVaultEntryInput
  ): Promise<VaultEntry & { decryptedData: VaultEntryData }> {
    const { type, data, ...extraFields } = entry;
    const entryData = { type, data, ...extraFields } as unknown;
    const validation = validateVaultEntry(entryData);
    if (!validation.valid) {
      throw new Error(`Invalid vault entry: ${JSON.stringify(validation.errors)}`);
    }

    const userKey = deriveUserKey(getMasterKey(), userId);
    const jsonString = JSON.stringify(validation.data);
    const encryptedData = encrypt(jsonString, userKey);

    const created = await prisma.vaultEntry.create({
      data: { userId, entryType: entry.type, encryptedData },
    });

    await auditService.log({
      userId,
      actionType: 'data_write',
      resource: entry.type,
      resourceId: created.id,
    });

    return { ...created, decryptedData: validation.data! };
  },

  async read(
    userId: string,
    entryId: string,
    personaId?: string
  ): Promise<VaultEntry & { decryptedData: VaultEntryData }> {
    const entry = await prisma.vaultEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new Error('Vault entry not found');
    if (entry.userId !== userId) throw new Error('Vault entry not found');

    if (personaId) {
      const hasAccess = await consentService.checkAccess(userId, entry.entryType, personaId);
      if (!hasAccess) {
        await auditService.log({
          userId,
          actionType: 'data_read',
          resource: entry.entryType,
          resourceId: entryId,
          personaId,
          metadata: { denied: true },
        });
        throw new AccessDeniedError();
      }
    }

    const userKey = deriveUserKey(getMasterKey(), userId);
    const decryptedJson = decrypt(entry.encryptedData, userKey);
    const decryptedData = JSON.parse(decryptedJson) as VaultEntryData;

    await auditService.log({
      userId,
      actionType: 'data_read',
      resource: entry.entryType,
      resourceId: entryId,
      personaId,
    });

    return { ...entry, decryptedData };
  },

  async update(
    userId: string,
    entryId: string,
    data: UpdateVaultEntryInput
  ): Promise<VaultEntry & { decryptedData: VaultEntryData }> {
    const existing = await prisma.vaultEntry.findUnique({ where: { id: entryId } });
    if (!existing) throw new Error('Vault entry not found');
    if (existing.userId !== userId) throw new Error('Vault entry not found');

    const { type, data: updateData, ...extraFields } = data;
    const entryData = { type, data: updateData, ...extraFields } as unknown;
    const validation = validateVaultEntry(entryData);
    if (!validation.valid) {
      throw new Error(`Invalid vault entry: ${JSON.stringify(validation.errors)}`);
    }

    const userKey = deriveUserKey(getMasterKey(), userId);
    const jsonString = JSON.stringify(validation.data);
    const encryptedData = encrypt(jsonString, userKey);

    const updated = await prisma.vaultEntry.update({
      where: { id: entryId },
      data: { entryType: data.type, encryptedData },
    });

    await auditService.log({
      userId,
      actionType: 'data_write',
      resource: data.type,
      resourceId: entryId,
    });

    return { ...updated, decryptedData: validation.data! };
  },

  async delete(userId: string, entryId: string): Promise<void> {
    const existing = await prisma.vaultEntry.findUnique({ where: { id: entryId } });
    if (!existing) throw new Error('Vault entry not found');
    if (existing.userId !== userId) throw new Error('Vault entry not found');

    await prisma.vaultEntry.delete({ where: { id: entryId } });

    await auditService.log({
      userId,
      actionType: 'data_delete',
      resource: existing.entryType,
      resourceId: entryId,
    });
  },

  async query(
    userId: string,
    query: VaultQuery,
    personaId?: string
  ): Promise<(VaultEntry & { decryptedData: VaultEntryData })[]> {
    let permittedTypes: string[] | undefined;

    if (personaId) {
      const permitted = await consentService.getPermittedFields(userId, personaId);
      permittedTypes = query.entryType
        ? permitted.includes(query.entryType) ? [query.entryType] : []
        : permitted;
    }

    const where: Record<string, unknown> = { userId };
    if (query.entryType && !personaId) {
      where.entryType = query.entryType;
    } else if (permittedTypes) {
      if (permittedTypes.length === 0) return [];
      where.entryType = { in: permittedTypes };
    }

    const entries = await prisma.vaultEntry.findMany({ where });
    const userKey = deriveUserKey(getMasterKey(), userId);

    const results = entries.map((entry) => {
      const decryptedJson = decrypt(entry.encryptedData, userKey);
      const decryptedData = JSON.parse(decryptedJson) as VaultEntryData;
      return { ...entry, decryptedData };
    });

    await auditService.log({
      userId,
      actionType: 'data_read',
      resource: query.entryType ?? 'vault_query',
      personaId,
      metadata: { count: results.length },
    });

    return results;
  },
};
