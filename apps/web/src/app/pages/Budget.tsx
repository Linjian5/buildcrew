import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import type { Agent } from '../data/agents';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PageContainer } from '../components/layout/PageContainer';
import { getAgents, getBudget, getBudgetDaily } from '../../lib/api';
import { toLocalAgent } from '../../lib/adapters';
import type { BudgetOverview, DailySpend } from '../../lib/api';
import { useCompany } from '../../contexts/CompanyContext';


type SortField = 'name' | 'role' | 'runtime' | 'budget' | 'spent' | 'remaining' | 'usage' | 'status';
type SortDirection = 'asc' | 'desc';

function getUsagePercent(agent: Agent): number {
  return (agent.budget.spent / agent.budget.total) * 100;
}

function getRemaining(agent: Agent): number {
  return agent.budget.total - agent.budget.spent;
}

function getBudgetStatusText(percentage: number): string {
  if (percentage >= 90) return 'Critical';
  if (percentage >= 70) return 'Warning';
  return 'Healthy';
}

export function Budget() {
  const { t } = useTranslation();
  const { currentCompanyId } = useCompany();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [budgetOverview, setBudgetOverview] = useState<BudgetOverview | null>(null);
  const [dailySpend, setDailySpend] = useState<DailySpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const fetchData = useCallback(() => {
    if (!currentCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      getAgents(currentCompanyId).then((data) => data.map(toLocalAgent)),
      getBudget(currentCompanyId),
      getBudgetDaily(currentCompanyId),
    ]).then(([agentData, budget, daily]) => {
      setAgents(agentData);
      setBudgetOverview(budget);
      setDailySpend(daily);
    }).catch((err) => {
      console.error('Failed to load budget data:', err);
      setError(err instanceof Error ? err.message : String(err));
    }).finally(() => setLoading(false));
  }, [currentCompanyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Summary stats
  const monthlyBudget = budgetOverview?.budget_monthly ?? 0;
  const totalSpent = budgetOverview?.spent ?? agents.reduce((sum, agent) => sum + agent.budget.spent, 0);
  const spentPercentage = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;
  const projectedMonthEnd = totalSpent * (30 / 23);
  const savedByRouter = 0; // TODO: get from API when available

  // Daily spend data for chart
  const dailySpendData = dailySpend.map((d) => ({
    id: d.date,
    day: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    spend: d.daily_cost,
    limit: monthlyBudget > 0 ? monthlyBudget / 30 : 16.67,
  }));

  // Pie chart data
  const pieData = agents.map((agent) => ({
    name: agent.name,
    value: agent.budget.spent,
    color: agent.status === 'working' ? '#3B82F6' : '#6B7280',
    id: agent.id,
  }));

  const getBudgetStatus = (percentage: number) => {
    if (percentage >= 90) return { text: t('budget.critical', 'Critical'), color: 'text-destructive', hex: '#F43F5E', icon: AlertCircle };
    if (percentage >= 70) return { text: t('budget.warning'), color: 'text-accent', hex: '#F59E0B', icon: TrendingUp };
    return { text: t('budget.healthy'), color: 'text-secondary', hex: '#10B981', icon: TrendingDown };
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAgents = useMemo(() => {
    const sorted = [...agents].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'role':
          cmp = a.role.localeCompare(b.role);
          break;
        case 'runtime':
          cmp = a.runtime.localeCompare(b.runtime);
          break;
        case 'budget':
          cmp = a.budget.total - b.budget.total;
          break;
        case 'spent':
          cmp = a.budget.spent - b.budget.spent;
          break;
        case 'remaining':
          cmp = getRemaining(a) - getRemaining(b);
          break;
        case 'usage':
          cmp = getUsagePercent(a) - getUsagePercent(b);
          break;
        case 'status':
          cmp = getBudgetStatusText(getUsagePercent(a)).localeCompare(getBudgetStatusText(getUsagePercent(b)));
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [agents, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline-block ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline-block ml-1" />
    );
  };

  const thClass =
    'px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors';

  if (loading) {
    return (
      <PageContainer className="flex items-center justify-center" data-testid="budget-page">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer scroll={true}>
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

  if (agents.length === 0 && !loading) {
    return (
      <PageContainer className="flex flex-col items-center justify-center" data-testid="budget-page">
        <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-foreground">{t('empty.noBudget')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('empty.noBudgetDesc')}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="grid grid-rows-[auto_1fr_auto] gap-4" data-testid="budget-page">
      {/* Row 1: Header + Summary Cards */}
      <div>
        <div className="mb-3">
          <h1 className="mb-1">{t('budget.title')}</h1>
          <p className="text-muted-foreground">{t('budget.subtitle', 'Monitor and optimize your AI agent spending')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{t('budget.monthlyBudget')}</p>
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">${monthlyBudget}</p>
          </div>

          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{t('budget.spentThisMonth')}</p>
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <p className="text-3xl font-bold text-foreground">${totalSpent.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('budget.ofBudget', { percent: spentPercentage.toFixed(1) })}</p>
          </div>

          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{t('budget.projectedMonthEnd')}</p>
              <TrendingUp className="w-4 h-4 text-secondary" />
            </div>
            <p className="text-3xl font-bold text-secondary">${projectedMonthEnd.toFixed(0)}</p>
            <p className="text-xs text-secondary mt-1">{t('budget.underBudget', 'Under budget')}</p>
          </div>

          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{t('budget.savedByRouter')}</p>
              <TrendingDown className="w-4 h-4 text-secondary" />
            </div>
            <p className="text-3xl font-bold text-secondary">${savedByRouter}</p>
            <p className="text-xs text-secondary mt-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              {t('budget.costReduction', { percent: 31 })}
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Charts (fill remaining) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Daily Spend Chart */}
        <div className="p-4 bg-card border border-border rounded-xl flex flex-col min-h-0">
          <h3 className="text-lg font-semibold mb-3">{t('budget.dailySpend')}</h3>
          {dailySpendData.length > 0 ? (
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySpendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
                  <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--foreground)',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="spend"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 4 }}
                    name={t('budget.dailySpendLegend', 'Daily Spend')}
                  />
                  <Line
                    type="monotone"
                    dataKey="limit"
                    stroke="var(--destructive)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name={t('budget.dailyLimitLegend', 'Daily Limit')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center flex-1">
              <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No daily spend data available</p>
            </div>
          )}
        </div>

        {/* Spend by Agent Bar Chart */}
        <div className="p-4 bg-card border border-border rounded-xl flex flex-col min-h-0">
          <h3 className="text-lg font-semibold mb-3">{t('budget.spendByAgent')}</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pieData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--foreground)', fontSize: 12 }} width={70} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)',
                  }}
                  labelStyle={{ color: 'var(--foreground)' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, t('budget.spentThisMonth')]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {pieData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2">
            <p className="text-2xl font-bold text-foreground">${totalSpent.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{t('budget.totalSpent', 'Total Spent')}</p>
          </div>
        </div>
      </div>

      {/* Row 3: Agent Budget Details Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden max-h-[30vh] flex flex-col">
        <div className="p-4 border-b border-border shrink-0">
          <h3 className="text-lg font-semibold">{t('budget.agentBudgetDetails')}</h3>
        </div>
        <div className="overflow-y-auto scrollbar-thin overflow-x-auto min-h-0 flex-1">
          <table className="w-full" data-testid="budget-table">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className={thClass} onClick={() => handleSort('name')}>
                  {t('budget.tableHeaders.agent', 'Agent')}<SortIcon field="name" />
                </th>
                <th className={thClass} onClick={() => handleSort('role')}>
                  {t('budget.tableHeaders.role', 'Role')}<SortIcon field="role" />
                </th>
                <th className={thClass} onClick={() => handleSort('runtime')}>
                  {t('budget.tableHeaders.runtime', 'Runtime')}<SortIcon field="runtime" />
                </th>
                <th className={thClass} onClick={() => handleSort('budget')}>
                  {t('budget.tableHeaders.budget', 'Budget')}<SortIcon field="budget" />
                </th>
                <th className={thClass} onClick={() => handleSort('spent')}>
                  {t('budget.tableHeaders.spent', 'Spent')}<SortIcon field="spent" />
                </th>
                <th className={thClass} onClick={() => handleSort('remaining')}>
                  {t('budget.tableHeaders.remaining', 'Remaining')}<SortIcon field="remaining" />
                </th>
                <th className={thClass} onClick={() => handleSort('usage')}>
                  {t('budget.tableHeaders.usage', 'Usage')}<SortIcon field="usage" />
                </th>
                <th className={thClass} onClick={() => handleSort('status')}>
                  {t('budget.tableHeaders.status', 'Status')}<SortIcon field="status" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAgents.map((agent, index) => {
                const usagePercent = getUsagePercent(agent);
                const remaining = getRemaining(agent);
                const status = getBudgetStatus(usagePercent);
                const StatusIcon = status.icon;

                return (
                  <tr
                    key={agent.id}
                    className={`border-b border-border ${
                      index % 2 === 0 ? 'bg-background' : 'bg-card'
                    } hover:bg-popover transition-colors`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-foreground">{agent.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {t(`roles.${agent.role}`, agent.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {agent.runtime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      ${agent.budget.total}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      ${agent.budget.spent.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      ${remaining.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-border rounded-full overflow-hidden max-w-[120px]">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(usagePercent, 100)}%`, backgroundColor: status.hex }} />
                        </div>
                        <span className="text-xs text-muted-foreground min-w-[40px]">
                          {usagePercent.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className={`w-4 h-4 ${status.color}`} />
                        <span className={`text-sm ${status.color}`}>
                          {status.text}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
