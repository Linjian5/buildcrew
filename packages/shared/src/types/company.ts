export interface Company {
  id: string;
  name: string;
  mission: string | null;
  industry: string | null;
  budget_monthly: number;
  currency: string;
  agent_count: number;
  active_agent_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCompanyInput {
  name: string;
  mission?: string;
  industry?: string;
  budget_monthly?: number;
  currency?: string;
}

export interface UpdateCompanyInput {
  name?: string;
  mission?: string;
  industry?: string;
  budget_monthly?: number;
  currency?: string;
}
