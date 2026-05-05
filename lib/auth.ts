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
};

export function getSessionUser(sessionId: string): SessionUser | null {
  const db = getDb();
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT u.id, u.username, u.display_name, u.company_id, u.is_admin, c.name as company_name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, now) as SessionUser | null;
}

export function getSessionFromRequest(req: NextRequest): SessionUser | null {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;
  return getSessionUser(sessionId);
}

export function createSession(userId: number): string {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const db = getDb();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, userId, expires);
  return sessionId;
}

export function deleteSession(sessionId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
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
