import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { normalizeLocale } from '../../i18n';
import { PageContainer } from '../components/layout/PageContainer';
import {
  User,
  Key,
  CreditCard,
  Palette,
  Github,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Plus,
  Download,
  Moon,
  Sun,
  Monitor,
  Trash2,
  ChevronDown,
  ChevronRight,
  Shield,
  Star,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '../components/ui/collapsible';
import {
  getModelApiKeys,
  addModelApiKey,
  deleteModelApiKey,
  validateModelApiKey,
  updateModelApiKey,
  type ModelApiKey,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const tabs = [
  { id: 'profile', labelKey: 'settings.tabs.profile', icon: User, group: 'Account', hidden: false },
  { id: 'api-keys', labelKey: 'settings.tabs.apiKeys', icon: Key, group: 'Account', hidden: true },
  { id: 'usage', labelKey: 'settings.tabs.usage', icon: BarChart3, group: 'Account', hidden: true },
  { id: 'subscription', labelKey: 'settings.tabs.subscription', icon: CreditCard, group: 'Account', hidden: true },
  { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: Palette, group: 'Preferences', hidden: false },
] as const;

type SettingsTab = (typeof tabs)[number]['id'];

type Theme = 'dark' | 'light' | 'system';

interface PlatformApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  revealed: boolean;
}

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'Paid';
}

const MODEL_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)', endpoint: 'https://api.anthropic.com' },
  { value: 'openai', label: 'OpenAI (GPT)', endpoint: 'https://api.openai.com/v1' },
  { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1' },
  { value: 'zhipu', label: '\u667A\u8C31 AI (GLM)', endpoint: 'https://open.bigmodel.cn/api/paas/v4' },
  { value: 'moonshot', label: '\u6708\u4E4B\u6697\u9762 (Kimi)', endpoint: 'https://api.moonshot.cn/v1' },
  { value: 'custom', label: 'Custom', endpoint: '' },
] as const;

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    anthropic: 'A',
    openai: 'O',
    deepseek: 'D',
    zhipu: '\u667A',
    moonshot: '\u6708',
    custom: 'C',
  };
  return icons[provider] ?? provider.charAt(0).toUpperCase();
}

function getProviderLabel(provider: string): string {
  const found = MODEL_PROVIDERS.find((p) => p.value === provider);
  return found?.label ?? provider;
}

// ---------------------------------------------------------------------------
// Profile Tab
// ---------------------------------------------------------------------------

function ProfileTab() {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('Lin');
  const [email] = useState('lin@buildcrew.ai');
  const [role, setRole] = useState('Owner');
  const [githubConnected, setGithubConnected] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const initialName = 'Lin';
  const initialRole = 'Owner';

  useEffect(() => {
    setDirty(displayName !== initialName || role !== initialRole);
    setSaved(false);
  }, [displayName, role]);

  const handleSave = () => {
    setDirty(false);
    setSaved(true);
  };

  return (
    <div className="space-y-8" data-testid="settings-profile">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('settings.profile.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.profile.subtitle')}</p>
      </div>

      <Separator />

      {/* Avatar */}
      <div className="flex items-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <Button variant="outline" size="sm" onClick={() => { /* placeholder */ }}>
          {t('settings.profile.changePhoto')}
        </Button>
      </div>

      {/* Form fields */}
      <div className="grid max-w-md gap-4">
        <div className="space-y-2">
          <Label htmlFor="display-name">{t('settings.profile.displayName')}</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('settings.profile.email')}</Label>
          <div className="relative">
            <Input id="email" value={email} readOnly className="pr-24" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-medium text-green-500">
              <Check size={14} /> {t('settings.profile.verified')}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('settings.profile.role')}</Label>
          <Select value={role} onValueChange={(v) => setRole(v)}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Owner">{t('settings.profile.roles.owner')}</SelectItem>
              <SelectItem value="Admin">{t('settings.profile.roles.admin')}</SelectItem>
              <SelectItem value="Member">{t('settings.profile.roles.member')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Connected Accounts */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t('settings.profile.connectedAccounts')}</h3>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Github size={20} />
            <div>
              <p className="text-sm font-medium text-foreground">GitHub</p>
              <p className="text-xs text-muted-foreground">
                {githubConnected ? t('settings.profile.connectedAs', { name: 'lin' }) : t('settings.profile.notConnected')}
              </p>
            </div>
          </div>
          <Button
            variant={githubConnected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setGithubConnected(!githubConnected)}
          >
            {githubConnected ? t('settings.profile.disconnect') : t('settings.profile.connect')}
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-5 w-5 items-center justify-center text-sm font-bold text-foreground">G</span>
            <div>
              <p className="text-sm font-medium text-foreground">Google</p>
              <p className="text-xs text-muted-foreground">
                {googleConnected ? t('settings.profile.connected') : t('settings.profile.notConnected')}
              </p>
            </div>
          </div>
          <Button
            variant={googleConnected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setGoogleConnected(!googleConnected)}
          >
            {googleConnected ? t('settings.profile.disconnect') : t('settings.profile.connect')}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Danger Zone */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-destructive">{t('settings.profile.dangerZone')}</h3>
        <div className="rounded-lg border border-destructive/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t('settings.profile.deleteAccount')}</p>
              <p className="text-xs text-muted-foreground">
                {t('settings.profile.deleteAccountDesc')}
              </p>
            </div>
            <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive hover:text-white">
              {t('settings.profile.deleteAccount')}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button disabled={!dirty} onClick={handleSave}>
          {t('settings.profile.save')}
        </Button>
        {saved && <span className="text-sm text-green-500">{t('settings.profile.changesSaved')}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Keys Tab (REWRITE)
// ---------------------------------------------------------------------------

function ApiKeysTab() {
  const { t } = useTranslation();
  const [modelKeys, setModelKeys] = useState<ModelApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [platformCollapsed, setPlatformCollapsed] = useState(true);

  // Add key form state
  const [newProvider, setNewProvider] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Per-key action states
  const [validatingIds, setValidatingIds] = useState<Set<string>>(new Set());
  const [validateErrors, setValidateErrors] = useState<Record<string, string>>({});
  const [defaultingId, setDefaultingId] = useState<string | null>(null);

  // Platform keys (kept from before)
  const [platformKeys, setPlatformKeys] = useState<PlatformApiKey[]>([
    {
      id: '1',
      name: 'Production',
      key: 'bc_sk_prod_xxxxxxxxxxxxxxxxxxxxxxxx',
      created: 'Mar 10, 2026',
      lastUsed: 'Mar 22, 2026',
      revealed: false,
    },
    {
      id: '2',
      name: 'Development',
      key: 'bc_sk_dev_xxxxxxxxxxxxxxxxxxxxxxxx',
      created: 'Mar 15, 2026',
      lastUsed: 'Mar 21, 2026',
      revealed: false,
    },
  ]);

  const fetchKeys = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getModelApiKeys()
      .then(setModelKeys)
      .catch((err) => {
        console.error('Failed to load API keys:', err);
        setLoadError(t('settings.apiKeys.loadError', 'Failed to load API keys.'));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleAddKey = async () => {
    if (!newProvider || !newDisplayName || !newApiKey) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const created = await addModelApiKey({
        provider: newProvider,
        display_name: newDisplayName,
        api_key: newApiKey,
        endpoint: newEndpoint || undefined,
      });
      setModelKeys((prev) => [...prev, created]);
      setAddDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to add API key:', err);
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      await deleteModelApiKey(keyId);
      setModelKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err) {
      console.error('Failed to delete API key:', err);
    }
  };

  const handleValidateKey = async (keyId: string) => {
    setValidatingIds((prev) => new Set(prev).add(keyId));
    setValidateErrors((prev) => { const next = { ...prev }; delete next[keyId]; return next; });
    try {
      const result = await validateModelApiKey(keyId);
      setModelKeys((prev) =>
        prev.map((k) =>
          k.id === keyId
            ? { ...k, is_valid: result.valid, validated_at: new Date().toISOString() }
            : k,
        ),
      );
      if (!result.valid && result.error) {
        setValidateErrors((prev) => ({ ...prev, [keyId]: result.error! }));
      }
    } catch (err) {
      console.error('Validate key failed:', err);
      setValidateErrors((prev) => ({
        ...prev,
        [keyId]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setValidatingIds((prev) => {
        const next = new Set(prev);
        next.delete(keyId);
        return next;
      });
    }
  };

  const handleSetDefault = async (keyId: string) => {
    setDefaultingId(keyId);
    try {
      const updated = await updateModelApiKey(keyId, { is_default: true });
      setModelKeys((prev) =>
        prev.map((k) =>
          k.id === keyId ? { ...k, ...updated, is_default: true } : { ...k, is_default: false },
        ),
      );
    } catch (err) {
      console.error('Failed to set default key:', err);
    } finally {
      setDefaultingId(null);
    }
  };

  const handleProviderChange = (provider: string) => {
    setNewProvider(provider);
    const found = MODEL_PROVIDERS.find((p) => p.value === provider);
    if (found?.endpoint) {
      setNewEndpoint(found.endpoint);
    }
  };

  const resetForm = () => {
    setNewProvider('');
    setNewDisplayName('');
    setNewApiKey('');
    setNewEndpoint('');
    setShowNewKey(false);
    setAddError(null);
  };

  const maskKey = (key: string) => key.substring(0, 10) + '...' + key.substring(key.length - 4);
  const togglePlatformReveal = (id: string) => {
    setPlatformKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, revealed: !k.revealed } : k)),
    );
  };
  const revokePlatformKey = (id: string) => {
    setPlatformKeys((prev) => prev.filter((k) => k.id !== id));
  };
  const createPlatformKey = () => {
    const newKey: PlatformApiKey = {
      id: String(Date.now()),
      name: `Key ${platformKeys.length + 1}`,
      key: 'bc_sk_new_xxxxxxxxxxxxxxxxxxxxxxxx',
      created: 'Mar 23, 2026',
      lastUsed: 'Never',
      revealed: false,
    };
    setPlatformKeys((prev) => [...prev, newKey]);
  };

  return (
    <div className="space-y-8" data-testid="settings-api-keys">
      {/* Area 1: Model API Keys (70%) */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t('settings.apiKeys.modelKeys')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.apiKeys.modelKeysDesc')}
        </p>
      </div>

      <Separator />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-3 text-sm text-muted-foreground">{t('common.loading')}</span>
        </div>
      ) : loadError ? (
        <div className="py-12 text-center text-destructive">
          {loadError}
        </div>
      ) : modelKeys.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-16">
          <Key size={48} className="mb-4 text-muted-foreground/50" />
          <h3 className="text-base font-semibold text-foreground">
            {t('settings.apiKeys.noModelKeys')}
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {t('settings.apiKeys.noModelKeysDesc')}
          </p>
          <Button className="mt-6" onClick={() => setAddDialogOpen(true)}>
            <Plus size={16} />
            {t('settings.apiKeys.addFirstKey')}
          </Button>
          <a
            href="https://docs.buildcrew.ai/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t('settings.apiKeys.quickGuide')}
            <ExternalLink size={12} />
          </a>
        </div>
      ) : (
        /* Card list */
        <div className="space-y-3">
          {modelKeys.map((mk) => {
            const isValidating = validatingIds.has(mk.id);
            const valError = validateErrors[mk.id];
            return (
              <div
                key={mk.id}
                className={`rounded-lg border bg-card p-4 transition-colors ${
                  mk.is_valid === false
                    ? 'border-destructive/50 hover:border-destructive'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {/* Provider icon */}
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${
                      mk.is_valid === false
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {getProviderIcon(mk.provider)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {getProviderLabel(mk.provider)}
                        </span>
                        {mk.is_default && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Star size={10} />
                            {t('settings.apiKeys.default')}
                          </Badge>
                        )}
                        {isValidating ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            {t('settings.apiKeys.validating', 'Validating...')}
                          </span>
                        ) : (
                          <span
                            className={`flex items-center gap-1 text-xs font-medium ${
                              mk.is_valid ? 'text-green-500' : 'text-destructive'
                            }`}
                          >
                            {mk.is_valid ? (
                              <>
                                <Shield size={12} />
                                {t('settings.apiKeys.valid')}
                              </>
                            ) : (
                              <>
                                <AlertTriangle size={12} />
                                {t('settings.apiKeys.invalid')}
                              </>
                            )}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{mk.display_name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{mk.key_masked}</p>
                      {mk.models.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {mk.models.map((m) => (
                            <Badge key={m} variant="secondary" className="text-[10px]">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('settings.apiKeys.monthlyUsage')}:{' '}
                        {mk.monthly_tokens.toLocaleString()} {t('settings.apiKeys.tokens')} / $
                        {mk.monthly_cost.toFixed(2)} {t('settings.apiKeys.cost')}
                      </p>
                      {/* Invalid key hint */}
                      {!mk.is_valid && !isValidating && (
                        <p className="mt-1 text-xs text-destructive">
                          {valError || t('settings.apiKeys.invalidHint', 'This key is invalid. Please check and re-add.')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isValidating}
                      onClick={() => void handleValidateKey(mk.id)}
                    >
                      {isValidating ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        t('settings.apiKeys.validate')
                      )}
                    </Button>
                    {!mk.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={defaultingId === mk.id}
                        onClick={() => void handleSetDefault(mk.id)}
                      >
                        {defaultingId === mk.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          t('settings.apiKeys.setDefault')
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleDeleteKey(mk.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modelKeys.length > 0 && (
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus size={16} />
          {t('settings.apiKeys.addApiKey')}
        </Button>
      )}

      {/* Add API Key Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.apiKeys.addApiKey')}</DialogTitle>
            <DialogDescription>
              {t('settings.apiKeys.modelKeysDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('settings.apiKeys.selectProvider')}</Label>
              <Select value={newProvider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('settings.apiKeys.selectProvider')} />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                          {getProviderIcon(p.value)}
                        </span>
                        {p.label}
                        {p.endpoint && (
                          <span className="text-[10px] text-muted-foreground">{p.endpoint}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.apiKeys.displayName')}</Label>
              <Input
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="My API Key"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.apiKeys.apiKey')}</Label>
              <div className="relative">
                <Input
                  type={showNewKey ? 'text' : 'password'}
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewKey(!showNewKey)}
                >
                  {showNewKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.apiKeys.endpoint')}</Label>
              <Input
                value={newEndpoint}
                onChange={(e) => setNewEndpoint(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
              {newProvider && newProvider !== 'custom' && (
                <p className="text-[10px] text-muted-foreground">
                  {t('settings.apiKeys.autoFilledEndpoint', 'Auto-filled for {{provider}}', {
                    provider: getProviderLabel(newProvider),
                  })}
                </p>
              )}
            </div>
            {addError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {addError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleAddKey()}
              disabled={!newProvider || !newDisplayName || !newApiKey || addLoading}
            >
              {addLoading ? t('common.loading') : t('settings.apiKeys.addKey')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Area 2: Platform API Keys (Collapsible) */}
      <Collapsible open={!platformCollapsed} onOpenChange={(open) => setPlatformCollapsed(!open)}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted">
            {platformCollapsed ? (
              <ChevronRight size={16} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={16} className="text-muted-foreground" />
            )}
            <span className="text-sm font-semibold text-foreground">
              {t('settings.apiKeys.platformKeys')}
            </span>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {platformKeys.length}
            </Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 space-y-4">
            {/* Platform keys table */}
            <div className="overflow-x-auto scrollbar-thin rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">{t('settings.apiKeys.tableHeaders.name')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('settings.apiKeys.tableHeaders.key')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('settings.apiKeys.tableHeaders.created')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('settings.apiKeys.tableHeaders.lastUsed')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('settings.apiKeys.tableHeaders.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {platformKeys.map((k) => (
                    <tr key={k.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{k.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {k.revealed ? k.key : maskKey(k.key)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{k.created}</td>
                      <td className="px-4 py-3 text-muted-foreground">{k.lastUsed}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => togglePlatformReveal(k.id)}>
                            {k.revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            {k.revealed ? t('settings.apiKeys.hide') : t('settings.apiKeys.reveal')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => revokePlatformKey(k.id)}
                          >
                            <Trash2 size={14} />
                            {t('settings.apiKeys.revoke')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {platformKeys.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {t('settings.apiKeys.noKeysYet')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Button onClick={createPlatformKey} variant="outline">
              <Plus size={16} />
              {t('settings.apiKeys.createNewKey')}
            </Button>

            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-yellow-500" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                {t('settings.apiKeys.securityWarning')}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscription Tab
// ---------------------------------------------------------------------------

function UsageMeter({ label, current, max }: { label: string; current: number; max: number }) {
  const percentage = Math.min(Math.round((current / max) * 100), 100);
  const isNearLimit = percentage >= 80;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${isNearLimit ? 'text-amber-500' : 'text-foreground'}`}>
          {current}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SubscriptionTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Toggle this to 'free' to see the Free plan UI
  const userPlan = 'pro' as 'free' | 'pro';

  const [invoices] = useState<Invoice[]>([
    { id: '1', date: 'Mar 1, 2026', amount: '$29.00', status: 'Paid' },
    { id: '2', date: 'Feb 1, 2026', amount: '$29.00', status: 'Paid' },
  ]);

  const featureKeys = [
    'settings.subscription.features.unlimitedAgents',
    'settings.subscription.features.plugins',
    'settings.subscription.features.smartRouter',
    'settings.subscription.features.guardianAdvanced',
    'settings.subscription.features.mobileApp',
    'settings.subscription.features.knowledgeHub',
  ] as const;

  if (userPlan === 'free') {
    return (
      <div className="space-y-8" data-testid="settings-subscription">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('settings.subscription.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('settings.subscription.subtitle')}</p>
        </div>

        <Separator />

        {/* Current Free plan card */}
        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-foreground">{t('settings.subscription.currentPlan')}</h3>
            <Badge variant="secondary">{t('settings.subscription.freePlan', 'Free')}</Badge>
          </div>
        </div>

        {/* Usage Meters */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{t('settings.subscription.usage', 'Usage')}</h3>
          <div className="rounded-lg border border-border p-6 space-y-4">
            <UsageMeter label={t('settings.subscription.meters.agents', 'Agents')} current={3} max={5} />
            <UsageMeter label={t('settings.subscription.meters.companies', 'Companies')} current={2} max={3} />
            <UsageMeter label={t('settings.subscription.meters.knowledge', 'Knowledge Entries')} current={32} max={50} />
            <UsageMeter label={t('settings.subscription.meters.chats', 'Chats Today')} current={14} max={20} />
          </div>
        </div>

        {/* Upgrade CTA */}
        <Button size="lg" className="w-full" onClick={() => navigate('/pricing')}>
          {t('settings.subscription.upgradeToPro', 'Upgrade to Pro')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="settings-subscription">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('settings.subscription.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.subscription.subtitle')}</p>
      </div>

      <Separator />

      {/* Current plan card */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-foreground">{t('settings.subscription.currentPlan')}</h3>
          <Badge>Pro</Badge>
        </div>

        <div className="space-y-1 text-sm">
          <p className="text-2xl font-bold text-foreground">$29<span className="text-sm font-normal text-muted-foreground">{t('settings.subscription.perMonth')}</span></p>
          <p className="text-muted-foreground">{t('settings.subscription.renewsOn', { date: 'April 1, 2026' })}</p>
          <p className="text-muted-foreground">{t('settings.subscription.paymentMethod', { last4: '4242' })}</p>
        </div>

        <Button variant="outline" size="sm">{t('settings.subscription.updatePayment')}</Button>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('settings.subscription.includedFeatures')}</h3>
        <ul className="grid gap-2">
          {featureKeys.map((fk) => (
            <li key={fk} className="flex items-center gap-2 text-sm">
              <Check size={16} className="text-green-500" />
              {t(fk)}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={() => navigate('/pricing')}>{t('settings.subscription.changePlan')}</Button>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          {t('settings.subscription.cancelSubscription')}
        </button>
      </div>

      <Separator />

      {/* Invoice history */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t('settings.subscription.invoiceHistory')}</h3>
        <div className="overflow-x-auto scrollbar-thin rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{t('settings.subscription.invoiceTableHeaders.date')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('settings.subscription.invoiceTableHeaders.amount')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('settings.subscription.invoiceTableHeaders.status')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('settings.subscription.invoiceTableHeaders.invoice')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{inv.date}</td>
                  <td className="px-4 py-3">{inv.amount}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-green-500">
                      <Check size={14} /> {t('settings.subscription.paid')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm">
                      <Download size={14} />
                      {t('settings.subscription.downloadPdf')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Appearance Tab
// ---------------------------------------------------------------------------

const ACCENT_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
] as const;

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'zh', label: '\u7B80\u4F53\u4E2D\u6587', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: 'ja', label: '\u65E5\u672C\u8A9E', flag: '\u{1F1EF}\u{1F1F5}' },
] as const;

function AppearanceTab() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('bc-theme') as Theme) || 'dark';
    }
    return 'dark';
  });
  const [accentColor] = useState('Blue');
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [showAgentAvatars, setShowAgentAvatars] = useState(true);

  useEffect(() => {
    localStorage.setItem('bc-theme', theme);
  }, [theme]);

  const themeOptions: { value: Theme; label: string; icon: typeof Moon; desc: string }[] = [
    { value: 'dark', label: t('settings.appearance.dark'), icon: Moon, desc: 'Dark theme' },
    { value: 'light', label: t('settings.appearance.light'), icon: Sun, desc: 'Light theme' },
    { value: 'system', label: t('settings.appearance.system'), icon: Monitor, desc: 'Follow system' },
  ];

  return (
    <div className="space-y-8" data-testid="settings-appearance">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('settings.appearance.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.appearance.subtitle')}</p>
      </div>

      <Separator />

      {/* Theme */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('settings.appearance.theme')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/50'
                }`}
              >
                <Icon size={24} />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Accent Color — Coming Soon */}
      <div className="space-y-3 opacity-50 pointer-events-none select-none">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t('settings.appearance.accentColor')}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t('common.comingSoon', 'Coming Soon')}</span>
        </div>
        <div className="flex gap-3">
          {ACCENT_COLORS.map((c) => {
            const isSelected = accentColor === c.name;
            return (
              <div
                key={c.name}
                title={c.name}
                className="relative flex h-8 w-8 items-center justify-center rounded-full grayscale"
                style={{ backgroundColor: c.value }}
              >
                {isSelected && <Check size={16} className="text-white" />}
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Language */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('settings.appearance.language')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => {
            const isSelected = normalizeLocale(i18n.language) === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => void i18n.changeLanguage(lang.code)}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/50'
                }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <span className="text-sm font-medium">{lang.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Sidebar options */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t('settings.appearance.sidebar')}</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t('settings.appearance.compactSidebar')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.appearance.compactSidebarDesc')}</p>
          </div>
          <Switch checked={compactSidebar} onCheckedChange={setCompactSidebar} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t('settings.appearance.showAgentAvatars')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.appearance.showAgentAvatarsDesc')}</p>
          </div>
          <Switch checked={showAgentAvatars} onCheckedChange={setShowAgentAvatars} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usage Tab (redirect to UsagePage)
// ---------------------------------------------------------------------------

function UsageTabRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    // This tab is handled inline, no redirect needed
  }, [navigate]);

  // Lazy import the usage page content
  const { t } = useTranslation();
  const [UsageContent, setUsageContent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    import('./UsagePage').then((mod) => {
      setUsageContent(() => mod.UsagePageContent);
    }).catch((err) => {
      console.error('Failed to lazy-load UsagePage:', err);
    });
  }, []);

  if (!UsageContent) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-3 text-sm text-muted-foreground">{t('common.loading')}</span>
      </div>
    );
  }

  return <UsageContent />;
}

// ---------------------------------------------------------------------------
// Main Settings page
// ---------------------------------------------------------------------------

export function Settings() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const activeTab: SettingsTab = (tabs.find((t) => t.id === tab)?.id) ?? 'profile';

  const renderContent = useCallback(() => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />;
      case 'api-keys':
        return <ApiKeysTab />;
      case 'usage':
        return <UsageTabRedirect />;
      case 'subscription':
        return <SubscriptionTab />;
      case 'appearance':
        return <AppearanceTab />;
      default:
        return <ProfileTab />;
    }
  }, [activeTab]);

  // Group tabs by section; hidden tabs are excluded from the sidebar
  const groups = [
    { label: t('settings.groups.account'), items: tabs.filter((t) => t.group === 'Account' && !t.hidden) },
    { label: t('settings.groups.preferences'), items: tabs.filter((t) => t.group === 'Preferences' && !t.hidden) },
  ];

  return (
    <PageContainer scroll={true}>
    <div className="mx-auto max-w-5xl" data-testid="settings-page">
      <h1 className="mb-6 text-2xl font-bold text-foreground">{t('settings.title')}</h1>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="flex w-60 shrink-0 flex-col gap-1">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((tabItem) => {
                const Icon = tabItem.icon;
                const isActive = tabItem.id === activeTab;
                return (
                  <button
                    key={tabItem.id}
                    data-testid={`settings-tab-${tabItem.id}`}
                    onClick={() => navigate(`/settings/${tabItem.id}`)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'border-l-2 border-primary bg-primary/10 text-primary'
                        : 'border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon size={18} />
                    {t(tabItem.labelKey)}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin rounded-xl border border-border bg-card p-6">
          {renderContent()}
        </div>
      </div>
    </div>
    </PageContainer>
  );
}
