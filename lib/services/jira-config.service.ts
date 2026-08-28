import {
  companyJiraConfig,
  setCompanyJiraConfig,
  type JiraConfigRow,
} from '@/lib/repositories/jira-config.repo';

const EMPTY_JIRA_CONFIG: JiraConfigRow = {
  base_url_var: '',
  email_var: '',
  token_var: '',
};

export async function getCompanyJiraConfigOrEmpty(companyId: number): Promise<JiraConfigRow> {
  const row = await companyJiraConfig(companyId);
  return row ?? EMPTY_JIRA_CONFIG;
}

export async function setCompanyJiraConfigVars(companyId: number, vars: JiraConfigRow): Promise<void> {
  await setCompanyJiraConfig(companyId, vars);
}
