import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, Plus, Loader2, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getCompanies } from '../../../lib/api';
import type { Company } from '@buildcrew/shared';

interface CompanySwitcherProps {
  open: boolean;
  onClose: () => void;
  currentCompanyId: string;
  onSwitch: (companyId: string) => void;
}

export function CompanySwitcher({ open, onClose, currentCompanyId, onSwitch }: CompanySwitcherProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getCompanies()
      .then((data) => setCompanies(data ?? []))
      .catch((err) => {
        console.error('Failed to fetch companies:', err);
        setCompanies([]);
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute left-0 top-12 z-50 w-80 rounded-xl border border-border bg-card shadow-lg"
        data-testid="company-switcher"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">{t('companySwitcher.title')}</span>
          <button
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            onClick={() => { onClose(); navigate('/onboarding'); }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('companySwitcher.newCompany')}
          </button>
        </div>

        {/* Company list */}
        <div className="max-h-72 overflow-y-auto scrollbar-thin py-1">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {!loading && fetchError && (
            <div className="px-4 py-3 text-center text-sm text-destructive">
              {t('companySwitcher.fetchError', 'Failed to load companies.')}
            </div>
          )}

          {!loading && !fetchError && companies.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t('companies.empty', 'No companies yet')}
            </div>
          )}

          {!loading && companies.map((company) => {
            const isCurrent = company.id === currentCompanyId;
            const usagePct = company.budget_monthly > 0
              ? Math.round(((company.agent_count ?? 0) * 5) / company.budget_monthly * 100)
              : 0;
            const dotColor = usagePct > 90 ? 'bg-rose-400' : usagePct > 70 ? 'bg-amber-400' : 'bg-emerald-400';

            return (
              <button
                key={company.id}
                data-testid={`company-option-${company.id}`}
                onClick={() => { onSwitch(company.id); onClose(); }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted ${
                  isCurrent ? 'border-l-2 border-l-primary bg-primary/5' : 'border-l-2 border-l-transparent'
                }`}
                style={{ height: 56 }}
              >
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-foreground">{company.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {company.industry ?? 'general'} · {company.agent_count ?? 0} agents · ${company.budget_monthly}
                  </div>
                </div>
                {isCurrent && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

        {/* Bottom links */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { toast.info(t('common.comingSoon')); onClose(); }}
              className="flex items-center gap-1.5 text-left text-sm text-muted-foreground/50 cursor-not-allowed"
            >
              {t('companySwitcher.groupDashboard')}
              <Lock className="h-3 w-3" />
            </button>
            <Link to="/companies" onClick={onClose} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {t('companySwitcher.manageCompanies')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
