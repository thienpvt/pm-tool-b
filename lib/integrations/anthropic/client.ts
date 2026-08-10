import Anthropic, { APIConnectionTimeoutError, APIError, AuthenticationError } from '@anthropic-ai/sdk';
import { IntegrationError } from '@/lib/integrations/errors';
import type { AnthropicCredentials } from '@/lib/integrations/credentials';
import { messageContentSchema } from './schemas';

export type CreateMessageParams = {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
};

/**
 * Generate a message through the Anthropic Messages API. The only Anthropic
 * caller in the app — routes resolve credentials and map errors via
 * `integrationErrorResponse`.
 *
 * The SDK client is constructed once per call with a 120s timeout (report
 * generation is legitimately slow — a short timeout would break working
 * features). maxRetries is intentionally left at the SDK default (2) —
 * removing the retry is an unrequested behavior change (HYG-02); do not set
 * maxRetries: 0.
 *
 * Model output is untrusted: `message.content` is validated at the boundary
 * (INTG-06). Content is scanned for a text block rather than assuming
 * content[0] — extended thinking can prepend a ThinkingBlock. A missing text
 * block is a validation error, never a silent empty report.
 */
export async function createMessage(
  creds: AnthropicCredentials,
  params: CreateMessageParams,
): Promise<{ text: string }> {
  const client = new Anthropic({ apiKey: creds.apiKey, timeout: 120_000 });
  let message: { content: Array<{ type: string; text?: string }> };
  try {
    message = await client.messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      system: params.system,
      messages: params.messages,
    }) as never;
  } catch (e) {
    throw mapAnthropicError(e);
  }

  // Scan for the text block rather than assuming content[0] — extended
  // thinking can prepend a ThinkingBlock. The schema then validates the found
  // block so a malformed text value is still caught at the boundary.
  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock) {
    throw new IntegrationError({ kind: 'validation', service: 'anthropic' });
  }
  const parsed = messageContentSchema.safeParse([textBlock]);
  if (!parsed.success) {
    throw new IntegrationError({ kind: 'validation', service: 'anthropic', cause: parsed.error });
  }
  return { text: parsed.data[0].text };
}

function mapAnthropicError(e: unknown): IntegrationError {
  if (e instanceof APIConnectionTimeoutError) {
    return new IntegrationError({ kind: 'timeout', service: 'anthropic', cause: e });
  }
  if (e instanceof AuthenticationError) {
    return new IntegrationError({ kind: 'auth', service: 'anthropic', cause: e });
  }
  if (e instanceof APIError) {
    return new IntegrationError({ kind: 'upstream', service: 'anthropic', status: e.status, cause: e });
  }
  return new IntegrationError({ kind: 'network', service: 'anthropic', cause: e });
}
