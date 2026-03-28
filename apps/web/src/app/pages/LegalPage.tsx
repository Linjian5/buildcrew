import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

const LEGAL_FILES: Record<string, string> = {
  terms: '/legal/terms.md',
  privacy: '/legal/privacy.md',
};

export function LegalPage() {
  const { t } = useTranslation();
  const { type } = useParams<{ type: string }>();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const file = type ? LEGAL_FILES[type] : null;
    if (!file) {
      setError('Page not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(file)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.text();
      })
      .then(setContent)
      .catch((err) => {
        console.error('Failed to load legal page:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link
            to="/login"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back', 'Back')}
          </Link>
          <span className="text-sm font-semibold text-foreground">BuildCrew</span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <article className="prose prose-invert max-w-none prose-headings:text-blue-100 prose-h1:text-blue-50 prose-p:text-blue-200/80 prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-blue-100 prose-li:text-blue-200/80 prose-hr:border-blue-500/20 prose-blockquote:border-blue-500/30 prose-blockquote:text-blue-300/70 prose-code:text-blue-300">
            <Markdown>{content}</Markdown>
          </article>
        )}
      </main>
    </div>
  );
}
