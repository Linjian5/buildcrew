import type {
  Agent,
  Task,
  Company,
  Goal,
  ApiResponse,
  PaginatedResponse,
  CreateAgentInput,
} from '@buildcrew/shared';
import { api } from './api-client';

/** Budget overview response from GET /companies/:id/budget */
export interface BudgetOverview {
  budget_monthly: number;
  spent: number;
  remaining: number;
  usage_pct: number;
  agent_count: number;
  total_tasks: number;
  completed_tasks: number;
}

/** Per-agent budget from GET /companies/:id/budget/agents */
export interface AgentBudgetItem {
  id: string;
  name: string;
  title: string;
  department: string;
  runtime_model: string;
  budget_monthly: number;
  budget_spent: number;
  budget_remaining: number;
  budget_usage_pct: number;
}

/** Daily spend data point from GET /companies/:id/budget/daily */
export interface DailySpend {
  date: string;
  daily_cost: number;
  tasks_completed: number;
}

// --- Company API ---
export async function getCompanies(): Promise<Company[]> {
  const res = await api.get<PaginatedResponse<Company>>('/companies');
  return res.data;
}

export async function updateCompany(id: string, data: { name?: string; mission?: string; industry?: string; budget_monthly?: number }): Promise<Company> {
  const res = await api.put<ApiResponse<Company>>(`/companies/${id}`, data);
  return res.data;
}

export async function deleteCompany(id: string): Promise<void> {
  await api.delete(`/companies/${id}`);
}

export async function getCompany(id: string): Promise<Company> {
  const res = await api.get<ApiResponse<Company>>(`/companies/${id}`);
  return res.data;
}

// --- Agent API ---
export async function getAgents(companyId: string): Promise<Agent[]> {
  const res = await api.get<PaginatedResponse<Agent>>(`/companies/${companyId}/agents`);
  return res.data;
}

export async function getAgent(companyId: string, agentId: string): Promise<Agent> {
  const res = await api.get<ApiResponse<Agent>>(`/companies/${companyId}/agents/${agentId}`);
  return res.data;
}

// --- Task API ---
export async function getTasks(companyId: string, params?: { status?: string; agent_id?: string }): Promise<Task[]> {
  const res = await api.get<PaginatedResponse<Task>>(`/companies/${companyId}/tasks`, { params });
  return res.data;
}

export async function getTask(companyId: string, taskId: string): Promise<Task> {
  const res = await api.get<ApiResponse<Task>>(`/companies/${companyId}/tasks/${taskId}`);
  return res.data;
}

// --- Agent mutations ---
export async function hireAgent(companyId: string, input: CreateAgentInput): Promise<Agent> {
  const res = await api.post<ApiResponse<Agent>>(`/companies/${companyId}/agents`, input);
  return res.data;
}

export async function batchHireAgents(companyId: string, roles: string[]): Promise<Agent[]> {
  const res = await api.post<ApiResponse<Agent[]>>(`/companies/${companyId}/agents/batch-hire`, { roles });
  return res.data;
}

export async function pauseAgent(companyId: string, agentId: string): Promise<Agent> {
  const res = await api.post<ApiResponse<Agent>>(`/companies/${companyId}/agents/${agentId}/pause`);
  return res.data;
}

export async function resumeAgent(companyId: string, agentId: string): Promise<Agent> {
  const res = await api.post<ApiResponse<Agent>>(`/companies/${companyId}/agents/${agentId}/resume`);
  return res.data;
}

// --- Task mutations ---
export async function updateTask(
  companyId: string,
  taskId: string,
  updates: { status?: string; assigned_agent_id?: string | null; title?: string; priority?: string }
): Promise<Task> {
  const res = await api.put<ApiResponse<Task>>(`/companies/${companyId}/tasks/${taskId}`, updates);
  return res.data;
}

export async function completeTask(companyId: string, taskId: string): Promise<Task> {
  const res = await api.post<ApiResponse<Task>>(`/companies/${companyId}/tasks/${taskId}/complete`);
  return res.data;
}

// --- Goal API ---
export async function getGoals(companyId: string): Promise<Goal[]> {
  const res = await api.get<PaginatedResponse<Goal>>(`/companies/${companyId}/goals`);
  return res.data;
}

// --- Budget API ---
export async function getBudget(companyId: string): Promise<BudgetOverview> {
  const res = await api.get<ApiResponse<BudgetOverview>>(`/companies/${companyId}/budget`);
  return res.data;
}

export async function getBudgetAgents(companyId: string): Promise<AgentBudgetItem[]> {
  const res = await api.get<ApiResponse<AgentBudgetItem[]>>(`/companies/${companyId}/budget/agents`);
  return res.data;
}

export async function getBudgetDaily(companyId: string): Promise<DailySpend[]> {
  const res = await api.get<ApiResponse<DailySpend[]>>(`/companies/${companyId}/budget/daily`);
  return res.data;
}

// --- Smart Router API ---

export interface RoutingDecision {
  id: string;
  company_id: string;
  task_id: string;
  candidates: unknown[];
  strategy: string;
  selected_agent_id: string;
  reasoning: string;
  created_at: string | null;
}

export async function getRoutingDecisions(companyId: string): Promise<RoutingDecision[]> {
  const res = await api.get<{ data: RoutingDecision[] }>(`/companies/${companyId}/routing/decisions`);
  return res.data;
}

export async function setRoutingStrategy(companyId: string, strategy: string): Promise<void> {
  await api.put(`/companies/${companyId}/routing/strategy`, { strategy });
}

// --- Guardian API ---

export interface GuardianAlert {
  id: string;
  company_id: string;
  agent_id: string;
  task_id: string;
  severity: string;
  category: string;
  description: string;
  evidence: unknown;
  auto_action: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string | null;
}

export interface GuardianPolicy {
  id: string;
  company_id: string;
  policy_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export async function getGuardianAlerts(companyId: string, params?: { severity?: string; resolved?: string }): Promise<GuardianAlert[]> {
  const res = await api.get<{ data: GuardianAlert[] }>(`/companies/${companyId}/guardian/alerts`, { params });
  return res.data;
}

export async function dismissAlert(companyId: string, alertId: string): Promise<void> {
  await api.put(`/companies/${companyId}/guardian/alerts/${alertId}`, { action: 'dismiss' });
}

export async function getGuardianPolicies(companyId: string): Promise<GuardianPolicy[]> {
  const res = await api.get<GuardianPolicy[]>(`/companies/${companyId}/guardian/policies`);
  return res;
}

export async function togglePolicy(companyId: string, policyType: string, config: Record<string, unknown>, enabled: boolean): Promise<void> {
  await api.put(`/companies/${companyId}/guardian/policies`, { policy_type: policyType, config, enabled });
}

// --- Review Pipeline API ---

export interface Review {
  id: string;
  company_id: string;
  task_id: string;
  stage: string;
  status: string;
  reviewer_agent_id: string | null;
  comments: Array<{ author: string; content: string; timestamp: string }> | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getReviews(companyId: string, params?: { status?: string; stage?: string }): Promise<Review[]> {
  const res = await api.get<{ data: Review[] }>(`/companies/${companyId}/reviews`, { params });
  return res.data;
}

export async function approveReview(companyId: string, reviewId: string, comment?: string): Promise<void> {
  await api.post(`/companies/${companyId}/reviews/${reviewId}/approve`, comment ? { comment } : {});
}

export async function rejectReview(companyId: string, reviewId: string, comment: string): Promise<void> {
  await api.post(`/companies/${companyId}/reviews/${reviewId}/reject`, { comment });
}

// --- Approvals API ---

export interface Approval {
  id: string;
  company_id: string;
  source: string;
  source_id: string;
  title: string;
  description: string;
  status: string;
  metadata: unknown;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string | null;
}

export async function getPendingApprovals(companyId: string): Promise<Approval[]> {
  const res = await api.get<{ data: Approval[] }>('/approvals/pending', { params: { company_id: companyId } });
  return res.data;
}

export async function approveItem(approvalId: string, comment?: string): Promise<void> {
  await api.post(`/approvals/${approvalId}/approve`, { comment });
}

export async function rejectItem(approvalId: string, comment?: string): Promise<void> {
  await api.post(`/approvals/${approvalId}/reject`, { comment });
}

// --- Knowledge Hub API ---

export interface KnowledgeEntry {
  id: string;
  company_id: string;
  type: 'pattern' | 'api_quirk' | 'config' | 'past_failure' | 'adr' | 'glossary';
  title: string;
  content: string;
  tags: string[];
  source_agent_id: string | null;
  source_task_id: string | null;
  confidence: number;
  citation_count: number;
  created_at: string;
  updated_at: string;
}

export async function getKnowledgeEntries(companyId: string, params?: { type?: string }): Promise<KnowledgeEntry[]> {
  const res = await api.get<{ data: KnowledgeEntry[] }>(`/companies/${companyId}/knowledge`, { params });
  return res.data;
}

export async function searchKnowledge(companyId: string, query: string): Promise<KnowledgeEntry[]> {
  const res = await api.get<{ data: KnowledgeEntry[] }>(`/companies/${companyId}/knowledge/search`, { params: { q: query } });
  return res.data;
}

// --- Evolution Engine API ---

export interface AgentPerformanceDetail {
  agent_id: string;
  name: string;
  title: string;
  department: string;
  overall_score: number;
  trend: 'improving' | 'stable' | 'declining';
  scores: { correctness: number; code_quality: number; efficiency: number; cost_efficiency: number; first_try_pass: number };
  tasks_completed: number;
  history: Array<{ date: string; score: number }>;
}

export interface Experiment {
  id: string;
  company_id: string;
  name: string;
  status: 'running' | 'completed' | 'draft';
  variants: string[];
  sample_size: number;
  results: unknown;
  created_at: string;
}

export async function getAgentPerformances(companyId: string): Promise<AgentPerformanceDetail[]> {
  const res = await api.get<{ data: AgentPerformanceDetail[] }>(`/companies/${companyId}/agents/performances`);
  return res.data;
}

export async function getExperiments(companyId: string): Promise<Experiment[]> {
  const res = await api.get<{ data: Experiment[] }>(`/companies/${companyId}/experiments`);
  return res.data;
}

// --- Org Chart API ---

export interface OrgNode {
  id: string;
  name: string;
  title: string;
  department: string;
  status: string;
  reports_to: string | null;
  children: OrgNode[];
}

export async function getOrgChart(companyId: string): Promise<OrgNode[]> {
  const res = await api.get<{ data: OrgNode[] }>(`/companies/${companyId}/org-chart`);
  return res.data;
}

// --- Auth API ---

export async function authLogin(email: string, password: string): Promise<{ token: string; user: { id: string; name: string; email: string } }> {
  return api.post('/auth/login', { email, password });
}

export async function authRegister(name: string, email: string, password: string): Promise<{ token: string; user: { id: string; name: string; email: string } }> {
  return api.post('/auth/register', { name, email, password });
}

// --- Group / Multi-company API ---

export interface CompanyGroup {
  id: string;
  name: string;
  companies: Array<{
    id: string;
    name: string;
    industry: string;
    agent_count: number;
    budget_monthly: number;
    budget_spent: number;
    goal_progress: number;
    alert_count: number;
    status: 'healthy' | 'warning' | 'critical';
  }>;
}

export async function getGroup(): Promise<CompanyGroup | null> {
  const res = await api.get<{ data: CompanyGroup }>('/groups/current');
  return res.data;
}

// --- User Profile API ---

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  plan: 'free' | 'pro' | 'team';
  created_at: string;
}

export async function getUserProfile(): Promise<UserProfile> {
  const res = await api.get<{ data: UserProfile }>('/users/me');
  return res.data;
}

// --- Model API Keys ---

export interface ModelApiKey {
  id: string;
  provider: string;
  display_name: string;
  key_masked: string;
  endpoint: string;
  models: string[];
  is_default: boolean;
  is_valid: boolean;
  validated_at: string | null;
  monthly_tokens: number;
  monthly_cost: number;
  created_at: string;
}

export async function getModelApiKeys(): Promise<ModelApiKey[]> {
  const res = await api.get<{ data: ModelApiKey[] }>('/model-keys');
  return res.data;
}

export async function addModelApiKey(input: { provider: string; display_name: string; api_key: string; endpoint?: string }): Promise<ModelApiKey> {
  const res = await api.post<{ data: ModelApiKey }>('/model-keys', input);
  return res.data;
}

export async function deleteModelApiKey(keyId: string): Promise<void> {
  await api.delete(`/model-keys/${keyId}`);
}

export async function validateModelApiKey(keyId: string): Promise<{ valid: boolean; error?: string }> {
  const res = await api.post<{ data: { valid: boolean; error?: string } }>(`/model-keys/${keyId}/validate`);
  return res.data;
}

export async function updateModelApiKey(keyId: string, data: { is_default?: boolean; display_name?: string; endpoint?: string }): Promise<ModelApiKey> {
  const res = await api.put<{ data: ModelApiKey }>(`/model-keys/${keyId}`, data);
  return res.data;
}

// --- Usage API ---

export interface UsageSummary {
  total_tokens: number;
  total_cost: number;
  total_requests: number;
  daily: Array<{ date: string; tokens: number; cost: number; requests: number }>;
  by_provider: Array<{ provider: string; model: string; tokens: number; cost: number; requests: number; pct: number }>;
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const res = await api.get<{ data: UsageSummary }>('/usage/summary');
  return res.data;
}

// --- Chat API ---

export interface ChatThread {
  id: string;
  company_id: string;
  agent_id: string;
  agent_name: string;
  agent_department?: string;
  thread_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_type: 'user' | 'agent' | 'system';
  sender_agent_id: string | null;
  content: string;
  message_type: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateThreadResponse {
  thread: ChatThread;
  user_message: ChatMessage | null;
  agent_response: ChatMessage | null;
}

export interface SendMessageResponse {
  user_message: ChatMessage | null;
  agent_response: ChatMessage | null;
  thread_status?: string;
}

export async function createChatThread(
  companyId: string,
  agentId: string,
  threadType: string,
  initialMessage?: string,
  language?: string,
  template?: string,
): Promise<CreateThreadResponse> {
  const res = await api.post<{ data: CreateThreadResponse }>(
    `/companies/${companyId}/chat/threads`,
    { agent_id: agentId, thread_type: threadType, initial_message: initialMessage, language: language ?? 'en', template },
  );
  return res.data;
}

export async function sendChatMessage(
  companyId: string,
  threadId: string,
  content: string,
  language?: string,
): Promise<SendMessageResponse> {
  const res = await api.post<{ data: SendMessageResponse }>(
    `/companies/${companyId}/chat/threads/${threadId}/messages`,
    { content, message_type: 'text', language: language ?? 'en' },
  );
  return res.data;
}

export async function getChatThreads(companyId: string): Promise<ChatThread[]> {
  const res = await api.get<{ data: ChatThread[] }>(`/companies/${companyId}/chat/threads`);
  return res.data;
}

export async function getThreadMessages(companyId: string, threadId: string): Promise<ChatMessage[]> {
  const res = await api.get<{ data: { messages: ChatMessage[] } }>(`/companies/${companyId}/chat/threads/${threadId}`);
  return res.data.messages;
}

export interface ActiveThreadResponse {
  thread: ChatThread;
  messages: ChatMessage[];
  is_new: boolean;
}

export async function getActiveThread(companyId: string): Promise<ActiveThreadResponse> {
  const res = await api.get<{ data: ActiveThreadResponse }>(`/companies/${companyId}/chat/active-thread`);
  return res.data;
}

export async function confirmPlan(companyId: string, threadId: string, language: string): Promise<{ status: 'ready' | 'need_info'; summary?: string }> {
  return api.post<{ status: 'ready' | 'need_info'; summary?: string }>(
    `/companies/${companyId}/chat/threads/${threadId}/confirm-plan`,
    { language, execute: false },
  );
}

export async function executePlan(companyId: string, threadId: string, language?: string): Promise<void> {
  await api.post(
    `/companies/${companyId}/chat/threads/${threadId}/confirm-plan`,
    { language: language ?? 'en', execute: true },
  );
}

export async function createCompanyViaApi(data: { name: string; mission: string; industry?: string; budget_monthly?: number }): Promise<Company> {
  const res = await api.post<ApiResponse<Company>>('/companies', data);
  return res.data;
}
