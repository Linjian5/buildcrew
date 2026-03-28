import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentAvatarVideo } from '../components/agent/AgentAvatarVideo';
import type { Agent } from '../data/agents';
import { PageContainer } from '../components/layout/PageContainer';
import { getAgents, getExperiments } from '../../lib/api';
import { toLocalAgent } from '../../lib/adapters';
import type { Experiment } from '../../lib/api';
import { useCompany } from '../../contexts/CompanyContext';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Lightbulb,
  Trophy,
  BarChart3,
  FlaskConical,
  Clock,
  Play,
  CheckCircle2,
  Loader2,
  Dna,
  Lock,
} from 'lucide-react';
import { UpgradePrompt } from '../components/common/UpgradePrompt';

// Toggle to 'free' to show plan restrictions
const userPlan = 'pro' as 'free' | 'pro';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type TabId = 'performance' | 'abtests' | 'replay';

// Generate radar data for a given agent
function getRadarData(agentId: string) {
  // Deterministic mock scores per agent
  const seeds: Record<string, number[]> = {
    '1': [97, 92, 88, 91, 96],
    '2': [82, 90, 85, 88, 80],
    '3': [94, 91, 90, 93, 92],
    '4': [70, 68, 75, 65, 72],
    '5': [85, 88, 82, 90, 83],
    '6': [93, 90, 95, 92, 91],
    '7': [80, 85, 78, 82, 79],
    '8': [76, 80, 74, 82, 77],
  };
  const values = seeds[agentId] ?? [80, 80, 80, 80, 80];
  const metricKeys = ['correctness', 'codeQuality', 'efficiency', 'costEfficiency', 'firstTryPass'] as const;
  return metricKeys.map((key, i) => ({ metric: key, value: values[i]!, fullMark: 100 }));
}

// Generate 30-day performance history for a given agent
function getPerformanceHistory(baseScore: number) {
  return Array.from({ length: 30 }, (_, i) => {
    const variation = Math.sin(i * 0.4) * 5 + Math.cos(i * 0.7) * 3;
    const trend = (i / 30) * 8;
    const score = Math.round(Math.max(50, Math.min(100, baseScore - 10 + trend + variation)));
    return { day: `Day ${i + 1}`, score };
  });
}

export function Evolution() {
  const { currentCompanyId } = useCompany();
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('performance');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
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
      getExperiments(currentCompanyId),
    ]).then(([agentData, expData]) => {
      setAgents(agentData);
      setExperiments(expData);
      if (agentData.length > 0 && !selectedAgentId) {
        setSelectedAgentId(agentData[0]!.id);
      }
    }).catch((err) => {
      console.error('Failed to fetch evolution data:', err);
      setError(err instanceof Error ? err.message : String(err));
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build leaderboard from agents data, sorted by score desc
  const leaderboard = useMemo(() =>
    [...agents]
      .sort((a, b) => b.score - a.score)
      .map((agent, idx) => ({
        rank: idx + 1,
        agent,
        score: agent.score,
        trend: agent.scoreTrend,
        statusKey:
          agent.scoreTrend === 'up'
            ? 'improving'
            : agent.scoreTrend === 'stable'
            ? 'stable'
            : agent.score < 75
            ? 'reviewNeeded'
            : 'declining',
      })),
    [agents],
  );

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0];
  const radarData = useMemo(() => getRadarData(selectedAgentId), [selectedAgentId]);
  const performanceHistory = useMemo(
    () => getPerformanceHistory(selectedAgent?.score ?? 80),
    [selectedAgent?.score],
  );

  const recommendations = agents.length > 0
    ? [
        {
          type: 'optimization',
          text: t('evolution.rec.optimization', 'Consider reassigning complex tasks to top-performing agents'),
          priority: 'high' as const,
        },
        {
          type: 'capacity',
          text: t('evolution.rec.capacity', 'Some agents are underutilized'),
          priority: 'medium' as const,
        },
        {
          type: 'improvement',
          text: t('evolution.rec.improvement', 'Quality improvements detected after recent changes'),
          priority: 'info' as const,
        },
      ]
    : [];

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'performance', label: t('evolution.tabs.performance') },
    { id: 'abtests', label: t('evolution.tabs.abTests') },
    { id: 'replay', label: t('evolution.tabs.replay') },
  ];

  const statusTextMap: Record<string, string> = {
    improving: t('evolution.trend.improving'),
    stable: t('evolution.trend.stable'),
    declining: t('evolution.trend.declining'),
    reviewNeeded: t('evolution.trend.reviewNeeded', 'Review Needed'),
  };

  const radarLabelMap: Record<string, string> = {
    correctness: t('evolution.radar.correctness', 'Correctness'),
    codeQuality: t('evolution.radar.codeQuality', 'Code Quality'),
    efficiency: t('evolution.radar.efficiency', 'Efficiency'),
    costEfficiency: t('evolution.radar.costEfficiency', 'Cost Efficiency'),
    firstTryPass: t('evolution.radar.firstTryPass', 'First-try Pass'),
  };

  if (loading) {
    return (
      <PageContainer className="flex items-center justify-center" data-testid="evolution-page">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="flex items-center justify-center" data-testid="evolution-page">
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

  if (agents.length === 0) {
    return (
      <PageContainer className="flex flex-col items-center justify-center" data-testid="evolution-page">
        <Dna className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-foreground">{t('empty.noPerformance')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('empty.noPerformanceDesc')}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="grid grid-rows-[auto_1fr] gap-4" data-testid="evolution-page">
      {/* Row 1: Header + Tabs */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">{t('evolution.title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('evolution.subtitle', 'Performance tracking and continuous improvement')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {tabs.map((tab) => {
            const isLocked = userPlan === 'free' && tab.id === 'abtests';
            return (
              <button
                key={tab.id}
                data-testid={`evolution-tab-${tab.id}`}
                onClick={() => {
                  if (isLocked) {
                    setUpgradeOpen(true);
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : isLocked
                      ? 'bg-muted text-muted-foreground/50 cursor-not-allowed'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tab.label}
                {isLocked && <Lock className="w-3 h-3 inline ml-1 text-amber-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Tab content (fills remaining) */}
      <div className="min-h-0 overflow-hidden">
        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-0">
            {/* Left: Agent Leaderboard (scrollable) */}
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-foreground">{t('evolution.leaderboard')}</h2>
              </div>
              <div className="space-y-3 overflow-y-auto min-h-0 flex-1 scrollbar-thin">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.agent.id}
                    data-testid={`leaderboard-agent-${entry.agent.id}`}
                    onClick={() => setSelectedAgentId(entry.agent.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedAgentId === entry.agent.id
                        ? 'border-primary bg-primary/10'
                        : entry.rank <= 3
                        ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                        : 'border-border bg-card hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                          entry.rank === 1
                            ? 'bg-amber-500/20 text-amber-400'
                            : entry.rank === 2
                            ? 'bg-slate-400/20 text-slate-300'
                            : entry.rank === 3
                            ? 'bg-orange-600/20 text-orange-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {entry.rank}
                      </div>
                      <AgentAvatarVideo
                        agentName={entry.agent.name}
                        department={entry.agent.department}
                        status={entry.agent.status}
                        size="md"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{entry.agent.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ({t(`roles.${entry.agent.role}`, entry.agent.role)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded ${
                              entry.statusKey === 'improving'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : entry.statusKey === 'stable'
                                ? 'bg-primary/10 text-primary'
                                : entry.statusKey === 'declining'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {statusTextMap[entry.statusKey] ?? entry.statusKey}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">{entry.score}</div>
                        <div className="text-xs text-muted-foreground">/100</div>
                      </div>
                      <div>
                        {entry.trend === 'up' && (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <TrendingUp className="w-5 h-5" />
                          </div>
                        )}
                        {entry.trend === 'down' && (
                          <div className="flex items-center gap-1 text-amber-400">
                            <TrendingDown className="w-5 h-5" />
                          </div>
                        )}
                        {entry.trend === 'stable' && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Minus className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Charts + Recommendations (scrollable) */}
            <div className="flex flex-col gap-4 min-h-0 overflow-y-auto scrollbar-thin">
              {/* Radar Chart */}
              {selectedAgent && (
                <div className="bg-card border border-border rounded-xl p-4 shrink-0">
                  <div className="mb-3">
                    <div className="flex items-center gap-3 mb-2">
                      <AgentAvatarVideo
                        agentName={selectedAgent.name}
                        department={selectedAgent.department}
                        status={selectedAgent.status}
                        size="md"
                      />
                      <div>
                        <h3 className="font-semibold text-foreground">{selectedAgent.name}</h3>
                        <p className="text-sm text-muted-foreground">{t(`roles.${selectedAgent.role}`, selectedAgent.role)}</p>
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#1E293B" />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        tickFormatter={(value: string) => radarLabelMap[value] ?? value}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fill: '#94A3B8', fontSize: 10 }}
                      />
                      <Radar
                        name={selectedAgent.name}
                        dataKey="value"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {radarData.map((item) => (
                      <div
                        key={item.metric}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{radarLabelMap[item.metric] ?? item.metric}</span>
                        <span className="font-semibold text-primary">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-semibold text-foreground">{t('evolution.recommendations')}</h2>
                  </div>
                  <div className="space-y-3">
                    {recommendations.map((rec, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          rec.priority === 'high'
                            ? 'border-amber-500/30 bg-amber-500/5'
                            : rec.priority === 'medium'
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-emerald-500/30 bg-emerald-500/5'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {rec.priority === 'high' && (
                            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                          )}
                          {rec.priority === 'medium' && (
                            <BarChart3 className="w-5 h-5 text-primary mt-0.5" />
                          )}
                          {rec.priority === 'info' && (
                            <TrendingUp className="w-5 h-5 text-emerald-400 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p
                              className={`text-sm ${
                                rec.priority === 'high'
                                  ? 'text-amber-400'
                                  : rec.priority === 'medium'
                                  ? 'text-primary'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {rec.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <h3 className="text-sm font-semibold text-foreground mb-3">{t('evolution.quickStats', 'Quick Stats')}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('evolution.avgTeamScore', 'Avg Team Score')}</span>
                        <span className="font-semibold text-foreground">
                          {(
                            agents.reduce((sum, a) => sum + a.score, 0) / agents.length
                          ).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('evolution.performanceTrend', 'Performance Trend')}</span>
                        <span className="font-semibold text-emerald-400 flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          +8.2%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('evolution.agentsImproving', 'Agents Improving')}</span>
                        <span className="font-semibold text-foreground">
                          {agents.filter((a) => a.scoreTrend === 'up').length}/{agents.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance History */}
              {selectedAgent && (
                <div className="bg-card border border-border rounded-xl p-4 shrink-0">
                  <h2 className="text-lg font-semibold text-foreground mb-3">
                    {t('evolution.performanceHistory', 'Performance History')} &mdash; {selectedAgent.name} ({t('evolution.days30', '30 Days')})
                  </h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={performanceHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        stroke="#1E293B"
                      />
                      <YAxis
                        domain={[50, 100]}
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        stroke="#1E293B"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#13131A',
                          border: '1px solid #1E293B',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-muted-foreground">{t('evolution.performanceScore', 'Performance Score')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">
                        {selectedAgent.scoreTrend === 'up'
                          ? t('evolution.trendingUp', 'Trending up')
                          : selectedAgent.scoreTrend === 'stable'
                          ? t('evolution.trend.stable')
                          : t('evolution.needsAttention', 'Needs attention')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* A/B Tests Tab */}
        {activeTab === 'abtests' && (
          <div className="space-y-4 overflow-y-auto h-full scrollbar-thin">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">{t('evolution.experiments', 'Experiments')}</h2>
              </div>
              <button
                onClick={() =>
                  console.log('Create Experiment clicked — would open creation dialog')
                }
                className="px-4 py-2 bg-[#3B82F6] text-white text-sm rounded-lg hover:bg-[#3B82F6]/90 transition-colors flex items-center gap-2"
              >
                <FlaskConical className="w-4 h-4" />
                {t('evolution.createExperiment')}
              </button>
            </div>

            {experiments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-foreground">{t('empty.noExperiments')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('empty.noExperimentsDesc')}</p>
              </div>
            )}

            <div className="space-y-4">
              {experiments.map((exp) => (
                <div
                  key={exp.id}
                  data-testid={`ab-test-card-${exp.id}`}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-foreground">{exp.name}</h3>
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                          exp.status === 'running'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-blue-500/15 text-blue-400'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {exp.status === 'running' ? (
                            <Play className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {exp.status === 'running' ? t('evolution.running', 'Running') : t('evolution.completed', 'Completed')}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {t('evolution.samples', { count: exp.sample_size })}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <div className="flex flex-wrap gap-2">
                        {exp.variants.map((v) => (
                          <span
                            key={v}
                            className="px-2 py-0.5 text-xs bg-[#1E1E2A] text-[#94A3B8] rounded border border-[#1E293B]"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {exp.status === 'completed' && exp.results != null && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-1">{t('evolution.results', 'Results')}</p>
                      <p className="text-sm font-medium text-foreground">{String(typeof exp.results === 'object' ? JSON.stringify(exp.results) : exp.results)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Experience Replay Tab */}
        {activeTab === 'replay' && (
          <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center h-full">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">{t('evolution.comingSoon', 'Coming Soon')}</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {t('evolution.replayDescription', 'Experience Replay will allow agents to replay past task executions, learn from mistakes, and refine their strategies. This feature is currently under development.')}
            </p>
          </div>
        )}
      </div>

      <UpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="experiments"
      />
    </PageContainer>
  );
}
