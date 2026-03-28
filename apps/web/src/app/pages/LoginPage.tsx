import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Github, Mail, Eye, EyeOff, Wrench, Users, Cpu, Zap, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation, Trans } from 'react-i18next';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { env } from '../../lib/env';

/** Icon wrapper with a pulsing ring animation */
function PulseIcon({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      {/* Pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-lg"
        style={{ border: `2px solid ${color}` }}
        animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
      />
      {/* Icon background */}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1a` }}
      >
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
      // Always call real backend API for authentication — never skip with mock
      const res = await fetch(`${env.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        const code = body.error?.code ?? '';
        const errorKey = `auth.errors.${code}`;
        setError(t(errorKey, t('auth.loginFailed', 'Invalid email or password')));
        return;
      }
      login(
        body.data.accessToken || body.data.token,
        body.data.user || { id: 'u1', name: email.split('@')[0] || 'User', email },
        body.data.refreshToken,
      );
      navigate('/overview');
    } catch {
      setError(t('auth.loginFailed', 'Unable to connect to server. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  void rememberMe; // TODO: implement persistent session

  return (
    <div data-testid="login-page" className="flex min-h-screen bg-background">
      {/* Left — Brand showcase */}
      <div className="hidden w-1/2 flex-col justify-between p-12 lg:flex">
        {/* Logo */}
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Wrench className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold">
              <span className="text-foreground">Build</span>
              <span className="text-primary">Crew</span>
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">AI Agent {t('app.tagline', 'Orchestration Platform')}</p>
        </div>

        {/* Hero text */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold leading-tight text-foreground">
              {t('login.heroTitle1', 'Build your')}
            </h1>
            <h1 className="text-4xl font-bold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#10B981]">
              {t('login.heroTitle2', 'AI Digital Team')}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {t('login.heroSubtitle', 'Let AI Agents handle everything from engineering to marketing')}
          </p>

          {/* Feature cards */}
          <div className="space-y-3">
            <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-muted/30 p-4">
              <PulseIcon color="#3B82F6">
                <Users className="h-5 w-5 text-primary" />
              </PulseIcon>
              <div>
                <p className="text-sm font-semibold text-foreground">{t('login.feature1Title', '8 Professional Departments')}</p>
                <p className="text-xs text-muted-foreground">{t('login.feature1Desc', 'Engineering, Design, Marketing — complete teams')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-muted/30 p-4">
              <PulseIcon color="#10B981">
                <Cpu className="h-5 w-5 text-[#10B981]" />
              </PulseIcon>
              <div>
                <p className="text-sm font-semibold text-foreground">{t('login.feature2Title', 'AI-Powered Collaboration')}</p>
                <p className="text-xs text-muted-foreground">{t('login.feature2Desc', 'Smart task assignment and real-time monitoring')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-muted/30 p-4">
              <PulseIcon color="#F59E0B">
                <Zap className="h-5 w-5 text-[#F59E0B]" />
              </PulseIcon>
              <div>
                <p className="text-sm font-semibold text-foreground">{t('login.feature3Title', 'Automated Workflows')}</p>
                <p className="text-xs text-muted-foreground">{t('login.feature3Desc', 'End-to-end automation from request to delivery')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-10">
          <div>
            <p className="text-3xl font-bold text-foreground">1000+</p>
            <p className="text-xs text-muted-foreground">{t('login.statCompanies', 'Active Companies')}</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">8000+</p>
            <p className="text-xs text-muted-foreground">AI Agents</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">99.9%</p>
            <p className="text-xs text-muted-foreground">{t('login.statUptime', 'Uptime')}</p>
          </div>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-[440px] rounded-2xl border border-border bg-card p-8 shadow-2xl">
          {/* Logo icon */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#10B981]">
              <Wrench className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t('auth.welcomeBack')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('auth.signInSubtitle')}</p>
          </div>

          {/* OAuth */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => toast.info(t('common.comingSoon', 'Coming Soon'))}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium text-muted-foreground opacity-60 transition-colors hover:opacity-80"
            >
              <Github className="h-4 w-4" />
              {t('auth.continueWithGithub')}
            </button>
            <button
              type="button"
              onClick={() => toast.info(t('common.comingSoon', 'Coming Soon'))}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium text-muted-foreground opacity-60 transition-colors hover:opacity-80"
            >
              <Mail className="h-4 w-4" />
              {t('auth.continueWithGoogle')}
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t('auth.orDivider')}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('auth.email')}</label>
              <input
                data-testid="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('auth.password')}</label>
              <div className="relative">
                <input
                  data-testid="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember me + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-border bg-muted/30"
                />
                {t('auth.rememberMe', 'Remember me')}
              </label>
              <Link to="#" className="text-sm text-primary hover:underline">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {/* Submit */}
            <button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-[#10B981] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('auth.login')}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {/* Sign up link */}
          <div className="mt-5 text-center text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t('auth.register')}
            </Link>
          </div>

          {/* Terms */}
          <p className="mt-4 text-center text-xs text-muted-foreground/60">
            <Trans
              i18nKey="auth.terms"
              components={{
                termsLink: <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors" />,
                privacyLink: <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors" />,
              }}
            />
          </p>
        </div>
      </div>
    </div>
  );
}
