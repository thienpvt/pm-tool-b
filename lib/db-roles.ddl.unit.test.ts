import { describe, expect, it } from 'vitest';
import { ROLES_AUDIT_DDL, migrateUsersRolesAndAudit } from './db-roles';

describe('migrateRolesDdl DDL fragments', () => {
  it('exports migrateUsersRolesAndAudit function', () => {
    expect(typeof migrateUsersRolesAndAudit).toBe('function');
  });

  it('ROLES_AUDIT_DDL joined text matches user_roles and audit_logs tables (D-03, D-08)', () => {
    const ddl = ROLES_AUDIT_DDL.join('\n');
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS user_roles/);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS audit_logs/);
    expect(ddl).toMatch(/ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT/);
    expect(ddl).toMatch(/users_email_lower_unique/);
  });
});
