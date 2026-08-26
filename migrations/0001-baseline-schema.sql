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
