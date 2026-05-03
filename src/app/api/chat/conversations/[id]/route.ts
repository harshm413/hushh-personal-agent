import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditService } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.userId !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    return Response.json(conversation);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.userId !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await auditService.log({
      userId,
      actionType: 'data_delete',
      resource: 'conversation',
      resourceId: id,
    });

    await prisma.conversation.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { title } = body as { title?: string };

    if (!title || typeof title !== 'string') {
      return Response.json({ error: 'title is required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.userId !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { title },
    });

    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}
