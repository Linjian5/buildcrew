import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { AgentAvatarVideo } from '../components/agent/AgentAvatarVideo';

interface ErrorPageProps {
  error?: Error;
}

export function ErrorPage({ error }: ErrorPageProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div
      data-testid="error-page"
      className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-background px-4"
    >
      <AgentAvatarVideo agentName="ERR" department="engineering" status="error" size="lg" />

      <div className="mt-6 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h1 className="text-2xl font-semibold text-foreground">
          {t('errors.generic')}
        </h1>
      </div>

      {error?.message && (
        <pre className="mt-4 max-w-lg overflow-auto scrollbar-thin rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('errors.tryAgain', 'Try Again')}
        </button>
        <button
          onClick={() => navigate('/overview')}
          className="rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {t('errors.backToDashboard')}
        </button>
      </div>
    </div>
  );
}
