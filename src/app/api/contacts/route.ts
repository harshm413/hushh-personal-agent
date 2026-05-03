import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { vaultService } from '@/lib/vault';

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
      entryType: 'contact',
    });

    return Response.json(entries);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch contacts' }, { status: 500 });
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
      type: 'contact',
      data,
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create contact';
    return Response.json({ error: message }, { status: 400 });
  }
}
