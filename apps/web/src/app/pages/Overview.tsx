import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../components/StatCard';
import { AgentAvatarVideo } from '../components/agent/AgentAvatarVideo';
import { departmentColors, type Agent } from '../data/agents';
import { useRealtimeUpdates } from '../../hooks';
import { PageContainer } from '../components/layout/PageContainer';
import { getAgents, getGoals, getTasks, getActiveThread, getBudget } from '../../lib/api';
import { toLocalAgent } from '../../lib/adapters';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { NoCompanyGuide } from '../components/common/NoCompanyGuide';
import {
  Users,
  CheckCircle2,
  DollarSign,
  Shield,
  Activity,
  TrendingUp,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';


interface GoalDisplay {
  title: string;
  progress: number;
  completed: number;
  total: number;
  status: 'active' | 'done' | 'blocked';
  blockedCount?: number;
}

export function Overview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentCompanyId, switchCompany, validating } = useCompany();
  const { token } = useAuth();
  const { unreadCount: chatUnread } = useChat();
  const [ariaCardRead, setAriaCardRead] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [goals, setGoals] = useState<GoalDisplay[]>([]);
  const [taskStats, setTaskStats] = useState({ inProgress: 0, completed: 0, blocked: 0 });
  const [allTasks, setAllTasks] = useState<Array<{ title: string; status: string; assigned_agent_id?: string; updated_at?: string; created_at: string }>>([]);
  const [ariaSummary, setAriaSummary] = useState<{ text: string; agentId: string; time: string } | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const fetchData = useCallback(() => {
    if (validating) return;
    if (!currentCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      getAgents(currentCompanyId).then((data) => data.map(toLocalAgent)),
      getGoals(currentCompanyId),
      getTasks(currentCompanyId),
      getActiveThread(currentCompanyId).catch(() => null),
      getBudget(currentCompanyId).catch(() => null),
    ]).then(([agentData, goalData, taskData, activeRes, budgetData]) => {
      if (budgetData) setMonthlyBudget(budgetData.budget_monthly);
      // CEO latest message from active thread
      if (activeRes?.thread) {
        const lastAgentMsg = [...activeRes.messages].reverse().find((m) => m.sender_type !== 'user');
        const msgPreview = lastAgentMsg
          ? lastAgentMsg.content.replace(/[#*`\n]/g, ' ').slice(0, 50)
          : t('overview.ariaSummary', 'Aria is managing {{count}} agents and {{tasks}} tasks', { count: agentData.length, tasks: taskData.length });
        setAriaSummary({
          text: msgPreview,
          agentId: activeRes.thread.agent_id,
          time: new Date(activeRes.thread.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
      setAgents(agentData);
      setAllTasks(taskData as Array<{ title: string; status: string; assigned_agent_id?: string; updated_at?: string; created_at: string }>);
      setTaskStats({
        inProgress: taskData.filter((t) => t.status === 'in_progress').length,
        completed: taskData.filter((t) => t.status === 'done' || t.status === ('completed' as string)).length,
        blocked: taskData.filter((t) => t.status === 'blocked').length,
      });
      setGoals(goalData.map((g) => ({
        title: g.title,
        progress: g.progress_pct,
        completed: g.completed_task_count ?? 0,
        total: g.task_count ?? 0,
        status: g.status === 'completed' ? 'done' as const : 'active' as const,
      })));
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found') || msg.includes('404')) {
        switchCompany('', '');
        return;
      }
      console.error('Failed to load overview data:', err);
      setError(msg);
    }).finally(() => setLoading(false));
  }, [currentCompanyId, validating, switchCompany]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { connected, heartbeatAgo } = useRealtimeUpdates({
    companyId: currentCompanyId,
    token: token ?? '',
    onAgentsChanged: useCallback(() => {
      getAgents(currentCompanyId).then((data) => setAgents(data.map(toLocalAgent))).catch((err) => {
        console.error('Failed to refresh agents:', err);
      });
    }, [currentCompanyId]),
    onTasksChanged: useCallback(() => {
      if (!currentCompanyId) return;
      getTasks(currentCompanyId).then((taskData) => {
        setAllTasks(taskData as Array<{ title: string; status: string; assigned_agent_id?: string; updated_at?: string; created_at: string }>);
        setTaskStats({
          inProgress: taskData.filter((t) => t.status === 'in_progress').length,
          completed: taskData.filter((t) => t.status === 'done' || t.status === ('completed' as string)).length,
          blocked: taskData.filter((t) => t.status === 'blocked').length,
        });
      }).catch((err) => console.error('Failed to refresh tasks:', err));
    }, [currentCompanyId]),
  });

  const activeAgents = agents.filter(a => a.status === 'working').length;
  const idleAgents = agents.filter(a => a.status === 'idle').length;
  const totalSpent = agents.reduce((sum, a) => sum + a.budget.spent, 0);

  // Build activity feed from working agents
  // Build activity feed from tasks + agents
  const recentActivity: Array<{ agent: Agent; text: string; time: string; type: 'success' | 'info' | 'warning' | 'danger' }> = useMemo(() => {
    const items: Array<{ agent: Agent; text: string; time: string; type: 'success' | 'info' | 'warning' | 'danger'; ts: number }> = [];
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    const fallbackAgent = agents[0] as Agent | undefined;

    for (const task of allTasks) {
      const agent = agentMap.get(task.assigned_agent_id ?? '') ?? fallbackAgent;
      if (!agent) continue;
      const ts = new Date(task.updated_at ?? task.created_at).getTime();

      if (task.status === 'done' || task.status === ('completed' as string)) {
        items.push({ agent, text: t('overview.activity.completed', 'completed "{{title}}"', { title: task.title }), time: '', type: 'success', ts });
      } else if (task.status === 'in_progress') {
        items.push({ agent, text: t('overview.activity.working', 'is working on "{{title}}"', { title: task.title }), time: '', type: 'info', ts });
      } else if (task.status === 'in_review') {
        items.push({ agent, text: t('overview.activity.review', '"{{title}}" is under review', { title: task.title }), time: '', type: 'warning', ts });
      } else if (task.status === 'blocked') {
        items.push({ agent, text: t('overview.activity.blocked', '"{{title}}" is blocked', { title: task.title }), time: '', type: 'danger', ts });
      }
    }

    items.sort((a, b) => b.ts - a.ts);
    const now = Date.now();
    return items.slice(0, 8).map((item) => {
      const diffMin = Math.round((now - item.ts) / 60000);
      const time = diffMin < 1 ? t('overview.justNow', 'just now') : diffMin < 60 ? `${diffMin}m ago` : `${Math.round(diffMin / 60)}h ago`;
      return { agent: item.agent, text: item.text, time, type: item.type };
    });
  }, [agents, allTasks, t]);

  if (loading) {
    return (
      <PageContainer className="flex items-center justify-center" data-testid="overview-page">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="flex items-center justify-center" data-testid="overview-page">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">{t('overview.loadFailed', 'Failed to load overview')}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </PageContainer>
    );
  }

  // No company / no data — show guide
  if (agents.length === 0 && goals.length === 0) {
    return (
      <PageContainer className="flex items-center justify-center" data-testid="overview-page">
        <NoCompanyGuide />
      </PageContainer>
    );
  }

  return (
    <PageContainer scroll className="flex flex-col gap-4" data-testid="overview-page">
      {/* Row 1: Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label={t('overview.activeAgents')}
          value={agents.length.toString()}
          subtitle={`${activeAgents} ${t('overview.working').toLowerCase()} · ${idleAgents} ${t('overview.idle').toLowerCase()}`}
          variant="default"
        />
        <StatCard
          icon={CheckCircle2}
          label={t('overview.tasksToday')}
          value={`${taskStats.inProgress + taskStats.completed}`}
          subtitle={`${taskStats.inProgress} ${t('tasks.status.in-progress', 'in progress')} · ${taskStats.completed} ${t('overview.completed', 'completed')}${taskStats.blocked > 0 ? ` · ${taskStats.blocked} ${t('tasks.blocked', 'blocked')}` : ''}`}
          variant={taskStats.blocked > 0 ? 'warning' : 'success'}
        />
        <StatCard
          icon={DollarSign}
          label={t('overview.dailySpend')}
          value={`$${totalSpent.toFixed(2)}`}
          subtitle={monthlyBudget > 0 ? `${t('overview.budget')}: $${(monthlyBudget / 30).toFixed(0)}/day` : `${t('overview.budget')}: ${t('overview.notSet', 'Not set')}`}
          variant="default"
        />
        <StatCard
          icon={Shield}
          label={t('overview.guardianAlerts')}
          value="0"
          subtitle={`0 ${t('overview.critical').toLowerCase()}`}
          variant="warning"
        />
      </div>

      {/* Row 2: Left (Aria + Activity + Goals) | Right (Org Chart full height) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Aria Summary Card */}
          {ariaSummary && (
            <button
              className={`flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/30 ${
                chatUnread > 0 && !ariaCardRead
                  ? 'animate-border-pulse border-primary/60'
                  : 'border-border'
              }`}
              onClick={() => {
                setAriaCardRead(true);
                navigate(`/chat?agent=${ariaSummary.agentId}&name=Aria`);
              }}
            >
              <AgentAvatarVideo agentName="Aria" department="executive" status="working" size="sm" showRing={false} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Aria · CEO</span>
                  <span className="text-xs text-muted-foreground">{ariaSummary.time}</span>
                  {chatUnread > 0 && !ariaCardRead && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {chatUnread}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground truncate">{ariaSummary.text}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                {t('overview.viewChat', 'View Chat')}
              </span>
            </button>
          )}
          {/* Activity Feed */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col min-h-[200px] overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">{t('overview.activityFeed')}</h2>
              <span className="ml-auto text-xs text-muted-foreground">Live</span>
              <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            </div>
            {recentActivity.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                <Activity className="h-8 w-8 text-muted-foreground mb-2" />
                <h3 className="font-semibold text-foreground text-sm">{t('empty.noActivity')}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t('empty.noActivityDesc')}</p>
              </div>
            )}
            <div className="space-y-4 overflow-y-auto scrollbar-thin min-h-0 flex-1 max-h-[300px]">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className={`w-1 rounded-full mt-1 ${
                      activity.type === 'success' ? 'bg-[#10B981]' :
                      activity.type === 'info' ? 'bg-[#3B82F6]' :
                      activity.type === 'warning' ? 'bg-[#F59E0B]' :
                      'bg-[#F43F5E]'
                    }`}
                    style={{ minHeight: '40px', width: '3px' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AgentAvatarVideo agentName={activity.agent.name} department={activity.agent.department} status={activity.agent.status} size="xs" showRing={false} />
                      <span className="text-sm">
                        <span className="font-medium text-foreground">{activity.agent.name}</span>
                        <span className="text-muted-foreground ml-1">{activity.text}</span>
                      </span>
                    </div>
                    <div className="text-xs text-primary">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goals Progress */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">{t('overview.goalProgress')}</h2>
            </div>
            {goals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
                <h3 className="font-semibold text-foreground text-sm">{t('empty.noGoals')}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t('empty.noGoalsDesc')}</p>
              </div>
            )}
            <div className="space-y-3">
              {goals.map((goal, i) => {
                const color = goal.status === 'done' ? '#10B981' : goal.status === 'blocked' ? '#F59E0B' : '#3B82F6';
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-foreground">{goal.title}</span>
                        {goal.status === 'done' && <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
                        {goal.status === 'blocked' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] font-medium">
                            {goal.blockedCount} {t('overview.blocked').toLowerCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{t('overview.tasksOf', { done: goal.completed, total: goal.total })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${goal.progress}%`, backgroundColor: color }} />
                      </div>
                      <span className="shrink-0 text-xs font-medium text-foreground w-10 text-right">{goal.progress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: Org Chart (full height) */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className="bg-card border border-border rounded-xl p-4 flex flex-col min-h-[300px] overflow-hidden"
          onClick={() => setSelectedAgentId(null)}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">{t('overview.orgChart')}</h2>
            <Link to="/org-chart" className="text-sm text-primary hover:underline">{t('overview.viewFullOrgChart')}</Link>
          </div>

          {agents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold text-foreground text-sm">{t('empty.noAgents')}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t('empty.noAgentsDesc')}</p>
            </div>
          )}

          {agents.length > 0 && (
            <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col items-center gap-2 py-2">
              {/* Render an org node */}
              {[agents[0]!, ...agents.slice(1)].length > 0 && (() => {
                const renderNode = (a: Agent, size: 'md' | 'sm') => {
                  const deptColor = departmentColors[a.department] ?? '#6B7280';
                  const statusColor = a.status === 'working' ? '#10B981' : a.status === 'warning' ? '#F59E0B' : a.status === 'error' ? '#F43F5E' : '#6B7280';
                  const isWorking = a.status === 'working';
                  const isSelected = selectedAgentId === a.id;
                  return (
                    <button
                      key={a.id}
                      className={`flex flex-col items-center rounded-xl border p-${size === 'md' ? '3' : '2.5'} transition-all duration-300 hover:scale-105 ${
                        isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border bg-card'
                      }`}
                      style={{ borderTopColor: deptColor, borderTopWidth: size === 'md' ? 3 : 2 }}
                      onClick={(e) => { e.stopPropagation(); setSelectedAgentId(a.id); }}
                      onDoubleClick={(e) => { e.stopPropagation(); navigate(`/chat?agent=${a.id}&name=${encodeURIComponent(a.name)}`); }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 ${size === 'md' ? 20 : 16}px ${deptColor}40`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
                    >
                      <div className="relative">
                        <AgentAvatarVideo agentName={a.name} department={a.department} status={a.status} size={size} showRing={false} />
                        <span className={`absolute -bottom-0.5 -right-0.5 flex ${size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} items-center justify-center`}>
                          {isWorking && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: statusColor }} />}
                          <span className={`relative inline-flex ${size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2'} rounded-full`} style={{ backgroundColor: statusColor }} />
                        </span>
                      </div>
                      <div className={`mt-${size === 'md' ? '2' : '1.5'} text-center`}>
                        <div className={`font-${size === 'md' ? 'semibold' : 'medium'} text-${size === 'md' ? 'sm' : 'xs'} text-foreground`}>{a.name}</div>
                        <div className={`text-${size === 'md' ? 'xs' : '[10px]'} text-muted-foreground`}>{t(`roles.${a.role}`, a.role)}</div>
                      </div>
                    </button>
                  );
                };

                return (
                  <>
                    {renderNode(agents[0]!, 'md')}
                    {agents.length > 1 && <div className="h-6 w-px bg-border" />}
                    {agents.length > 1 && (
                      <div className="flex flex-wrap justify-evenly gap-4 w-full">
                        {agents.slice(1).map((a) => renderNode(a, 'sm'))}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Selected agent info panel */}
              {selectedAgent && (
                <div className="mt-3 w-full rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{selectedAgent.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{selectedAgent.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{t(`roles.${selectedAgent.role}`, selectedAgent.role)} · {t(`departments.${selectedAgent.department}`, selectedAgent.department)}</div>
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {t('budget.title', 'Budget')}: ${selectedAgent.budget.spent.toFixed(0)} / ${selectedAgent.budget.total.toFixed(0)}
                  </div>
                  <button
                    className="mt-2 text-xs text-primary hover:underline"
                    onClick={(e) => { e.stopPropagation(); navigate(`/chat?agent=${selectedAgent.id}&name=${encodeURIComponent(selectedAgent.name)}`); }}
                  >
                    {t('overview.viewChat', 'View Chat')} →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer — real-time status */}
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground" data-testid="realtime-status">
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-secondary" />
                <span className="text-secondary">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Connecting...</span>
              </>
            )}
          </div>
          <span>·</span>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${connected ? 'bg-secondary animate-pulse' : 'bg-muted-foreground'}`} />
            <span>
              {heartbeatAgo !== null
                ? `${t('overview.lastHeartbeat')}: ${heartbeatAgo}s ago`
                : `${t('overview.lastHeartbeat')}: —`}
            </span>
          </div>
          <span>·</span>
          <span className={connected ? 'text-secondary' : 'text-muted-foreground'}>
            {connected ? t('overview.allSystemsOperational') : t('overview.waitingForConnection', 'Waiting for connection')}
          </span>
        </div>
      </div>
    </PageContainer>
  );
}
