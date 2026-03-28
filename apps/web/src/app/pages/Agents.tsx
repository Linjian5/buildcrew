import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AgentCard } from '../components/AgentCard';
import { HireAgentDialog } from '../components/HireAgentDialog';
import type { Agent } from '../data/agents';
import { Plus, Filter, Loader2, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../components/layout/PageContainer';
import { getAgents, hireAgent } from '../../lib/api';
import { toLocalAgent } from '../../lib/adapters';
import { useCompany } from '../../contexts/CompanyContext';
import { UpgradePrompt } from '../components/common/UpgradePrompt';
import { NoCompanyGuide } from '../components/common/NoCompanyGuide';

// Toggle to 'free' to show plan restrictions
const userPlan = 'pro' as 'free' | 'pro';
const FREE_AGENT_LIMIT = 5;

const departments = ['all', 'engineering', 'design', 'marketing', 'qa', 'devops', 'content'] as const;

export function Agents() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentCompanyId } = useCompany();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [hireDialogOpen, setHireDialogOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const fetchAgents = useCallback(() => {
    if (!currentCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getAgents(currentCompanyId)
      .then((data) => setAgents(data.map(toLocalAgent)))
      .catch((err) => {
        console.error('Failed to load agents:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [currentCompanyId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const activeCount = agents.filter((a) => a.status === 'working').length;

  const filteredAgents =
    selectedDepartment === 'all'
      ? agents
      : agents.filter((a) => a.department === selectedDepartment);

  if (loading) {
    return (
      <PageContainer scroll={true}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer scroll={true}>
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90" onClick={fetchAgents}>
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer scroll={true}>
    <div data-testid="agents-page">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-foreground">{t('agents.title')}</h1>
          <p className="text-muted-foreground">
            {t('agents.subtitle', { count: agents.length, active: activeCount })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-foreground transition-colors hover:bg-muted">
              <Filter className="h-4 w-4" />
              <span className="capitalize">{selectedDepartment === 'all' ? t('agents.allDepartments') : t(`departments.${selectedDepartment}`, selectedDepartment)}</span>
            </button>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="absolute inset-0 w-full cursor-pointer opacity-0"
              data-testid="agent-department-filter"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'all' ? t('agents.allDepartments') : t(`departments.${dept}`, dept)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (agents.length === 0) {
                navigate('/onboarding');
                return;
              }
              if (userPlan === 'free' && agents.length >= FREE_AGENT_LIMIT) {
                setUpgradeOpen(true);
              } else {
                setHireDialogOpen(true);
              }
            }}
            disabled={userPlan === 'free' && agents.length >= FREE_AGENT_LIMIT}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-opacity ${
              userPlan === 'free' && agents.length >= FREE_AGENT_LIMIT
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
            data-testid="hire-agent-btn"
          >
            <Plus className="h-4 w-4" />
            {t('agents.hireAgent')}
            {userPlan === 'free' && (
              <span className="ml-1 text-xs opacity-75">
                {agents.length}/{FREE_AGENT_LIMIT}
                {agents.length >= FREE_AGENT_LIMIT && <Lock className="ml-1 inline h-3 w-3 text-amber-500" />}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Agent Grid */}
      {filteredAgents.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {filteredAgents.length === 0 && agents.length > 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Filter className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2">No agents found</h3>
          <p className="mb-6 text-muted-foreground">Try adjusting your filters</p>
          <button
            onClick={() => setSelectedDepartment('all')}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-opacity hover:opacity-90"
          >
            Clear Filters
          </button>
        </div>
      )}

      {agents.length === 0 && !loading && (
        <NoCompanyGuide />
      )}

      {/* Hire Agent Dialog */}
      <HireAgentDialog
        open={hireDialogOpen}
        onOpenChange={setHireDialogOpen}
        onHire={async (config) => {
          await hireAgent(currentCompanyId, {
            name: config.name,
            title: config.title,
            department: config.department,
            runtime: {
              type: 'openai-compatible',
              model: config.aiModel || 'default',
              endpoint: 'https://api.openai.com/v1',
            },
            budget_monthly: config.monthlyBudget,
            heartbeat_interval_seconds: config.heartbeatInterval,
            max_concurrent_tasks: config.maxConcurrentTasks,
          });
          toast.success(t('toast.agentHired', 'Agent hired successfully!'));
          fetchAgents();
        }}
      />

      <UpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="agents"
        currentUsage={agents.length}
        limit={FREE_AGENT_LIMIT}
      />
    </div>
    </PageContainer>
  );
}
