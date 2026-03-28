import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Hash, Coins, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { getUsageSummary, type UsageSummary } from '@/lib/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#ef4444'];

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'orange';
}) {
  const bgColors = {
    blue: 'bg-blue-500/10',
    green: 'bg-green-500/10',
    orange: 'bg-orange-500/10',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usage Page Content (exported for embedding in Settings tab)
// ---------------------------------------------------------------------------

export function UsagePageContent() {
  const { t } = useTranslation();
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsageSummary()
      .then(setData)
      .catch((err) => {
        console.error('Failed to fetch usage summary:', err);
        setError(t('settings.usage.fetchError', 'Failed to load usage data. Please try again later.'));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleExportCsv = () => {
    // eslint-disable-next-line no-console
    console.log('Export CSV clicked', data);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-3 text-sm text-muted-foreground">{t('settings.usage.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center text-destructive">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        {t('common.noData')}
      </div>
    );
  }

  const pieData = data.by_provider.map((p) => ({
    name: `${p.provider} (${p.model})`,
    value: p.tokens,
    provider: p.provider,
  }));

  return (
    <div className="space-y-8" data-testid="settings-usage">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('settings.usage.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('settings.apiKeys.modelKeysDesc')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download size={16} />
          {t('settings.usage.exportCsv')}
        </Button>
      </div>

      <Separator />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Hash size={20} className="text-blue-500" />}
          label={t('settings.usage.totalTokens')}
          value={data.total_tokens.toLocaleString()}
          color="blue"
        />
        <StatCard
          icon={<Coins size={20} className="text-green-500" />}
          label={t('settings.usage.totalCost')}
          value={`$${data.total_cost.toFixed(2)}`}
          color="green"
        />
        <StatCard
          icon={<Zap size={20} className="text-orange-500" />}
          label={t('settings.usage.totalRequests')}
          value={data.total_requests.toLocaleString()}
          color="orange"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily usage line chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            {t('settings.usage.dailyUsage')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                yAxisId="tokens"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="cost"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line
                yAxisId="tokens"
                type="monotone"
                dataKey="tokens"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name={t('settings.usage.totalTokens')}
              />
              <Line
                yAxisId="cost"
                type="monotone"
                dataKey="cost"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name={t('settings.usage.totalCost')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Provider pie chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            {t('settings.usage.providerUsage')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => value.toLocaleString()}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail table */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('settings.usage.detailTable')}
        </h3>
        <div className="overflow-x-auto scrollbar-thin rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{t('settings.usage.provider')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('settings.usage.model')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('settings.usage.tokens')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('settings.usage.totalCost')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('settings.usage.requests')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('settings.usage.percentage')}</th>
              </tr>
            </thead>
            <tbody>
              {data.by_provider.map((row, idx) => (
                <tr key={idx} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{row.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.model}</td>
                  <td className="px-4 py-3 text-right text-foreground">{row.tokens.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-foreground">${row.cost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{row.requests.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{row.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standalone Usage Page (for direct route access)
// ---------------------------------------------------------------------------

export function UsagePage() {
  return (
    <div className="mx-auto max-w-5xl p-6" data-testid="usage-page">
      <UsagePageContent />
    </div>
  );
}
