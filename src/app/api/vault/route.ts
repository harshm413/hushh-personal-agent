import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { vaultService } from '@/lib/vault';
import { notificationService } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const type = req.nextUrl.searchParams.get('type') ?? undefined;
    const entries = await vaultService.query(userId, {
      entryType: type as any,
    });

    return Response.json(entries);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch vault entries' }, { status: 500 });
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
    const { type, data, ...rest } = body as { type?: string; data?: Record<string, unknown>; [key: string]: unknown };

    if (!type || !data) {
      return Response.json({ error: 'type and data are required' }, { status: 400 });
    }

    const created = await vaultService.create(userId, { type: type as any, data, ...rest });

    // Trigger notifications for specific entry types
    try {
      if (type === 'financial_record') {
        const amount = typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount));
        if (!isNaN(amount) && amount > 5000) {
          await notificationService.create({
            userId,
            type: 'financial_alert',
            title: `Large transaction recorded`,
            body: `$${amount.toLocaleString()} — ${(data.description as string) || 'No description'}`,
            linkedResource: `vault:${created.id}`,
          });
        }
      }
    } catch {
      // Don't fail vault creation if notification fails
    }

    return Response.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create vault entry';
    return Response.json({ error: message }, { status: 400 });
  }
}
