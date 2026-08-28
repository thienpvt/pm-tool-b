-- migrations/0001-baseline-schema.sql
-- Regenerated v2.0 baseline from lib/db.ts + lib/db-*.ts (D-02, D-03)
-- Do NOT copy from origin/gsd/quick-260826-ded-data-layer-migrations (v1.0 only)

-- Part 1: initPostgresSchema — CREATE TABLE IF NOT EXISTS from lib/db.ts

CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS company_jira_config (
      company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      base_url_var TEXT NOT NULL DEFAULT '',
      email_var TEXT NOT NULL DEFAULT '',
      token_var TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS company_rag_config (
      company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      spi_red_threshold    FLOAT   NOT NULL DEFAULT 0.6,
      spi_amber_threshold  FLOAT   NOT NULL DEFAULT 0.8,
      deadline_red_days    INTEGER NOT NULL DEFAULT 0,
      deadline_amber_days  INTEGER NOT NULL DEFAULT 14,
      risks_red            INTEGER NOT NULL DEFAULT 3,
      risks_amber          INTEGER NOT NULL DEFAULT 1,
      issues_amber         INTEGER NOT NULL DEFAULT 1,
      low_progress_amber   FLOAT   NOT NULL DEFAULT 30,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT DEFAULT '',
      contact_name TEXT DEFAULT '',
      contact_email TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      website TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      client TEXT,
      pm_name TEXT,
      pm_email TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'active',
      current_phase TEXT DEFAULT 'Initiation',
      description TEXT,
      objective TEXT DEFAULT '',
      project_owner TEXT DEFAULT '',
      budget NUMERIC(15,2) DEFAULT 0,
      budget_currency TEXT DEFAULT 'VND',
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      phase TEXT NOT NULL DEFAULT 'General',
      no TEXT,
      activity TEXT NOT NULL,
      deliverable TEXT,
      sign_off_doc TEXT,
      accountable TEXT,
      responsible TEXT,
      support TEXT,
      plan_start TEXT,
      plan_end TEXT,
      actual_start TEXT,
      actual_end TEXT,
      status TEXT DEFAULT 'To-do',
      completion_pct INTEGER DEFAULT 0,
      notes TEXT,
      order_idx INTEGER DEFAULT 0,
      delay_owner TEXT DEFAULT 'N/A',
      delay_reason TEXT DEFAULT '',
      jira_key TEXT DEFAULT '',
      sprint TEXT DEFAULT '',
      priority TEXT DEFAULT 'Medium'
    );
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      domain TEXT,
      role TEXT,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      capacity_json TEXT DEFAULT '{}',
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      frequency TEXT,
      content TEXT,
      participants TEXT,
      method TEXT,
      type TEXT DEFAULT 'regular'
    );
    CREATE TABLE IF NOT EXISTS escalation_levels (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      level_name TEXT,
      channel TEXT,
      participants TEXT,
      input TEXT,
      output TEXT
    );
    CREATE TABLE IF NOT EXISTS risks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      risk_id TEXT,
      description TEXT NOT NULL,
      category TEXT,
      owner TEXT,
      trigger TEXT,
      mitigation TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'Open',
      priority TEXT DEFAULT 'Medium',
      impact TEXT DEFAULT 'Major',
      affected_activity_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS issues (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      issue_id TEXT,
      description TEXT NOT NULL,
      root_cause TEXT,
      category TEXT,
      owner TEXT,
      trigger TEXT,
      mitigation TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'Open',
      priority TEXT DEFAULT 'Medium',
      impact TEXT DEFAULT 'Major',
      affected_activity_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT,
      content_json TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS project_holidays (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      name TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS timeline_import_mappings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      mappings_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS budget_items (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'CAPEX',
      group_name TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'USD',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS budget_expenses (
      id SERIAL PRIMARY KEY,
      budget_item_id INTEGER NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      description TEXT NOT NULL DEFAULT '',
      amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      reference TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS portfolio_members (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      role TEXT DEFAULT '',
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS portfolio_budgets (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      period_type TEXT NOT NULL DEFAULT 'quarterly',
      period_label TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'VND',
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS portfolio_budget_categories (
      id SERIAL PRIMARY KEY,
      portfolio_budget_id INTEGER NOT NULL REFERENCES portfolio_budgets(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      ceiling_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      notes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS portfolio_budget_allocations (
      id SERIAL PRIMARY KEY,
      portfolio_budget_id INTEGER NOT NULL REFERENCES portfolio_budgets(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      allocated_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS operations_systems (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      go_live_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS operations_budget_items (
      id SERIAL PRIMARY KEY,
      operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'OPEX',
      name TEXT NOT NULL,
      planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'VND/month',
      period_label TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS operations_expenses (
      id SERIAL PRIMARY KEY,
      operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      category TEXT DEFAULT 'OPEX',
      description TEXT NOT NULL DEFAULT '',
      amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      reference TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS operations_incidents (
      id SERIAL PRIMARY KEY,
      operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'Medium',
      description TEXT DEFAULT '',
      reported_at TEXT NOT NULL,
      resolved_at TEXT,
      cost_impact NUMERIC(15,2) DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS portfolio_program_allocations (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      program_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      allocated_headcount INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, program_id)
    );
    CREATE TABLE IF NOT EXISTS program_project_allocations (
      id SERIAL PRIMARY KEY,
      program_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      allocated_headcount INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(program_id, project_id)
    );
    CREATE TABLE IF NOT EXISTS milestones (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS milestone_epics (
      id SERIAL PRIMARY KEY,
      milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
      activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      UNIQUE(milestone_id, activity_id)
    );
    CREATE TABLE IF NOT EXISTS demo_requests (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      company_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bugs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      issue_type TEXT DEFAULT '',
      issue_key TEXT DEFAULT '',
      issue_id TEXT DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      assignee TEXT DEFAULT '',
      reporter TEXT DEFAULT '',
      priority TEXT DEFAULT 'Medium',
      severity TEXT DEFAULT '',
      status TEXT DEFAULT 'To Do',
      resolution TEXT DEFAULT '',
      created TEXT DEFAULT '',
      snapshot_date TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS jira_jql_presets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      jql TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bug_import_mappings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      mappings_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Part 2: migratePostgresSchema — legacy ALTER/CREATE (boot DML fingerprints excluded)

ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE activities ADD COLUMN IF NOT EXISTS delay_owner TEXT DEFAULT 'N/A';

ALTER TABLE activities ADD COLUMN IF NOT EXISTS delay_reason TEXT DEFAULT '';

ALTER TABLE risks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';

ALTER TABLE risks ADD COLUMN IF NOT EXISTS impact TEXT DEFAULT 'Major';

ALTER TABLE risks ADD COLUMN IF NOT EXISTS affected_activity_id INTEGER;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';

ALTER TABLE issues ADD COLUMN IF NOT EXISTS impact TEXT DEFAULT 'Major';

ALTER TABLE issues ADD COLUMN IF NOT EXISTS affected_activity_id INTEGER;

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS timeline_import_mappings (id SERIAL PRIMARY KEY, name TEXT NOT NULL, mappings_json TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS budget_items (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, type TEXT NOT NULL DEFAULT 'CAPEX', group_name TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0, actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'USD', notes TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS budget_expenses (id SERIAL PRIMARY KEY, budget_item_id INTEGER NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, expense_date DATE NOT NULL DEFAULT CURRENT_DATE, description TEXT NOT NULL DEFAULT '', amount NUMERIC(15,2) NOT NULL DEFAULT 0, reference TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS jira_key TEXT DEFAULT '';

ALTER TABLE activities ADD COLUMN IF NOT EXISTS sprint TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS portfolio_members (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL, role TEXT DEFAULT '', name TEXT NOT NULL, email TEXT DEFAULT '', note TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

ALTER TABLE portfolio_members ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'internal';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS headcount_quota INTEGER DEFAULT 0;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS headcount_quota INTEGER DEFAULT 0;

ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(15,2) DEFAULT 0;

ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS budget_status TEXT DEFAULT 'draft';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_status TEXT DEFAULT 'draft';

CREATE TABLE IF NOT EXISTS portfolio_budgets (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL, period_type TEXT NOT NULL DEFAULT 'quarterly', period_label TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, total_amount NUMERIC(15,2) NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'VND', status TEXT NOT NULL DEFAULT 'draft', notes TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS portfolio_budget_categories (id SERIAL PRIMARY KEY, portfolio_budget_id INTEGER NOT NULL REFERENCES portfolio_budgets(id) ON DELETE CASCADE, category TEXT NOT NULL, ceiling_amount NUMERIC(15,2) NOT NULL DEFAULT 0, notes TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS portfolio_budget_allocations (id SERIAL PRIMARY KEY, portfolio_budget_id INTEGER NOT NULL REFERENCES portfolio_budgets(id) ON DELETE CASCADE, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, allocated_amount NUMERIC(15,2) NOT NULL DEFAULT 0, notes TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS operations_systems (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, name TEXT NOT NULL, description TEXT DEFAULT '', go_live_date TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS operations_budget_items (id SERIAL PRIMARY KEY, operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE, category TEXT NOT NULL DEFAULT 'OPEX', name TEXT NOT NULL, planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0, actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'VND/month', period_label TEXT DEFAULT '', notes TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS operations_expenses (id SERIAL PRIMARY KEY, operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE, expense_date DATE NOT NULL DEFAULT CURRENT_DATE, category TEXT DEFAULT 'OPEX', description TEXT NOT NULL DEFAULT '', amount NUMERIC(15,2) NOT NULL DEFAULT 0, reference TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS operations_incidents (id SERIAL PRIMARY KEY, operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE, title TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'Medium', description TEXT DEFAULT '', reported_at TEXT NOT NULL, resolved_at TEXT, cost_impact NUMERIC(15,2) DEFAULT 0, status TEXT NOT NULL DEFAULT 'Open', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS portfolio_program_allocations (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, program_id INTEGER REFERENCES customers(id) ON DELETE CASCADE, allocated_headcount INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(company_id, program_id));

CREATE TABLE IF NOT EXISTS program_project_allocations (id SERIAL PRIMARY KEY, program_id INTEGER REFERENCES customers(id) ON DELETE CASCADE, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, allocated_headcount INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(program_id, project_id));

ALTER TABLE portfolio_members ADD COLUMN IF NOT EXISTS member_category TEXT DEFAULT 'delivery';

ALTER TABLE portfolio_members ADD COLUMN IF NOT EXISTS overhead_remaining FLOAT DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE portfolio_program_allocations ALTER COLUMN allocated_headcount TYPE NUMERIC(6,1);
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE program_project_allocations ALTER COLUMN allocated_headcount TYPE NUMERIC(6,1);
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE activities ADD COLUMN IF NOT EXISTS project_status TEXT DEFAULT '';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS objective TEXT DEFAULT '';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_owner TEXT DEFAULT '';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget NUMERIC(15,2) DEFAULT 0;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_currency TEXT DEFAULT 'VND';

CREATE TABLE IF NOT EXISTS milestones (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name TEXT NOT NULL, start_date TEXT, end_date TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS milestone_epics (id SERIAL PRIMARY KEY, milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE, activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE, UNIQUE(milestone_id, activity_id));

CREATE TABLE IF NOT EXISTS demo_requests (id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, company_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', notes TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES activities(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS bugs (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, issue_type TEXT DEFAULT '', issue_key TEXT DEFAULT '', issue_id TEXT DEFAULT '', summary TEXT NOT NULL DEFAULT '', assignee TEXT DEFAULT '', reporter TEXT DEFAULT '', priority TEXT DEFAULT 'Medium', status TEXT DEFAULT 'To Do', resolution TEXT DEFAULT '', created TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS bug_import_mappings (id SERIAL PRIMARY KEY, name TEXT NOT NULL, mappings_json TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

ALTER TABLE bugs ADD COLUMN IF NOT EXISTS snapshot_date TEXT DEFAULT '';

ALTER TABLE bugs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS jira_jql_presets (id SERIAL PRIMARY KEY, name TEXT NOT NULL, jql TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS jira_sync_mappings (id SERIAL PRIMARY KEY, mappings_json TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

ALTER TABLE jira_jql_presets ADD COLUMN IF NOT EXISTS context TEXT DEFAULT '';

ALTER TABLE activities ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';

-- Part 3: v2.0 DDL from lib/db-*.ts exports (getDb helper order)

-- MAPPING_TENANT_DDL

ALTER TABLE timeline_import_mappings ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_timeline_import_mappings_company_unique
   ON timeline_import_mappings (company_id, name);

CREATE INDEX IF NOT EXISTS idx_timeline_import_mappings_company_id ON timeline_import_mappings (company_id);

ALTER TABLE bug_import_mappings ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bug_import_mappings_company_unique
   ON bug_import_mappings (company_id, name);

CREATE INDEX IF NOT EXISTS idx_bug_import_mappings_company_id ON bug_import_mappings (company_id);

ALTER TABLE jira_jql_presets ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jira_jql_presets_company_unique
   ON jira_jql_presets (company_id, name, context);

CREATE INDEX IF NOT EXISTS idx_jira_jql_presets_company_id ON jira_jql_presets (company_id);

ALTER TABLE jira_sync_mappings ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_jira_sync_mappings_company_id ON jira_sync_mappings (company_id);

-- ROLES_AUDIT_DDL

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_by INTEGER REFERENCES users(id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_status_check
        CHECK (status IN ('active', 'inactive', 'locked'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('cpmo', 'pm', 'viewer')),
      company_id INTEGER REFERENCES companies(id),
      PRIMARY KEY (user_id, role)
    );

CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      actor_id INTEGER REFERENCES users(id),
      entity_type TEXT,
      entity_id TEXT,
      action TEXT,
      before JSONB,
      after JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    );

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON users (LOWER(email))
    WHERE email IS NOT NULL AND email <> '';

-- PROJECT_MASTER_DDL

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS portfolio_year INTEGER;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_reason TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS rag TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS weekly_report_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS weekly_report_start_period TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_end TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS adjusted_end TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_end TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS classification TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS governance TEXT;

CREATE TABLE IF NOT EXISTS project_pm_assignments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK (role IN ('primary','collaborator')),
      effective_from DATE NOT NULL,
      effective_to DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    );

CREATE TABLE IF NOT EXISTS project_stakeholders (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      stakeholder_role TEXT NOT NULL CHECK (stakeholder_role IN ('sponsor','psc_chair','psc_member','project_director','key_stakeholder')),
      user_id INTEGER REFERENCES users(id),
      external_name TEXT,
      external_email TEXT,
      effective_from DATE NOT NULL,
      effective_to DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    );

CREATE UNIQUE INDEX IF NOT EXISTS projects_company_code_lower_unique
    ON projects (company_id, LOWER(project_code))
    WHERE project_code IS NOT NULL AND TRIM(project_code) <> '';

-- PROJECT_MASTER_CONSTRAINTS_DDL

CREATE UNIQUE INDEX IF NOT EXISTS project_pm_assignments_one_open_primary_unique
    ON project_pm_assignments (project_id)
    WHERE role = 'primary' AND effective_to IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_pm_assignments_open_user_role_unique
    ON project_pm_assignments (project_id, user_id, role)
    WHERE effective_to IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_stakeholders_singleton_open_unique
    ON project_stakeholders (project_id, stakeholder_role)
    WHERE effective_to IS NULL
      AND stakeholder_role IN ('sponsor', 'psc_chair', 'project_director');

-- RAID_MASTERS_DDL

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planned';

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS plan_end TEXT;

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS adjusted_end TEXT;

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id);

ALTER TABLE risks ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS technology_council BOOLEAN DEFAULT FALSE;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS raid_due_date_history (
      id BIGSERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('risk','issue')),
      entity_id TEXT NOT NULL,
      old_due TEXT,
      new_due TEXT,
      changed_at TIMESTAMPTZ DEFAULT now(),
      changed_by INTEGER REFERENCES users(id)
    );

-- RAID backfill DML (before unique indexes, D-09)

UPDATE milestones SET plan_end = end_date
WHERE plan_end IS NULL AND end_date IS NOT NULL;

UPDATE risks SET code = LOWER(TRIM(risk_id))
WHERE code IS NULL AND risk_id IS NOT NULL AND TRIM(risk_id) <> '';

UPDATE issues SET code = LOWER(TRIM(issue_id))
WHERE code IS NULL AND issue_id IS NOT NULL AND TRIM(issue_id) <> '';

DO $$
DECLARE
  dup RECORD;
  i INT;
BEGIN
  FOR dup IN
    SELECT project_id, LOWER(code) AS lc, array_agg(id ORDER BY id) AS ids
    FROM risks
    WHERE code IS NOT NULL AND TRIM(code) <> ''
    GROUP BY project_id, LOWER(code)
    HAVING COUNT(*) > 1
  LOOP
    FOR i IN 2..array_length(dup.ids, 1) LOOP
      UPDATE risks SET code = code || '-' || i::text WHERE id = dup.ids[i];
    END LOOP;
  END LOOP;

  FOR dup IN
    SELECT project_id, LOWER(code) AS lc, array_agg(id ORDER BY id) AS ids
    FROM issues
    WHERE code IS NOT NULL AND TRIM(code) <> ''
    GROUP BY project_id, LOWER(code)
    HAVING COUNT(*) > 1
  LOOP
    FOR i IN 2..array_length(dup.ids, 1) LOOP
      UPDATE issues SET code = code || '-' || i::text WHERE id = dup.ids[i];
    END LOOP;
  END LOOP;
END $$;

-- RAID_MASTERS_INDEX_DDL

CREATE UNIQUE INDEX IF NOT EXISTS risks_project_code_lower_unique
    ON risks (project_id, LOWER(code))
    WHERE code IS NOT NULL AND TRIM(code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS issues_project_code_lower_unique
    ON issues (project_id, LOWER(code))
    WHERE code IS NOT NULL AND TRIM(code) <> '';

-- WEEKLY_REPORTS_DDL

CREATE TABLE IF NOT EXISTS company_weekly_config (
      company_id INTEGER PRIMARY KEY REFERENCES companies(id),
      due_weekday SMALLINT NOT NULL DEFAULT 5,
      due_time_utc TIME NOT NULL DEFAULT '18:00:00',
      updated_at TIMESTAMPTZ DEFAULT now(),
      updated_by INTEGER REFERENCES users(id)
    );

CREATE TABLE IF NOT EXISTS weekly_periods (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      iso_week TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      due_at TIMESTAMPTZ NOT NULL,
      display_name TEXT NOT NULL,
      config_snapshot JSONB NOT NULL,
      closed_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (company_id, iso_week)
    );

CREATE TABLE IF NOT EXISTS weekly_reports (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES weekly_periods(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      status TEXT NOT NULL DEFAULT 'not_submitted',
      first_submitted_at TIMESTAMPTZ,
      first_lateness TEXT,
      latest_version INTEGER NOT NULL DEFAULT 0,
      correction_open BOOLEAN NOT NULL DEFAULT FALSE,
      highlights TEXT,
      completed_work TEXT,
      next_week_goals TEXT,
      nearest_milestone TEXT,
      nearest_milestone_id INTEGER,
      raid_dependency TEXT,
      leadership_support TEXT,
      this_week_rag TEXT,
      prev_week_rag TEXT,
      draft_raid_json JSONB
    );

CREATE TABLE IF NOT EXISTS weekly_report_versions (
      id SERIAL PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES weekly_reports(id),
      version INTEGER NOT NULL,
      snapshot JSONB NOT NULL,
      submitted_at TIMESTAMPTZ,
      submitted_by INTEGER REFERENCES users(id),
      rag TEXT,
      progress_pct INTEGER
    );

-- WEEKLY_REPORTS_INDEX_DDL

CREATE UNIQUE INDEX IF NOT EXISTS weekly_reports_period_project_unique
     ON weekly_reports (period_id, project_id);

CREATE UNIQUE INDEX IF NOT EXISTS weekly_report_versions_report_version_unique
     ON weekly_report_versions (report_id, version);

-- WEEKLY_EXPORT_LOGS_DDL

CREATE TABLE IF NOT EXISTS weekly_export_logs (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES weekly_periods(id),
      company_id INTEGER NOT NULL REFERENCES companies(id),
      exported_by INTEGER NOT NULL REFERENCES users(id),
      exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      format TEXT NOT NULL,
      data_version INTEGER NOT NULL,
      project_ids JSONB NOT NULL,
      period_display_name TEXT NOT NULL
    );

-- FISCAL_BUDGET_DDL

CREATE TABLE IF NOT EXISTS project_fiscal_budgets (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      fiscal_year INTEGER NOT NULL,
      cost_type TEXT NOT NULL,
      approved_amount_vnd BIGINT NOT NULL,
      actual_amount_vnd BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (project_id, fiscal_year, cost_type),
      CHECK (cost_type IN ('CAPEX', 'OPEX')),
      CHECK (approved_amount_vnd >= 0),
      CHECK (actual_amount_vnd >= 0)
    );

CREATE TABLE IF NOT EXISTS budget_adjustments (
      id SERIAL PRIMARY KEY,
      fiscal_budget_id INTEGER NOT NULL REFERENCES project_fiscal_budgets(id),
      amount_vnd BIGINT NOT NULL,
      effective_date DATE NOT NULL,
      reason TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      CHECK (amount_vnd <> 0)
    );

CREATE TABLE IF NOT EXISTS financial_benefits (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      fiscal_year INTEGER NOT NULL,
      benefit_type TEXT NOT NULL,
      expected_vnd BIGINT NOT NULL,
      actual_vnd BIGINT,
      UNIQUE (project_id, fiscal_year, benefit_type),
      CHECK (benefit_type IN ('COST_SAVING', 'REVENUE', 'PRODUCTIVITY')),
      CHECK (expected_vnd >= 0)
    );

CREATE TABLE IF NOT EXISTS nonfinancial_benefits (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      group_name TEXT NOT NULL,
      measure TEXT NOT NULL,
      target TEXT NOT NULL,
      actual_text TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

CREATE TABLE IF NOT EXISTS project_dependencies (
      id SERIAL PRIMARY KEY,
      from_project_id INTEGER NOT NULL REFERENCES projects(id),
      to_project_id INTEGER NOT NULL REFERENCES projects(id),
      dependency_type TEXT NOT NULL,
      need_by DATE NOT NULL,
      effective_from DATE NOT NULL,
      effective_to DATE,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      CHECK (dependency_type IN ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH', 'BLOCKS'))
    );

-- DASHBOARDS_DDL

CREATE TABLE IF NOT EXISTS dashboard_filter_state (
      user_id INTEGER NOT NULL REFERENCES users(id),
      surface TEXT NOT NULL CHECK (surface IN ('portfolio', 'pm')),
      filters_json JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, surface)
    );

-- DOCUMENTS_DDL

CREATE TABLE IF NOT EXISTS document_catalog (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL CHECK (stage IN ('L0','L1','L2','L3','L4','L5','ALL')),
      mandatory BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

CREATE TABLE IF NOT EXISTS document_templates (
      id SERIAL PRIMARY KEY,
      catalog_id INTEGER NOT NULL REFERENCES document_catalog(id),
      company_id INTEGER NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      version INTEGER NOT NULL,
      effective_date DATE NOT NULL,
      guidance TEXT NOT NULL DEFAULT '',
      template_url TEXT,
      retired_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (catalog_id, version)
    );

CREATE TABLE IF NOT EXISTS project_document_checklist (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      catalog_id INTEGER NOT NULL REFERENCES document_catalog(id),
      status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none','drafting','pending_approval','approved','not_applicable')),
      confluence_url TEXT,
      approved_at DATE,
      approved_by TEXT,
      na_reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (project_id, catalog_id)
    );
