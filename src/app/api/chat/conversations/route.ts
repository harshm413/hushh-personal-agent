import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const { personaId, title } = body;

    if (!personaId || !title) {
      return Response.json({ error: 'personaId and title are required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        personaId,
        title,
      },
    });

    return Response.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return Response.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get('search');

  try {
    let conversations;

    if (search) {
      // Find messages matching the search term, then get their conversations
      const matchingMessages = await prisma.message.findMany({
        where: {
          content: { contains: search, mode: 'insensitive' },
          conversation: { userId },
        },
        select: { conversationId: true },
        distinct: ['conversationId'],
      });

      const conversationIds = matchingMessages.map((m) => m.conversationId);

      conversations = await prisma.conversation.findMany({
        where: { id: { in: conversationIds }, userId },
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else {
      conversations = await prisma.conversation.findMany({
        where: { userId },
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    const result = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      personaId: c.personaId,
      lastMessageAt: c.messages[0]?.createdAt ?? c.createdAt,
      messagePreview: c.messages[0]?.content?.slice(0, 100) ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}
