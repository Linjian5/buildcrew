import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';

const FREE_FEATURES = [
  'pricing.free.features.agents',
  'pricing.free.features.companies',
  'pricing.free.features.routing',
  'pricing.free.features.guardian',
  'pricing.free.features.knowledge',
  'pricing.free.features.chats',
] as const;

const PRO_FEATURES = [
  'pricing.pro.features.unlimitedAgents',
  'pricing.pro.features.unlimitedCompanies',
  'pricing.pro.features.smartRouterAll',
  'pricing.pro.features.guardianFull',
  'pricing.pro.features.abTests',
  'pricing.pro.features.groupManagement',
] as const;

const TEAM_FEATURES = [
  'pricing.team.features.everythingPro',
  'pricing.team.features.multiUser',
  'pricing.team.features.sso',
  'pricing.team.features.auditLogs',
  'pricing.team.features.prioritySupport',
  'pricing.team.features.dedicatedManager',
] as const;

export function PricingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  const proPrice = annual ? 290 : 29;
  const proPeriod = annual
    ? t('pricing.perYear', '/year')
    : t('pricing.perMonth', '/month');
  const teamPrice = annual ? 990 : 99;
  const teamPeriod = annual
    ? t('pricing.perSeatYear', '/seat/year')
    : t('pricing.perSeatMonth', '/seat/month');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {t('pricing.title', 'Choose Your Plan')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.subtitle', 'Scale your AI workforce with the right plan for your needs')}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <Label className={`text-sm ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('pricing.monthly', 'Monthly')}
            </Label>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <Label className={`text-sm ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('pricing.annual', 'Annual')}
            </Label>
            {annual && (
              <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-500">
                {t('pricing.save2months', 'Save 2 months')}
              </span>
            )}
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Free Plan */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
            <h2 className="text-xl font-bold text-foreground mb-2">
              {t('pricing.free.name', 'Free')}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t('pricing.free.description', 'Get started with AI agents')}
            </p>
            <p className="text-4xl font-bold text-foreground mb-1">
              $0
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              {t('pricing.forever', 'Free forever')}
            </p>

            <Button variant="outline" className="w-full mb-8" disabled>
              {t('pricing.currentPlan', 'Current Plan')}
            </Button>

            <ul className="space-y-3 flex-1">
              {FREE_FEATURES.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Plan */}
          <div className="rounded-2xl border-2 border-primary bg-card p-8 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
              {t('pricing.popular', 'Most Popular')}
            </span>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {t('pricing.pro.name', 'Pro')}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t('pricing.pro.description', 'For power users and growing teams')}
            </p>
            <p className="text-4xl font-bold text-foreground mb-1">
              ${proPrice}
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              {proPeriod}
            </p>

            <Button className="w-full mb-8" onClick={() => navigate('/settings/subscription')}>
              {t('pricing.upgradeToPro', 'Upgrade to Pro')}
            </Button>

            <ul className="space-y-3 flex-1">
              {PRO_FEATURES.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
                  <span className="text-foreground">{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Team Plan */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
            <h2 className="text-xl font-bold text-foreground mb-2">
              {t('pricing.team.name', 'Team')}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t('pricing.team.description', 'For organizations and enterprises')}
            </p>
            <p className="text-4xl font-bold text-foreground mb-1">
              ${teamPrice}
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              {teamPeriod}
            </p>

            <Button variant="outline" className="w-full mb-8">
              {t('pricing.contactUs', 'Contact Us')}
            </Button>

            <ul className="space-y-3 flex-1">
              {TEAM_FEATURES.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
                  <span className="text-foreground">{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
