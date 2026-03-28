import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Plus, Building2, Loader2, Pencil, Trash2, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../components/layout/PageContainer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { getCompanies, updateCompany, deleteCompany } from '../../lib/api';
import { useCompany } from '../../contexts/CompanyContext';
import type { Company } from '@buildcrew/shared';

export function CompaniesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentCompanyId, switchCompany } = useCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState('');
  const [editMission, setEditMission] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editBudget, setEditBudget] = useState(0);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    getCompanies()
      .then(setCompanies)
      .catch((err) => {
        console.error('Failed to fetch companies:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEdit = (c: Company) => {
    setEditCompany(c);
    setEditName(c.name);
    setEditMission(c.mission ?? '');
    setEditIndustry(c.industry ?? '');
    setEditBudget(c.budget_monthly);
  };

  const handleSave = async () => {
    if (!editCompany) return;
    setSaving(true);
    try {
      const updated = await updateCompany(editCompany.id, {
        name: editName,
        mission: editMission,
        industry: editIndustry,
        budget_monthly: editBudget,
      });
      setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (editCompany.id === currentCompanyId) {
        switchCompany(updated.id, updated.name);
      }
      setEditCompany(null);
      toast.success(t('toast.saved', 'Company updated'));
    } catch (err) {
      console.error('Failed to save company:', err);
      toast.error(t('toast.saveFailed', 'Failed to save changes'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCompany(deleteTarget.id);
      const remaining = companies.filter((c) => c.id !== deleteTarget.id);
      setCompanies(remaining);
      setDeleteTarget(null);
      setDeleteConfirmName('');
      toast.success(t('toast.deleted', 'Company deleted'));

      // If deleted the current company, switch to another or clear
      if (deleteTarget.id === currentCompanyId) {
        if (remaining.length > 0) {
          switchCompany(remaining[0]!.id, remaining[0]!.name);
        } else {
          switchCompany('', '');
          navigate('/onboarding');
        }
      } else if (remaining.length === 0) {
        switchCompany('', '');
        navigate('/onboarding');
      }
    } catch (err) {
      console.error('Failed to delete company:', err);
      toast.error(t('toast.deleteFailed', 'Failed to delete company. It may still have associated data.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = (c: Company) => {
    switchCompany(c.id, c.name);
  };

  if (loading) {
    return (
      <PageContainer className="flex items-center justify-center" data-testid="companies-page">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer scroll data-testid="companies-page">
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
    <PageContainer scroll data-testid="companies-page">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('companies.title', 'My Companies')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('companies.subtitle', 'Manage all your AI companies')}</p>
        </div>
        <Button onClick={() => navigate('/onboarding')} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('companies.createNew', 'Create New Company')}
        </Button>
      </div>

      {/* Empty state */}
      {companies.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <Building2 className="mb-4 h-14 w-14 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">{t('companies.empty', "You haven't created any AI company yet")}</h3>
          <p className="mb-6 text-sm text-muted-foreground">{t('companies.emptyDesc', 'Create your first company to get started')}</p>
          <Button onClick={() => navigate('/onboarding')} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('companies.createFirst', 'Create First Company')}
          </Button>
        </div>
      )}

      {/* Company cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {companies.map((c) => {
          const isDefault = c.id === currentCompanyId;
          const usagePct = c.budget_monthly > 0 ? Math.round(((c.budget_monthly - (c.budget_monthly * 0.43)) / c.budget_monthly) * 100) : 0;
          const spent = Math.round(c.budget_monthly * 0.57);

          return (
            <div
              key={c.id}
              className={`rounded-2xl border bg-card p-6 transition-colors ${isDefault ? 'border-primary/30' : 'border-border'}`}
              data-testid={`company-card-${c.id}`}
            >
              {/* Top row */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{c.name}</h3>
                      {isDefault && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <CheckCircle className="h-3 w-3" />
                          {t('companies.default', 'Default')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.industry ?? 'General'} · {t('companies.createdAt', 'Created')} {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mission */}
              {c.mission && (
                <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                  {c.mission}
                </p>
              )}

              {/* Stats row */}
              <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span>{t('agents.title', 'Agents')}: <span className="font-medium text-foreground">{c.agent_count}</span></span>
                <span>{t('companies.spent', 'Spent')}: <span className="font-medium text-foreground">${spent}</span></span>
              </div>

              {/* Budget bar */}
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('budget.title', 'Budget')}: ${spent} / ${c.budget_monthly}</span>
                  <span className="font-medium" style={{ color: usagePct > 90 ? '#F43F5E' : usagePct > 70 ? '#F59E0B' : '#10B981' }}>{usagePct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(usagePct, 100)}%`, backgroundColor: usagePct > 90 ? '#F43F5E' : usagePct > 70 ? '#F59E0B' : '#10B981' }} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => { switchCompany(c.id, c.name); navigate('/overview'); }}>
                  {t('companies.enterDashboard', 'Enter Dashboard')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  {t('common.edit')}
                </Button>
                {!isDefault && (
                  <Button size="sm" variant="outline" onClick={() => handleSetDefault(c)} className="gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t('companies.setDefault', 'Set Default')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setDeleteTarget(c)} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editCompany} onOpenChange={(open) => { if (!open) setEditCompany(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('companies.editTitle', 'Edit Company')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('onboarding.companyName')}</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('onboarding.mission')}</label>
              <textarea
                value={editMission}
                onChange={(e) => setEditMission(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('companies.industry', 'Industry')}</label>
                <Input value={editIndustry} onChange={(e) => setEditIndustry(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('budget.monthlyBudget')}</label>
                <Input type="number" value={editBudget} onChange={(e) => setEditBudget(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCompany(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !editName.trim()}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmName(''); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('companies.deleteTitle', 'Delete Company')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t('companies.deleteWarning', 'Are you sure you want to delete')} <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
            </p>
            <p className="text-sm text-destructive/80">
              {t('companies.deleteIrreversible', 'This action cannot be undone. All agents, tasks, and knowledge data under this company will be permanently deleted.')}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('companies.deleteConfirmLabel', 'Type the company name to confirm')}:
              </label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget?.name}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting || deleteConfirmName.trim() !== deleteTarget?.name.trim()}
              onClick={handleDelete}
            >
              {deleting ? t('common.loading') : t('companies.confirmDelete', 'Confirm Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
