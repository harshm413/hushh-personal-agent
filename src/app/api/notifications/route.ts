import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const readParam = request.nextUrl.searchParams.get('read');

  const filters = {
    read: readParam === 'true' ? true : readParam === 'false' ? false : undefined,
  };

  const notifications = await notificationService.getAll(userId, filters);
  return Response.json(notifications);
}

export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const count = await notificationService.markAllAsRead(userId);
  return Response.json({ success: true, count });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const count = await notificationService.clearAll(userId);
  return Response.json({ success: true, count });
}
