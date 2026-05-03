import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processMessage, parseActions, executeActions, stripActionBlocks } from '@/lib/agent';
import { generateTitle } from '@/lib/llm';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { message, conversationId: incomingConversationId, personaId } = body as {
    message?: string;
    conversationId?: string;
    personaId?: string;
  };

  if (!message || !personaId) {
    return Response.json(
      { error: 'message and personaId are required' },
      { status: 400 }
    );
  }

  // If no conversationId, create a new conversation
  let conversationId = incomingConversationId;
  let isNewConversation = false;
  if (!conversationId) {
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        personaId,
        title: 'New conversation',
      },
    });
    conversationId = conversation.id;
    isNewConversation = true;
  }

  // Store user message
  await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: message,
    },
  });

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      // Send conversationId as the first event so the client knows which conversation was created
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`)
      );

      let fullResponse = '';
      try {
        for await (const token of processMessage({ userId, message, conversationId, personaId })) {
          fullResponse += token;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
          );
        }

        // Store full assistant message (with action blocks stripped for clean display)
        if (fullResponse) {
          const cleanResponse = stripActionBlocks(fullResponse);

          await prisma.message.create({
            data: {
              conversationId: conversationId!,
              role: 'assistant',
              content: cleanResponse,
            },
          });

          // Execute any actions the LLM included in its response
          const actions = parseActions(fullResponse);
          if (actions.length > 0) {
            // Fetch user timezone for server-side time conversion
            const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
            const userTimezone = userRecord?.timezone || 'UTC';
            const results = await executeActions(userId, actions, personaId, userTimezone);
            for (const result of results) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ actionResult: result })}\n\n`)
              );
            }
          } else {
            // Detect if the LLM claimed to create something but didn't include an action block
            const claimPatterns = /I('ve| have) (created|added|booked|scheduled|recorded|saved)/i;
            if (claimPatterns.test(cleanResponse)) {
              // Determine which persona might be needed
              const scheduleWords = /schedul|calendar|event|meeting|appointment|booking/i;
              const contactWords = /contact|person|friend|colleague/i;
              let suggestion = 'Please try again.';
              if (personaId === 'kai' && (scheduleWords.test(cleanResponse) || contactWords.test(cleanResponse))) {
                suggestion = 'Kai handles finances only. Switch to Nav for scheduling, contacts, and bookings.';
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ actionResult: {
                  success: false,
                  action: 'create_vault_entry',
                  error: `Nothing was actually saved. ${suggestion}`
                } })}\n\n`)
              );
            }
          }
        }

        // Update conversation updatedAt
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Generate smart title for new conversations
        if (isNewConversation && fullResponse) {
          try {
            const titleText = stripActionBlocks(fullResponse);
            const title = await generateTitle(message, titleText);
            await prisma.conversation.update({
              where: { id: conversationId! },
              data: { title },
            });
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ titleUpdate: { conversationId, title } })}\n\n`)
            );
          } catch {
            // title generation failed, keep "New conversation"
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (error) {
        const errMsg = 'AI service is currently unavailable. Please try again later.';
        // Send error as a token so it shows as a single assistant message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token: errMsg })}\n\n`)
        );
        // Store the error message
        await prisma.message.create({
          data: {
            conversationId: conversationId!,
            role: 'assistant',
            content: errMsg,
          },
        }).catch(() => {});
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
