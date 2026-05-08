import crypto from 'crypto';
import { getDb } from './db';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'pm_session';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

export type SessionUser = {
  id: number;
  username: string;
  display_name: string;
  company_id: number | null;
  company_name: string | null;
  is_admin: number;
  onboarding_completed: number;
};

export async function getSessionUser(sessionId: string): Promise<SessionUser | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  return (await db.get<SessionUser>(`
    SELECT u.id, u.username, u.display_name, u.company_id, u.is_admin,
           COALESCE(u.onboarding_completed, 0) as onboarding_completed,
           c.name as company_name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE s.id = ? AND s.expires_at > ?
  `, sessionId, now)) ?? null;
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;
  return getSessionUser(sessionId);
}

export async function createSession(userId: number): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const db = await getDb();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.run('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', sessionId, userId, expires);
  return sessionId;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM sessions WHERE id = ?', sessionId);
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  });
}

export function forbidden() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  });
}
