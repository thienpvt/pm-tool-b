import { getDb } from '@/lib/db';

/**
 * User rows read and written by the auth *routes* (login, change-password,
 * complete-onboarding).
 *
 * `lib/auth.ts` keeps its own session SQL — moving that is deliberately out of scope for
 * this phase, since the session substrate is imported by every route and refactoring it
 * here would ripple far beyond a SQL move. See 02-03-SUMMARY.md.
 */

export type AuthUserRow = {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  company_id: number | null;
  is_admin: number;
  onboarding_completed: number;
  status: string;
  email: string | null;
};

/** Full user row for a login attempt. Password comparison happens in the route. */
export async function findUserByUsername(username: string) {
  const db = await getDb();
  return db.get<AuthUserRow>('SELECT * FROM users WHERE username = ?', username);
}

/** Just the stored hash, for verifying a current password before changing it. */
export async function userPasswordHash(userId: number | string) {
  const db = await getDb();
  return db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', userId);
}

/** The caller hashes the new password — hashing is policy in lib/auth.ts, not data. */
export async function setUserPasswordHash(userId: number | string, passwordHash: string) {
  const db = await getDb();
  return db.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, userId);
}

export async function markOnboardingComplete(userId: number | string) {
  const db = await getDb();
  return db.run('UPDATE users SET onboarding_completed = 1 WHERE id = ?', userId);
}
