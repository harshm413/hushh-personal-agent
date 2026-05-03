import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMStreamParams {
  systemPrompt: string;
  history: ChatMessage[];
  contextData: string;
  userMessage: string;
  maxTokens?: number;
}

function createLLMClient() {
  const provider = process.env.LLM_PROVIDER ?? 'ollama';
  const baseUrl = process.env.LLM_BASE_URL ?? 'http://localhost:11434';
  const model = process.env.LLM_MODEL ?? 'llama3';

  if (provider === 'mock') {
    return null; // Use mock responses
  }

  if (provider === 'ollama') {
    return new ChatOllama({ baseUrl, model });
  }
  return new ChatOpenAI({
    model,
    configuration: { baseURL: baseUrl },
    apiKey: process.env.LLM_API_KEY || '',
  });
}

const llm = createLLMClient();

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateHistory(
  messages: ChatMessage[],
  maxTokens: number,
  systemPrompt: string
): ChatMessage[] {
  const budget = maxTokens - estimateTokens(systemPrompt) - 500;
  if (budget <= 0) return messages.length > 0 ? [messages[messages.length - 1]] : [];

  const result: ChatMessage[] = [];
  let tokenCount = 0;

  // Walk from newest to oldest, always preserve the latest user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content);
    if (tokenCount + msgTokens > budget && result.length > 0) break;
    result.unshift(messages[i]);
    tokenCount += msgTokens;
  }

  return result;
}

export function sanitizeInput(input: string): string {
  const injectionPatterns = [
    /^You are now.*/gim,
    /^Ignore previous.*/gim,
    /^System:.*/gim,
    /^SYSTEM:.*/gim,
    /^###.*/gim,
  ];

  let sanitized = input;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Remove potential prompt structure breakers
  sanitized = sanitized.replace(/\n\n---\n\n/g, '\n');

  return sanitized.trim();
}

export async function* stream(params: LLMStreamParams): AsyncGenerator<string> {
  const { systemPrompt, history, contextData, userMessage } = params;

  // Mock mode — generate helpful canned responses without an LLM
  if (!llm) {
    const isKai = systemPrompt.toLowerCase().includes('financial') || systemPrompt.toLowerCase().includes('kai');
    const persona = isKai ? 'Kai' : 'Nav';
    const responses = isKai
      ? [
          `Hi there! I'm ${persona}, your financial advisor. `,
          `You asked: "${userMessage}". `,
          `While I'm running in demo mode right now, `,
          `in production I'd analyze your financial data `,
          `and provide personalized advice. `,
          `Try asking about budgeting, investments, or savings goals!`,
        ]
      : [
          `Hey! I'm ${persona}, your lifestyle concierge. `,
          `You said: "${userMessage}". `,
          `I'm currently in demo mode, `,
          `but normally I'd help you with wellness, `,
          `dining, travel, and lifestyle recommendations `,
          `tailored to your preferences!`,
        ];

    for (const chunk of responses) {
      await new Promise((r) => setTimeout(r, 100));
      yield chunk;
    }
    return;
  }

  const messages = [
    new SystemMessage(systemPrompt),
    ...history.map((msg) =>
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    ),
    new HumanMessage(contextData ? `Context:\n${contextData}\n\nUser: ${userMessage}` : userMessage),
  ];

  const response = await llm.stream(messages);
  for await (const chunk of response) {
    const content = typeof chunk.content === 'string' ? chunk.content : '';
    if (content) yield content;
  }
}

export async function generateTitle(userMessage: string, assistantMessage: string): Promise<string> {
  if (!llm) {
    // Mock mode — just use first 40 chars of user message
    return userMessage.slice(0, 40) || 'New conversation';
  }

  try {
    const response = await llm.invoke([
      new SystemMessage(
        'Generate a short conversation title (max 6 words) that summarizes this exchange. Reply with ONLY the title, no quotes, no punctuation at the end.'
      ),
      new HumanMessage(`User: ${userMessage.slice(0, 200)}\nAssistant: ${assistantMessage.slice(0, 300)}`),
    ]);
    const title = typeof response.content === 'string' ? response.content.trim() : '';
    return title.slice(0, 60) || userMessage.slice(0, 40);
  } catch {
    return userMessage.slice(0, 40) || 'New conversation';
  }
}
