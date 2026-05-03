import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditService } from '@/lib/audit';

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase());
  return adminEmails.includes(email.toLowerCase());
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAdmin(session.user.email!)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const userId = (session.user as any).id;
  const body = await request.json();
  const { resolution } = body;

  const escalation = await prisma.escalation.update({
    where: { id },
    data: {
      status: 'resolved',
      resolution,
      resolvedBy: userId,
      updatedAt: new Date(),
    },
  });

  await auditService.log({
    userId,
    actionType: 'escalation_resolved',
    resource: 'escalation',
    resourceId: id,
  });

  return Response.json(escalation);
}
