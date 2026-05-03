import { prisma } from './prisma';
import { auditService } from './audit';
import { vaultService } from './vault';
import type { Notification } from '@prisma/client';

export type NotificationType =
  | 'financial_alert'
  | 'contact_reminder'
  | 'calendar_reminder'
  | 'system_notification';

const NOTIFICATION_CONSENT_MAP: Record<string, string | null> = {
  financial_alert: 'financial_record',
  contact_reminder: 'contact',
  calendar_reminder: 'calendar_event',
  system_notification: null,
};

export const notificationService = {
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    linkedResource?: string;
  }): Promise<Notification | null> {
    const { userId, type, title, body, linkedResource } = params;
    const dataCategory = NOTIFICATION_CONSENT_MAP[type];

    if (dataCategory !== null) {
      const pref = await prisma.notificationPreference.findUnique({
        where: { userId_notificationType: { userId, notificationType: type } },
      });
      if (pref && !pref.enabled) {
        return null;
      }
    }

    const notification = await prisma.notification.create({
      data: { userId, type, title, body, linkedResource },
    });

    await auditService.log({
      userId,
      actionType: 'notification_sent',
      resource: type,
      resourceId: notification.id,
    });

    return notification;
  },

  async getAll(userId: string, filters?: { read?: boolean }): Promise<Notification[]> {
    const where: Record<string, unknown> = { userId };
    if (filters?.read !== undefined) {
      where.read = filters.read;
    }
    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found');
    }
    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  },

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  },

  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return result.count;
  },

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found');
    }
    await prisma.notification.delete({ where: { id: notificationId } });
  },

  async clearAll(userId: string): Promise<number> {
    const result = await prisma.notification.deleteMany({ where: { userId } });
    return result.count;
  },

  async checkAndGenerateAlerts(userId: string): Promise<void> {
    // Helper: check if a notification with the same title already exists (unread) today
    const isDuplicate = async (title: string): Promise<boolean> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await prisma.notification.findFirst({
        where: { userId, title, createdAt: { gte: today } },
      });
      return !!existing;
    };

    // Scan contacts for important dates within 7 days
    try {
      const contacts = await vaultService.query(userId, { entryType: 'contact' });
      const now = new Date();

      for (const contact of contacts) {
        const data = contact.decryptedData;
        if (data.type !== 'contact') continue;

        for (const importantDate of data.data.importantDates) {
          const dateObj = new Date(importantDate.date);
          const thisYear = new Date(
            now.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate()
          );

          const diffMs = thisYear.getTime() - now.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (diffDays >= 0 && diffDays <= 7) {
            const title = `Upcoming: ${importantDate.label} for ${data.data.name}`;
            if (await isDuplicate(title)) continue;

            await this.create({
              userId,
              type: 'contact_reminder',
              title,
              body: `${data.data.name}'s ${importantDate.label} is on ${importantDate.date}`,
              linkedResource: `vault:${contact.id}`,
            });
          }
        }
      }
    } catch {
      // Silently handle contact scan failures
    }

    // Scan calendar for events within 24 hours
    try {
      const events = await vaultService.query(userId, { entryType: 'calendar_event' });
      const now = new Date();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;

      for (const event of events) {
        const data = event.decryptedData;
        if (data.type !== 'calendar_event') continue;

        const startTime = new Date(data.data.startTime);
        const diffMs = startTime.getTime() - now.getTime();

        if (diffMs >= 0 && diffMs <= twentyFourHoursMs) {
          const title = `Upcoming: ${data.data.title}`;
          if (await isDuplicate(title)) continue;

          await this.create({
            userId,
            type: 'calendar_reminder',
            title,
            body: `${data.data.title} starts at ${data.data.startTime}${data.data.location ? ` at ${data.data.location}` : ''}`,
            linkedResource: `vault:${event.id}`,
          });
        }
      }
    } catch {
      // Silently handle calendar scan failures
    }

    // Scan financial records for notable items (large transactions, upcoming bills)
    try {
      const financials = await vaultService.query(userId, { entryType: 'financial_record' });

      for (const entry of financials) {
        const data = entry.decryptedData;
        if (data.type !== 'financial_record') continue;

        const amount = typeof data.data.amount === 'number' ? data.data.amount : parseFloat(String(data.data.amount));
        // Alert on large transactions (> $5000)
        if (!isNaN(amount) && amount > 5000) {
          const title = `Large transaction: ${data.data.description || 'Financial record'}`;
          if (await isDuplicate(title)) continue;

          await this.create({
            userId,
            type: 'financial_alert',
            title,
            body: `$${amount.toLocaleString()} — ${data.data.description || 'No description'}`,
            linkedResource: `vault:${entry.id}`,
          });
        }
      }
    } catch {
      // Silently handle financial scan failures
    }
  },
};
