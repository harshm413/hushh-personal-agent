import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId },
  });

  return Response.json(preferences);
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { notificationType, enabled, pushEnabled } = await request.json();

  const preference = await prisma.notificationPreference.upsert({
    where: {
      userId_notificationType: { userId, notificationType },
    },
    update: { enabled, pushEnabled },
    create: { userId, notificationType, enabled, pushEnabled },
  });

  return Response.json(preference);
}
