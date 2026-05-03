import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { vaultService, AccessDeniedError } from '@/lib/vault';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entryId } = await params;

  try {
    const entry = await vaultService.read(userId, entryId);
    return Response.json(entry);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
    return Response.json({ error: 'Vault entry not found' }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entryId } = await params;

  try {
    const body = await req.json();
    const { type, data, ...rest } = body as { type?: string; data?: Record<string, unknown>; [key: string]: unknown };

    if (!type || !data) {
      return Response.json({ error: 'type and data are required' }, { status: 400 });
    }

    const updated = await vaultService.update(userId, entryId, { type: type as any, data, ...rest });
    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update vault entry';
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entryId } = await params;

  try {
    await vaultService.delete(userId, entryId);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete vault entry';
    return Response.json({ error: message }, { status: 400 });
  }
}
