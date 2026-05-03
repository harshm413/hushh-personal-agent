import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditService } from '@/lib/audit';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase());
  return adminEmails.includes(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await request.json();
  const { originalQuery, preliminaryResponse, escalationReason, personaId } = body;

  const escalation = await prisma.escalation.create({
    data: {
      userId,
      originalQuery,
      preliminaryResponse,
      escalationReason,
      personaId,
      status: 'pending',
    },
  });

  await auditService.log({
    userId,
    actionType: 'escalation_created',
    resource: 'escalation',
    resourceId: escalation.id,
    personaId,
  });

  return Response.json(escalation, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAdmin(session.user.email!)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || undefined;
  const personaId = searchParams.get('personaId') || undefined;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (personaId) where.personaId = personaId;

  const escalations = await prisma.escalation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
  });

  return Response.json(escalations);
}
