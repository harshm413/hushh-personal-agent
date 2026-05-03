import crypto from 'crypto';
import { prisma } from './prisma';
import type { AuditEntry } from '@prisma/client';
import type { PaginationParams, PaginatedResult } from '@/types/index';

export type AuditActionType =
  | 'data_read' | 'data_write' | 'data_delete'
  | 'consent_grant' | 'consent_revoke'
  | 'auth_login' | 'auth_logout' | 'auth_failed'
  | 'escalation_created' | 'escalation_resolved'
  | 'notification_sent';

export interface CreateAuditEntry {
  userId: string;
  actionType: AuditActionType;
  resource: string;
  resourceId?: string;
  personaId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditFilters {
  actionType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  personaId?: string;
}

export const auditService = {
  async log(entry: CreateAuditEntry): Promise<AuditEntry> {
    const lastEntry = await prisma.auditEntry.findFirst({
      where: { userId: entry.userId },
      orderBy: { createdAt: 'desc' },
    });

    const previousHash = lastEntry?.hash ?? 'GENESIS';
    const timestamp = new Date().toISOString();

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        previousHash,
        timestamp,
        userId: entry.userId,
        actionType: entry.actionType,
        resource: entry.resource,
        resourceId: entry.resourceId,
      }))
      .digest('hex');

    return prisma.auditEntry.create({
      data: {
        userId: entry.userId,
        actionType: entry.actionType,
        resource: entry.resource,
        resourceId: entry.resourceId,
        personaId: entry.personaId,
        metadata: entry.metadata as any,
        hash,
        previousHash,
      },
    });
  },

  async getEntries(
    userId: string,
    filters: AuditFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<AuditEntry>> {
    const where: any = { userId };
    if (filters.actionType) where.actionType = filters.actionType;
    if (filters.personaId) where.personaId = filters.personaId;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [data, total] = await Promise.all([
      prisma.auditEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.auditEntry.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  },

  async verifyChain(userId: string): Promise<{ valid: boolean; brokenAt?: string }> {
    const entries = await prisma.auditEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedPreviousHash = i === 0 ? 'GENESIS' : entries[i - 1].hash;

      if (entry.previousHash !== expectedPreviousHash) {
        return { valid: false, brokenAt: entry.id };
      }
    }

    return { valid: true };
  },
};
