import { prisma } from './prisma';
import { auditService } from './audit';
import type { ConsentToggle } from '@prisma/client';
import type { PersonaScope } from '@/types/persona';
import type { PaginationParams } from '@/types/index';

export interface ConsentHistoryEntry {
  timestamp: Date;
  fieldId: string;
  action: 'grant' | 'revoke';
  personaScope: string;
}

export const consentService = {
  async getToggles(userId: string): Promise<ConsentToggle[]> {
    return prisma.consentToggle.findMany({ where: { userId } });
  },

  async setToggle(
    userId: string,
    fieldId: string,
    enabled: boolean,
    personaScope: PersonaScope
  ): Promise<void> {
    // Disable legacy 'both' scope when setting individual persona toggles
    if (enabled && personaScope !== 'both') {
      await prisma.consentToggle.updateMany({
        where: { userId, dataFieldId: fieldId, personaScope: 'both' },
        data: { enabled: false },
      });
    }

    await prisma.consentToggle.upsert({
      where: {
        userId_dataFieldId_personaScope: { userId, dataFieldId: fieldId, personaScope },
      },
      update: { enabled },
      create: { userId, dataFieldId: fieldId, enabled, personaScope },
    });

    await auditService.log({
      userId,
      actionType: enabled ? 'consent_grant' : 'consent_revoke',
      resource: fieldId,
      personaId: personaScope,
    });
  },

  async checkAccess(userId: string, fieldId: string, personaId: string): Promise<boolean> {
    const toggle = await prisma.consentToggle.findFirst({
      where: {
        userId,
        dataFieldId: fieldId,
        OR: [{ personaScope: personaId }, { personaScope: 'both' }],
        enabled: true,
      },
    });
    return !!toggle;
  },

  async getPermittedFields(userId: string, personaId: string): Promise<string[]> {
    const toggles = await prisma.consentToggle.findMany({
      where: {
        userId,
        enabled: true,
        OR: [{ personaScope: personaId }, { personaScope: 'both' }],
      },
    });
    return toggles.map((t) => t.dataFieldId);
  },

  async getHistory(userId: string, pagination: PaginationParams, dateFrom?: string, dateTo?: string): Promise<{ data: ConsentHistoryEntry[]; total: number }> {
    const where: any = { userId, actionType: { in: ['consent_grant', 'consent_revoke'] as string[] } };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [entries, total] = await Promise.all([
      prisma.auditEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.auditEntry.count({ where }),
    ]);

    return {
      data: entries.map((e) => ({
        timestamp: e.createdAt,
        fieldId: e.resource,
        action: e.actionType === 'consent_grant' ? 'grant' as const : 'revoke' as const,
        personaScope: e.personaId ?? 'both',
      })),
      total,
    };
  },
};
