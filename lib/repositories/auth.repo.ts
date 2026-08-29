import { getKysely } from '@/lib/db/kysely';

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
  const db = await getKysely();
  return db.selectFrom('users').selectAll().where('username', '=', username).executeTakeFirst();
}

/** Just the stored hash, for verifying a current password before changing it. */
export async function userPasswordHash(userId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('users')
    .select('password_hash')
    .where('id', '=', Number(userId))
    .executeTakeFirst();
}

/** The caller hashes the new password — hashing is policy in lib/auth.ts, not data. */
export async function setUserPasswordHash(userId: number | string, passwordHash: string) {
  const db = await getKysely();
  await db
    .updateTable('users')
    .set({ password_hash: passwordHash })
    .where('id', '=', Number(userId))
    .execute();
}

export async function markOnboardingComplete(userId: number | string) {
  const db = await getKysely();
  await db
    .updateTable('users')
    .set({ onboarding_completed: 1 })
    .where('id', '=', Number(userId))
    .execute();
}
