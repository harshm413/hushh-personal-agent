import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { vaultService } from '@/lib/vault';
import { notificationService } from '@/lib/notifications';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const entries = await vaultService.query(userId, {
      entryType: 'calendar_event',
    });

    const sorted = entries.sort((a, b) => {
      const aTime = a.decryptedData.type === 'calendar_event' ? a.decryptedData.data.startTime : '';
      const bTime = b.decryptedData.type === 'calendar_event' ? b.decryptedData.data.startTime : '';
      return aTime.localeCompare(bTime);
    });

    return Response.json(sorted);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { data } = body as { data?: Record<string, unknown> };

    if (!data) {
      return Response.json({ error: 'data is required' }, { status: 400 });
    }

    const created = await vaultService.create(userId, {
      type: 'calendar_event',
      data,
    });

    // Create an immediate notification if the event is within 24 hours
    try {
      const startTime = data.startTime ? new Date(data.startTime as string) : null;
      if (startTime) {
        const diffMs = startTime.getTime() - Date.now();
        if (diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000) {
          await notificationService.create({
            userId,
            type: 'calendar_reminder',
            title: `New event: ${(data.title as string) || 'Calendar event'}`,
            body: `${(data.title as string) || 'Event'} starts at ${data.startTime}${data.location ? ` at ${data.location}` : ''}`,
            linkedResource: `vault:${created.id}`,
          });
        }
      }
    } catch {
      // Don't fail event creation if notification fails
    }

    return Response.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create calendar event';
    return Response.json({ error: message }, { status: 400 });
  }
}
