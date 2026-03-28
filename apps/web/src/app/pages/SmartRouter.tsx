import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../components/StatCard';
import { AgentAvatarVideo } from '../components/agent/AgentAvatarVideo';
import type { Agent } from '../data/agents';
import { PageContainer } from '../components/layout/PageContainer';
import { getAgents, getRoutingDecisions } from '../../lib/api';
import { toLocalAgent } from '../../lib/adapters';
import type { RoutingDecision } from '../../lib/api';
import { useCompany } from '../../contexts/CompanyContext';
import {
  Activity,
  Zap,
  TrendingDown,
  CheckCircle2,
  Loader2,
  Route,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { UpgradePrompt } from '../components/common/UpgradePrompt';


// Toggle to 'free' to show plan restrictions
const userPlan = 'pro' as 'free' | 'pro';

export function SmartRouter() {
  const { t } = useTranslation();
  const { currentCompanyId } = useCompany();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [decisions, setDecisions] = useState<RoutingDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const fetchData = useCallback(() => {
    if (!currentCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      getAgents(currentCompanyId).then((data) => data.map(toLocalAgent)),
      getRoutingDecisions(currentCompanyId),
    ]).then(([agentData, decisionData]) => {
      setAgents(agentData);
      setDecisions(decisionData);
    }).catch((err) => {
      console.error('Failed to fetch smart router data:', err);
      setError(err instanceof Error ? err.message : String(err));
    }).finally(() => setLoading(false));
  }, [currentCompanyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const routingStrategies = [
    { id: 'cost', label: t('smartRouter.strategies.costOptimized'), active: false },
    { id: 'quality', label: t('smartRouter.strategies.qualityFirst'), active: false },
    { id: 'speed', label: t('smartRouter.strategies.speedFirst'), active: false },
    { id: 'balanced', label: t('smartRouter.strategies.balanced'), active: true },
    { id: 'roundrobin', label: t('smartRouter.strategies.roundRobin'), active: false },
  ];

  // Build workload from agents
  const agentWorkload = agents
    .map((agent) => ({
      agent,
      activeTasks: agent.tasks.filter((t) => t.status === 'active').length,
      totalTasks: agent.tasks.length,
      percentage: agent.tasks.length > 0
        ? Math.round((agent.tasks.filter((t) => t.status === 'active').length / Math.max(agent.tasks.length, 1)) * 100)
        : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 6);

  if (loading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="flex items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90" onClick={fetchData}>
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="grid grid-rows-[auto_1fr_auto] gap-4">
      {/* Row 1: Header + Strategy + Stats */}
      <div className="space-y-3">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">{t('smartRouter.title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">{t('smartRouter.subtitle')}</p>
        </div>

        {/* Strategy Selection */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
            <h2 className="text-base md:text-lg font-semibold text-foreground">{t('smartRouter.routingStrategy', 'Routing Strategy')}</h2>
            <div className="text-xs md:text-sm text-muted-foreground">
              {t('smartRouter.routingSummary', { count: decisions.length, time: '1.2s' })}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {routingStrategies.map((strategy) => {
              const isLocked = userPlan === 'free' && strategy.id !== 'balanced';
              return (
                <button
                  key={strategy.id}
                  onClick={() => {
                    if (isLocked) setUpgradeOpen(true);
                  }}
                  className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                    strategy.active
                      ? 'bg-primary text-white'
                      : isLocked
                        ? 'bg-muted text-muted-foreground/50 cursor-not-allowed'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {strategy.label}
                  {strategy.active && <CheckCircle2 className="w-3 md:w-4 h-3 md:h-4 inline ml-2" />}
                  {isLocked && <Lock className="w-3 h-3 inline ml-1 text-amber-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard
            label={t('smartRouter.tasksRoutedToday', 'Tasks Routed Today')}
            value={decisions.length.toString()}
            icon={Activity}
            subtitle="Routing decisions"
            trend="up"
          />
          <StatCard
            label={t('smartRouter.avgRoutingTime', 'Avg Routing Time')}
            value="1.2s"
            icon={Zap}
            subtitle="-0.3s improvement"
            trend="up"
          />
          <StatCard
            label={t('smartRouter.estimatedSavings', 'Estimated Savings')}
            value="$43.20"
            icon={TrendingDown}
            subtitle="+$12 this week"
            trend="up"
          />
        </div>
      </div>

      {/* Row 2: Recent Routing Decisions (fills remaining, scrollable) */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col min-h-0">
        <h2 className="text-lg font-semibold text-foreground mb-3 shrink-0">{t('smartRouter.recentDecisions')}</h2>

        {decisions.length === 0 && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center flex-1">
            <Route className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-foreground">{t('empty.noRouting')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t('empty.noRoutingDesc')}</p>
          </div>
        )}

        {(decisions.length > 0 || agents.length > 0) && (
          <div className="overflow-y-auto scrollbar-thin overflow-x-auto min-h-0 flex-1">
            <table className="w-full">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">{t('smartRouter.tableHeaders.task', 'Task')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">{t('smartRouter.tableHeaders.strategy', 'Strategy')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">{t('smartRouter.tableHeaders.reasoning', 'Reasoning')}</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((decision) => (
                  <tr key={decision.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4">
                      <span className="text-sm font-medium text-foreground">{decision.task_id}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-muted-foreground">{decision.strategy}</span>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <p className="text-sm text-muted-foreground truncate" title={decision.reasoning}>
                        {decision.reasoning}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 3: Bottom Row: Agent Workload & Routing Efficiency (~200px) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[200px]">
        {/* Agent Workload */}
        <div className="bg-card border border-border rounded-xl p-4 overflow-y-auto scrollbar-thin scrollbar-thin">
          <h2 className="text-lg font-semibold text-foreground mb-3">{t('smartRouter.agentWorkload', 'Agent Workload')}</h2>
          {agentWorkload.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No agent workload data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agentWorkload.map((item) => (
                <div key={item.agent.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AgentAvatarVideo
                      agentName={item.agent.name}
                      department={item.agent.department}
                      status={item.agent.status}
                      size="sm"
                    />
                    <span className="text-sm font-medium text-foreground">{item.agent.name}</span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden flex-1">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.percentage}%` }} />
                  </div>
                  <div className="text-sm text-muted-foreground shrink-0">
                    <span className="text-primary font-semibold">{item.activeTasks}</span> active · {item.totalTasks} total
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Routing Efficiency */}
        <div className="bg-card border border-border rounded-xl p-4 overflow-y-auto scrollbar-thin scrollbar-thin">
          <h2 className="text-lg font-semibold text-foreground mb-3">{t('smartRouter.routingEfficiency', 'Routing Efficiency')}</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">{t('smartRouter.firstTrySuccess')}</span>
                <span className="text-2xl font-bold text-emerald-400">89%</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingDown className="w-4 h-4 text-emerald-400 rotate-180" />
                <span className="text-emerald-400">+12% since Smart Router enabled</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">{t('smartRouter.avgTaskCost', 'Average Task Cost')}</span>
                <span className="text-2xl font-bold text-primary">$1.24</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">-31% vs manual assignment</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">{t('smartRouter.avgCompletionTime', 'Average Completion Time')}</span>
                <span className="text-2xl font-bold text-primary">34min</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">-18% improvement</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="router"
      />
    </PageContainer>
  );
}
