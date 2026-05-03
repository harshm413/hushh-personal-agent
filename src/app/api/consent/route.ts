import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { consentService } from '@/lib/consent';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const toggles = await consentService.getToggles(userId);
  return Response.json(toggles);
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { fieldId, enabled, personaScope } = await request.json();

  await consentService.setToggle(userId, fieldId, enabled, personaScope);
  return Response.json({ success: true });
}
