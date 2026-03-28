import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Lock, Check } from 'lucide-react';

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: 'agents' | 'companies' | 'router' | 'experiments' | 'chat' | 'knowledge';
  currentUsage?: number;
  limit?: number;
}

const featureDescriptionKeys: Record<UpgradePromptProps['feature'], string> = {
  agents: 'upgrade.featureDesc.agents',
  companies: 'upgrade.featureDesc.companies',
  router: 'upgrade.featureDesc.router',
  experiments: 'upgrade.featureDesc.experiments',
  chat: 'upgrade.featureDesc.chat',
  knowledge: 'upgrade.featureDesc.knowledge',
};

const proFeatureKeys = [
  'upgrade.proFeatures.unlimitedAgents',
  'upgrade.proFeatures.unlimitedCompanies',
  'upgrade.proFeatures.smartRouterAll',
  'upgrade.proFeatures.guardianFull',
  'upgrade.proFeatures.abTests',
  'upgrade.proFeatures.unlimitedKnowledge',
] as const;

export function UpgradePrompt({
  open,
  onOpenChange,
  feature,
  currentUsage,
  limit,
}: UpgradePromptProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const descriptionKey = featureDescriptionKeys[feature];
  const description =
    currentUsage != null && limit != null
      ? t(descriptionKey, { current: currentUsage, limit })
      : t(descriptionKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 mb-2">
            <Lock className="h-6 w-6 text-amber-500" />
          </div>
          <DialogTitle className="text-center">
            {t('upgrade.title', 'Upgrade to Pro')}
          </DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {proFeatureKeys.map((key) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 shrink-0 text-green-500" />
              <span className="text-foreground">{t(key)}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-2xl font-bold text-foreground">
          $29<span className="text-sm font-normal text-muted-foreground">/month</span>
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate('/pricing');
            }}
          >
            {t('upgrade.upgradeToPro', 'Upgrade to Pro')}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t('upgrade.maybeLater', 'Maybe Later')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
