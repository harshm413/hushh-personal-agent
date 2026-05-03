import { getPersona, buildSystemPrompt } from './personas';
import { consentService } from './consent';
import { vaultService, type CreateVaultEntryInput } from './vault';
import { stream, sanitizeInput, truncateHistory, estimateTokens, type ChatMessage } from './llm';
import { auditService } from './audit';
import { prisma } from './prisma';
import { notificationService } from './notifications';

// --- Action parsing and execution ---

const ACTION_START = '<<<ACTION>>>';
const ACTION_END = '<<<END_ACTION>>>';

export interface AgentAction {
  action: 'create_vault_entry';
  entry: CreateVaultEntryInput;
}

export interface ActionResult {
  success: boolean;
  action: string;
  entryType?: string;
  entryId?: string;
  error?: string;
}

export function parseActions(text: string): AgentAction[] {
  const actions: AgentAction[] = [];
  let searchFrom = 0;

  while (true) {
    const startIdx = text.indexOf(ACTION_START, searchFrom);
    if (startIdx === -1) break;
    const endIdx = text.indexOf(ACTION_END, startIdx + ACTION_START.length);
    if (endIdx === -1) break;

    const jsonStr = text.slice(startIdx + ACTION_START.length, endIdx).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.action === 'create_vault_entry' && parsed.entry) {
        actions.push(parsed as AgentAction);
      }
    } catch {
      // malformed JSON — skip this action block
    }
    searchFrom = endIdx + ACTION_END.length;
  }

  return actions;
}

export function stripActionBlocks(text: string): string {
  let result = text;
  while (true) {
    const startIdx = result.indexOf(ACTION_START);
    if (startIdx === -1) break;
    const endIdx = result.indexOf(ACTION_END, startIdx);
    if (endIdx === -1) break;
    result = result.slice(0, startIdx) + result.slice(endIdx + ACTION_END.length);
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

export async function executeActions(
  userId: string,
  actions: AgentAction[],
  personaId: string,
  userTimezone?: string
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    if (action.action === 'create_vault_entry') {
      try {
        // Normalize: fill in missing defaults and convert local times to UTC
        normalizeActionData(action.entry, userTimezone);

        // Server-side validation: reject entries with placeholder or missing critical data
        const rejection = validateActionData(action.entry);
        if (rejection) {
          results.push({
            success: false,
            action: 'create_vault_entry',
            entryType: action.entry.type,
            error: rejection,
          });
          continue;
        }

        const created = await vaultService.create(userId, action.entry);
        results.push({
          success: true,
          action: 'create_vault_entry',
          entryType: action.entry.type,
          entryId: created.id,
        });

        await auditService.log({
          userId,
          actionType: 'data_write',
          resource: action.entry.type,
          resourceId: created.id,
          personaId,
          metadata: { source: 'agent_tool_call' },
        });
      } catch (err: any) {
        results.push({
          success: false,
          action: 'create_vault_entry',
          entryType: action.entry.type,
          error: err.message ?? 'Failed to create vault entry',
        });
      }
    }
  }

  return results;
}

/** Fills in missing default values and converts local times to UTC. */
function normalizeActionData(entry: CreateVaultEntryInput, userTimezone?: string): void {
  const data = entry.data as Record<string, unknown>;
  if (!data) return;

  if (entry.type === 'contact') {
    if (!Array.isArray(data.importantDates)) data.importantDates = [];
    if (!Array.isArray(data.tags)) data.tags = [];
    if (!Array.isArray(data.communicationHistory)) data.communicationHistory = [];
    if (!data.relationshipType) data.relationshipType = 'personal';
  }

  if (entry.type === 'calendar_event') {
    if (!data.recurrence) data.recurrence = 'none';
    if (data.description === undefined) data.description = '';
    if (data.location === undefined) data.location = '';

    // Convert local times to UTC programmatically
    if (data.startTime && typeof data.startTime === 'string') {
      data.startTime = localTimeToUTC(data.startTime as string, userTimezone);
    }
    if (data.endTime && typeof data.endTime === 'string') {
      data.endTime = localTimeToUTC(data.endTime as string, userTimezone);
    }
  }

  if (entry.type === 'financial_record') {
    if (!data.currency) data.currency = 'USD';
    if (!data.date) data.date = new Date().toISOString().split('T')[0];
    if (!(entry as any).subtype && !data.subtype) {
      (entry as any).subtype = 'transaction';
    }
  }

  if (entry.type === 'booking') {
    if (!data.status) data.status = 'pending';
    if (!data.serviceType) data.serviceType = 'appointment';
    if (data.preferences === undefined) data.preferences = '';
  }

  if (entry.type === 'preference') {
    if (!data.category) data.category = 'lifestyle';
  }
}

/**
 * Converts a datetime string from the user's local timezone to UTC.
 * Handles multiple formats the LLM might produce:
 * - Already UTC (ends with Z): return as-is
 * - Has timezone offset (+05:30): parse directly
 * - No timezone info (2026-03-26T15:00:00): treat as local time in userTimezone and convert to UTC
 */
function localTimeToUTC(dateStr: string, userTimezone?: string): string {
  // Already UTC
  if (dateStr.endsWith('Z')) {
    // Check if this looks like the LLM just slapped Z on a local time
    // We can't know for sure, but if a timezone is set and it's not UTC, convert it
    if (userTimezone && userTimezone !== 'UTC') {
      // Parse the date parts, treat them as local time in the user's timezone
      const withoutZ = dateStr.replace('Z', '');
      return convertLocalToUTC(withoutZ, userTimezone);
    }
    return dateStr;
  }

  // Has explicit timezone offset like +05:30 or -04:00
  if (/[+-]\d{2}:\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // No timezone info — treat as local time in user's timezone
  if (userTimezone && userTimezone !== 'UTC') {
    return convertLocalToUTC(dateStr, userTimezone);
  }

  // Fallback: assume UTC
  const d = new Date(dateStr + 'Z');
  return isNaN(d.getTime()) ? dateStr : d.toISOString();
}

/** Converts a naive datetime string (no timezone) to UTC by interpreting it in the given timezone. */
function convertLocalToUTC(naiveDateStr: string, timezone: string): string {
  try {
    // Parse the date components from the string
    const d = new Date(naiveDateStr);
    if (isNaN(d.getTime())) return naiveDateStr;

    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const seconds = d.getSeconds();

    // Create a date string that represents this time in the user's timezone
    // Use Intl to find the UTC offset for this specific date in the timezone
    const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));

    // Get what this UTC time looks like in the user's timezone
    const inTz = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
    const inUtc = new Date(utcDate.toLocaleString('en-US', { timeZone: 'UTC' }));

    // The difference tells us the offset
    const offsetMs = inTz.getTime() - inUtc.getTime();

    // Subtract the offset to get the actual UTC time
    const correctedUtc = new Date(utcDate.getTime() - offsetMs);
    return correctedUtc.toISOString();
  } catch {
    return naiveDateStr;
  }
}

/** Validates that the LLM didn't hallucinate placeholder data. Returns error string or null if valid. */
function validateActionData(entry: CreateVaultEntryInput): string | null {
  const PLACEHOLDER_PATTERNS = /^\.{2,}$|^\.\.\.$|^<.*>$|^placeholder$|^example$|^test$|^TBD$|^N\/A$|^unknown$/i;
  const data = entry.data as Record<string, unknown>;

  if (!data || typeof data !== 'object') {
    return 'Missing data object';
  }

  // Check all string fields for placeholder patterns
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && PLACEHOLDER_PATTERNS.test(value.trim())) {
      return `Field "${key}" contains placeholder data: "${value}"`;
    }
  }

  // Type-specific required field checks
  if (entry.type === 'calendar_event') {
    const d = data as Record<string, unknown>;
    if (!d.title || (typeof d.title === 'string' && d.title.trim().length === 0)) {
      return 'Calendar event requires a title';
    }
    if (!d.startTime || !d.endTime) {
      return 'Calendar event requires both startTime and endTime';
    }
    const start = String(d.startTime);
    const end = String(d.endTime);
    if (!start.includes('T') || !end.includes('T')) {
      return 'Calendar event times must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)';
    }
    // Validate that start and end parse to valid dates
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime())) {
      return `Invalid startTime: "${start}" is not a valid date`;
    }
    if (isNaN(endDate.getTime())) {
      return `Invalid endTime: "${end}" is not a valid date`;
    }
    // End must be after start
    if (endDate <= startDate) {
      return 'Calendar event endTime must be after startTime';
    }
  }

  if (entry.type === 'contact') {
    const d = data as Record<string, unknown>;
    if (!d.name || (typeof d.name === 'string' && d.name.trim().length === 0)) {
      return 'Contact requires a name';
    }
  }

  if (entry.type === 'financial_record') {
    const d = data as Record<string, unknown>;
    if (!d.description || (typeof d.description === 'string' && d.description.trim().length === 0)) {
      return 'Financial record requires a description';
    }
    if (typeof d.amount !== 'number' || d.amount === 0) {
      return 'Financial record requires a non-zero amount';
    }
    if (!d.account || (typeof d.account === 'string' && d.account.trim().length === 0)) {
      return 'Financial record requires an account name';
    }
  }

  if (entry.type === 'booking') {
    const d = data as Record<string, unknown>;
    if (!d.venue || (typeof d.venue === 'string' && d.venue.trim().length === 0)) {
      return 'Booking requires a venue name';
    }
    if (!d.date || (typeof d.date === 'string' && d.date.trim().length === 0)) {
      return 'Booking requires a date';
    }
    if (!d.time || (typeof d.time === 'string' && d.time.trim().length === 0)) {
      return 'Booking requires a time';
    }
  }

  return null;
}

export const ESCALATION_KEYWORDS = [
  'delete my account',
  'transfer funds',
  'legal advice',
  'sue',
  'lawyer',
  'close my account',
  'wire transfer',
  'delete all my data',
  'remove my data',
  'financial transaction',
  'move my money',
];

const STREAM_TIMEOUT_MS = 30_000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS ?? '4096', 10);

export async function* processMessage(params: {
  userId: string;
  message: string;
  conversationId?: string;
  personaId: string;
}): AsyncGenerator<string> {
  const { userId, message, conversationId, personaId } = params;

  // Step 1: Get persona config
  const persona = getPersona(personaId);
  if (!persona) {
    throw new Error(`Persona not found: ${personaId}`);
  }

  // Step 2: Get permitted data scopes
  const permittedFields = await consentService.getPermittedFields(userId, personaId);

  // Step 2.5: Get user timezone for date-aware prompts
  const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const userTimezone = userRecord?.timezone || 'UTC';
  const dynamicSystemPrompt = buildSystemPrompt(personaId, userTimezone);

  // Step 3: Sanitize user input
  const sanitizedMessage = sanitizeInput(message);

  // Step 4: Determine if the message needs vault/profile context
  // Skip data retrieval for casual greetings to avoid overwhelming responses
  const casualPatterns = /^(hi|hello|hey|yo|sup|what'?s up|howdy|greetings|good (morning|afternoon|evening))[\s!?.]*$/i;
  const needsContext = !casualPatterns.test(sanitizedMessage.trim());

  const vaultResults: string[] = [];
  const profileParts: string[] = [];
  let relevantScopes: string[] = [];

  if (needsContext) {
    // Query relevant vault data for each permitted scope within persona's allowed scopes
    relevantScopes = persona.allowedDataScopes.filter((scope) =>
      permittedFields.includes(scope)
    );

    for (const scope of relevantScopes) {
      const entries = await vaultService.query(userId, { entryType: scope as any }, personaId);
      if (entries.length > 0) {
        const formatted = entries.map((e) => JSON.stringify(e.decryptedData)).join('\n');
        vaultResults.push(`[${scope}]:\n${formatted}`);
      }
    }

    // Get user profile preferences (if consent granted)
    const profile = await prisma.userProfile.findUnique({ where: { userId } });

    if (profile) {
      if (personaId === 'kai') {
        if (profile.riskTolerance) profileParts.push(`Risk Tolerance: ${profile.riskTolerance}`);
        if (profile.investmentGoals) profileParts.push(`Investment Goals: ${profile.investmentGoals}`);
        if (profile.incomeRange) profileParts.push(`Income Range: ${profile.incomeRange}`);
      } else if (personaId === 'nav') {
        if (profile.wellnessInterests.length > 0)
          profileParts.push(`Wellness Interests: ${profile.wellnessInterests.join(', ')}`);
        if (profile.dietaryPreferences.length > 0)
          profileParts.push(`Dietary Preferences: ${profile.dietaryPreferences.join(', ')}`);
        if (profile.favoriteCategories.length > 0)
          profileParts.push(`Favorite Categories: ${profile.favoriteCategories.join(', ')}`);
      }
    }
  }

  // Step 6: Load conversation history
  let history: ChatMessage[] = [];
  if (conversationId) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY_MESSAGES,
    });
    history = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  // Step 7: Truncate history to fit context window
  history = truncateHistory(history, MAX_TOKENS, dynamicSystemPrompt);

  // Step 8: Build context string combining vault data + user preferences
  const contextParts: string[] = [];
  if (vaultResults.length > 0) {
    contextParts.push('--- User Data ---');
    contextParts.push(...vaultResults);
  }
  if (profileParts.length > 0) {
    contextParts.push('--- User Preferences ---');
    contextParts.push(...profileParts);
  }
  const contextData = contextParts.join('\n');

  // Step 9: Stream LLM response with 30-second timeout
  let receivedTokens = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (!receivedTokens) {
        reject(new Error('STREAM_TIMEOUT'));
      }
    }, STREAM_TIMEOUT_MS);
  });

  try {
    const llmStream = stream({
      systemPrompt: dynamicSystemPrompt,
      history,
      contextData,
      userMessage: sanitizedMessage,
    });

    const iterator = llmStream[Symbol.asyncIterator]();

    while (true) {
      const result = await Promise.race([
        iterator.next(),
        timeoutPromise,
      ]);

      if (result.done) break;

      receivedTokens = true;
      yield result.value;
    }
  } catch (error: any) {
    if (error?.message === 'STREAM_TIMEOUT') {
      yield '\n\n[Response timed out. Please try again.]';
    } else {
      throw error;
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  // Step 10: Log data access to audit trail
  if (relevantScopes.length > 0) {
    await auditService.log({
      userId,
      actionType: 'data_read',
      resource: 'agent_context',
      personaId,
      metadata: { scopes: relevantScopes, conversationId },
    });
  }

  // Step 11: Check for escalation triggers
  const lowerMessage = sanitizedMessage.toLowerCase();
  const matchedKeyword = ESCALATION_KEYWORDS.find((kw) => lowerMessage.includes(kw));

  if (matchedKeyword) {
    const escalation = await prisma.escalation.create({
      data: {
        userId,
        personaId,
        originalQuery: sanitizedMessage,
        escalationReason: `Message contains sensitive keyword: "${matchedKeyword}"`,
        status: 'pending',
      },
    });

    await auditService.log({
      userId,
      actionType: 'escalation_created',
      resource: 'escalation',
      personaId,
      metadata: { keyword: matchedKeyword, conversationId },
    });

    // Notify user about the escalation
    await notificationService.create({
      userId,
      type: 'system_notification',
      title: 'Request escalated to human advisor',
      body: `Your message about "${matchedKeyword}" has been flagged for human review. An advisor will follow up.`,
      linkedResource: `escalation:${escalation.id}`,
    });
  }
}
