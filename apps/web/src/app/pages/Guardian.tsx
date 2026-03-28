import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, Shield, CheckCircle, XCircle, ChevronRight, Loader2 } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import {
  getGuardianAlerts, dismissAlert, getGuardianPolicies, togglePolicy,
  type GuardianAlert, type GuardianPolicy,
} from '../../lib/api';
import { useCompany } from '../../contexts/CompanyContext';

const severityConfig: Record<string, { color: string; icon: typeof XCircle }> = {
  critical: { color: '#F43F5E', icon: XCircle },
  warning: { color: '#F59E0B', icon: AlertTriangle },
  info: { color: '#3B82F6', icon: Info },
};

export function Guardian() {
  const { t } = useTranslation();
  const { currentCompanyId } = useCompany();
  const [alerts, setAlerts] = useState<GuardianAlert[]>([]);
  const [policies, setPolicies] = useState<GuardianPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentCompanyId) {
      setLoading(false);
      return;
    }
    try {
      const [a, p] = await Promise.all([
        getGuardianAlerts(currentCompanyId, { resolved: 'false' }),
        getGuardianPolicies(currentCompanyId),
      ]);
      setAlerts(a);
      setPolicies(p);
    } catch {
      setAlerts([]);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const infoCount = alerts.filter((a) => a.severity === 'info').length;

  const handleDismiss = async (alertId: string) => {
    try {
      await dismissAlert(currentCompanyId, alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }
  };

  const handleTogglePolicy = async (policy: GuardianPolicy) => {
    try {
      await togglePolicy(currentCompanyId, policy.policy_type, policy.config, !policy.enabled);
      setPolicies((prev) => prev.map((p) => p.id === policy.id ? { ...p, enabled: !p.enabled } : p));
    } catch {}
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'blocked': return { icon: Shield, color: '#F43F5E' };
      case 'passed': return { icon: CheckCircle, color: '#10B981' };
      case 'warning': return { icon: AlertTriangle, color: '#F59E0B' };
      default: return { icon: Info, color: '#94A3B8' };
    }
  };

  // Suppress unused variable warning — getActivityIcon used for potential future activity timeline
  void getActivityIcon;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer className="grid grid-rows-[auto_auto_1fr] gap-4" data-testid="guardian-page">
      {/* Row 1: Header + Status Badge */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-1">{t('guardian.title')}</h1>
          <p className="text-muted-foreground">{t('guardian.subtitle', 'Security monitoring and policy enforcement')}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-secondary bg-card px-4 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
          <span className="text-sm font-medium text-secondary">{t('guardian.active')}</span>
          <span className="ml-2 text-sm text-muted-foreground">
            • {t('guardian.policiesCount', { count: policies.length })}
          </span>
        </div>
      </div>

      {/* Row 2: Alert Counters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-secondary bg-card px-4 py-2">
          <span className="text-sm font-medium text-secondary">{t('guardian.criticalCount', { count: criticalCount })}</span>
        </div>
        <div className="rounded-lg border border-accent bg-card px-4 py-2">
          <div className="flex items-center gap-2">
            {warningCount > 0 && <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
            <span className="text-sm font-medium text-accent">{t('guardian.warningCount', { count: warningCount })}</span>
          </div>
        </div>
        <div className="rounded-lg border border-primary bg-card px-4 py-2">
          <span className="text-sm font-medium text-primary">{t('guardian.infoCount', { count: infoCount })}</span>
        </div>
      </div>

      {/* Row 3: Main Content (fills remaining, min-h-0) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 min-h-0">
        {/* Alerts — Left 2/3 */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-3 shrink-0">{t('guardian.activeAlerts', 'Active Alerts')}</h2>

          {alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
              <Shield className="mb-4 h-12 w-12 text-secondary" />
              <h3 className="mb-1 font-semibold">{t('guardian.allClear', 'All Clear')}</h3>
              <p className="text-sm text-muted-foreground">{t('guardian.noActiveAlerts', 'No active alerts')}</p>
            </div>
          )}

          <div className="space-y-4 overflow-y-auto scrollbar-thin min-h-0 flex-1">
            {alerts.map((alert) => {
              const cfg = severityConfig[alert.severity] ?? severityConfig.info!;
              const Icon = cfg.icon;
              return (
                <div
                  key={alert.id}
                  data-testid={`alert-${alert.id}`}
                  className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-opacity-50"
                  style={{ borderLeftWidth: '4px', borderLeftColor: cfg.color }}
                >
                  <div className="flex items-start gap-4">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: cfg.color }} />
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-2 font-semibold">{alert.category || alert.severity} {t('guardian.alert', 'Alert')}</h3>
                      <p className="mb-3 text-sm text-muted-foreground">{alert.description}</p>
                      {alert.evidence !== null && alert.evidence !== undefined && (
                        <div className="mb-4 rounded-lg border border-border bg-background p-3">
                          <p className="font-mono text-xs text-accent">{t('guardian.evidence', 'Evidence:')}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {typeof alert.evidence === 'string' ? alert.evidence : JSON.stringify(alert.evidence, null, 2)}
                          </p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-primary">
                          {alert.created_at ? new Date(alert.created_at).toLocaleString() : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          <button className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                            {t('guardian.investigate', 'Investigate')}
                          </button>
                          <button
                            onClick={() => handleDismiss(alert.id)}
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50"
                          >
                            {t('guardian.dismiss', 'Dismiss')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thin">
          {/* Policies */}
          <div className="rounded-xl border border-border bg-card p-4 shrink-0">
            <h3 className="mb-3 font-semibold">{t('guardian.policies')}</h3>
            {policies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Shield className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No policies configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {policies.map((policy) => (
                  <div
                    key={policy.id}
                    data-testid={`policy-${policy.id}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{policy.policy_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePolicy(policy)}
                        className={`h-5 w-10 rounded-full transition-colors ${
                          policy.enabled ? 'bg-secondary' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full bg-white transition-transform ${
                            policy.enabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
