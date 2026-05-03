import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditService } from '@/lib/audit';

export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingDone: true },
  });

  await auditService.log({
    userId,
    actionType: 'data_write',
    resource: 'onboarding_complete',
  });

  return Response.json({ success: true });
}
