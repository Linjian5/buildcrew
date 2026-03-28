import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';

export function GroupDashboard() {
  const { t } = useTranslation();

  return (
    <PageContainer className="flex items-center justify-center" data-testid="group-page">
      <div className="text-center">
        <Building2 className="mx-auto mb-6 h-16 w-16 text-muted-foreground/50" />
        <h1 className="mb-3 text-2xl font-bold text-foreground">
          {t('group.comingSoonTitle', 'Group Management Coming Soon')}
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {t('group.comingSoonDesc', 'Manage multiple AI companies, cross-company budget overview, and agent lending — all from one dashboard.')}
        </p>
        <span className="mt-6 inline-block rounded-full bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
          {t('common.comingSoon')}
        </span>
      </div>
    </PageContainer>
  );
}
