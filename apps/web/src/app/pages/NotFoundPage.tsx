import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AgentAvatarVideo } from '../components/agent/AgentAvatarVideo';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div
      data-testid="not-found-page"
      className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-background px-4"
    >
      <p className="mb-6 text-5xl font-bold text-muted-foreground">404</p>

      <AgentAvatarVideo agentName="??" department="executive" status="idle" size="lg" />

      <h1 className="mt-6 text-2xl font-semibold text-foreground">
        {t('errors.notFound')}
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        {t('errors.notFoundDescription', "The page you're looking for doesn't exist or has been moved.")}
      </p>

      <button
        onClick={() => navigate('/overview')}
        className="mt-8 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t('errors.backToDashboard')}
      </button>
    </div>
  );
}
