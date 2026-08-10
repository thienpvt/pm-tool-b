import { z } from 'zod';
import { IntegrationError, withFetchTimeout } from '@/lib/integrations/errors';
import type { ResendCredentials } from '@/lib/integrations/credentials';

export type SendEmailParams = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send a transactional email through Resend. The only Resend caller in the app —
 * routes resolve credentials and map errors via `integrationErrorResponse`.
 *
 * The body is parsed BEFORE the ok check so `data.message`/`data.name` survive as
 * the error `cause` (Pitfall 4 string preservation). A 2xx body without an `id`
 * fails zod boundary validation (INTG-05/06) rather than returning a partial
 * value (T-03-07).
 */
export async function sendEmail(
  creds: ResendCredentials,
  params: SendEmailParams,
): Promise<string | undefined> {
  const { value: response, error } = await withFetchTimeout(
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text ?? '',
      }),
    }),
    15_000,
    undefined,
    'resend',
  );
  if (error) throw error;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new IntegrationError({
      kind: 'upstream',
      service: 'resend',
      status: response.status,
      cause: data,
    });
  }

  const parsed = z.object({ id: z.string() }).passthrough().safeParse(data);
  if (!parsed.success) {
    throw new IntegrationError({ kind: 'validation', service: 'resend', cause: parsed.error });
  }
  return parsed.data.id;
}
