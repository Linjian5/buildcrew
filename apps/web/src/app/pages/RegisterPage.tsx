import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { env } from '../../lib/env';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${env.apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password: password.trim() }),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        const code = body.error?.code ?? '';
        const errorKey = `auth.errors.${code}`;
        setError(t(errorKey, t('auth.registerFailed', 'Registration failed')));
        return;
      }
      login(
        body.data.accessToken || body.data.token,
        body.data.user || { id: 'u1', name: name || email.split('@')[0] || 'User', email },
        body.data.refreshToken,
      );
      navigate('/onboarding');
    } catch {
      setError(t('auth.registerFailed', 'Unable to connect to server. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-testid="register-page"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <div className="w-full max-w-[480px] rounded-xl border border-border bg-card p-8 shadow-2xl">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <span className="text-xl font-bold text-primary-foreground">B</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('auth.createAccount')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('auth.signUpSubtitle')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="register-name">{t('auth.name')}</Label>
            <Input
              id="register-name"
              data-testid="register-name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-email">{t('auth.email')}</Label>
            <Input
              id="register-email"
              data-testid="register-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-password">{t('auth.password')}</Label>
            <Input
              id="register-password"
              data-testid="register-password"
              type="password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <Button
            data-testid="register-submit"
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? t('common.loading') : t('auth.createAccount')}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.hasAccount')}{' '}
          <Link
            to="/login"
            className="text-primary hover:underline transition-colors"
          >
            {t('auth.login')}
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          <Trans
            i18nKey="auth.registerTerms"
            components={{
              termsLink: <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors" />,
              privacyLink: <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors" />,
            }}
          />
        </p>
      </div>
    </div>
  );
}
