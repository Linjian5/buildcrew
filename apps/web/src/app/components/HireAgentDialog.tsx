"use client";

import * as React from "react";
import {
  Monitor,

  Server,
  Shield,
  Container,
  Palette,
  PenTool,
  Megaphone,
  Crown,
  Briefcase,
  Check,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import { AgentAvatarVideo } from "./agent/AgentAvatarVideo";
import { type Department, departmentColors } from "../data/agents";
import { getModelApiKeys, type ModelApiKey } from "../../lib/api";
import { useTranslation } from "react-i18next";

// ── Types ──────────────────────────────────────────────────────────────────

export interface HireAgentConfig {
  templateId: string | null;
  name: string;
  title: string;
  department: Department;
  aiModel: string;
  monthlyBudget: number;
  heartbeatInterval: number;
  maxConcurrentTasks: number;
}

interface HireAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the config. Should call the API and throw on error. */
  onHire: (agentConfig: HireAgentConfig) => Promise<void>;
}

// ── Role Templates ─────────────────────────────────────────────────────────

interface RoleTemplate {
  id: string;
  titleKey: string;
  descKey: string;
  department: Department;
  icon: React.ElementType;
  defaultBudget: number;
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "cto",
    titleKey: "hire.roles.cto",
    descKey: "hire.roles.ctoDesc",
    department: "executive",
    icon: Crown,
    defaultBudget: 80,
  },
  {
    id: "ceo",
    titleKey: "hire.roles.ceo",
    descKey: "hire.roles.ceoDesc",
    department: "executive",
    icon: Briefcase,
    defaultBudget: 90,
  },
  {
    id: "frontend",
    titleKey: "hire.roles.frontend",
    descKey: "hire.roles.frontendDesc",
    department: "engineering",
    icon: Monitor,
    defaultBudget: 50,
  },
  {
    id: "backend",
    titleKey: "hire.roles.backend",
    descKey: "hire.roles.backendDesc",
    department: "engineering",
    icon: Server,
    defaultBudget: 50,
  },
  {
    id: "qa",
    titleKey: "hire.roles.qa",
    descKey: "hire.roles.qaDesc",
    department: "qa",
    icon: Shield,
    defaultBudget: 30,
  },
  {
    id: "devops",
    titleKey: "hire.roles.devops",
    descKey: "hire.roles.devopsDesc",
    department: "devops",
    icon: Container,
    defaultBudget: 25,
  },
  {
    id: "designer",
    titleKey: "hire.roles.designer",
    descKey: "hire.roles.designerDesc",
    department: "design",
    icon: Palette,
    defaultBudget: 40,
  },
  {
    id: "content",
    titleKey: "hire.roles.content",
    descKey: "hire.roles.contentDesc",
    department: "content",
    icon: PenTool,
    defaultBudget: 25,
  },
  {
    id: "marketing",
    titleKey: "hire.roles.marketing",
    descKey: "hire.roles.marketingDesc",
    department: "marketing",
    icon: Megaphone,
    defaultBudget: 30,
  },
];

// ── Provider → Model mapping ────────────────────────────────────────────

interface ModelOption {
  value: string;
  label: string;
  recommended?: boolean;
}

const PROVIDER_MODELS: Record<string, ModelOption[]> = {
  anthropic: [
    { value: "claude-opus-4", label: "claude-opus-4", recommended: true },
    { value: "claude-sonnet-4", label: "claude-sonnet-4" },
    { value: "claude-haiku-4", label: "claude-haiku-4" },
  ],
  openai: [
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "deepseek-chat" },
    { value: "deepseek-coder", label: "deepseek-coder" },
  ],
  custom: [],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  custom: "Custom",
};

// Cost per 1K tokens for budget estimation
const MODEL_COST_PER_1K: Record<string, number> = {
  "claude-opus-4": 0.015,
  "claude-sonnet-4": 0.003,
  "claude-haiku-4": 0.001,
  "gpt-4o": 0.005,
  "gpt-4o-mini": 0.001,
  "deepseek-chat": 0.001,
  "deepseek-coder": 0.001,
};

function estimateRequestsPerMonth(budget: number, model: string): number {
  const costPer1k = MODEL_COST_PER_1K[model] ?? 0.003;
  return Math.round((budget / costPer1k) * (1000 / 1500));
}

const HEARTBEAT_OPTIONS = [
  { value: "60", label: "60s" },
  { value: "120", label: "120s" },
  { value: "300", label: "300s" },
  { value: "600", label: "600s" },
];

const CONCURRENT_TASK_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
];

const DEPARTMENT_KEYS: Department[] = [
  "engineering", "design", "marketing", "qa", "devops", "content", "executive",
];

// ── Helper to generate a default agent name ────────────────────────────────

function generateAgentName(templateId: string | null): string {
  if (!templateId) return "";
  const names: Record<string, string> = {
    cto: "Atlas",
    ceo: "Prime",
    frontend: "Nova",
    backend: "Echo",
    qa: "Sentinel",
    devops: "Vector",
    designer: "Pixel",
    content: "Sage",
    marketing: "Scout",
  };
  return names[templateId] ?? "";
}

// ── Component ──────────────────────────────────────────────────────────────

export function HireAgentDialog({
  open,
  onOpenChange,
  onHire,
}: HireAgentDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [selectedTemplate, setSelectedTemplate] = React.useState<string | null>(
    null
  );

  // Form state
  const [agentName, setAgentName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [department, setDepartment] = React.useState<Department>("engineering");
  const [selectedProvider, setSelectedProvider] = React.useState("");
  const [aiModel, setAiModel] = React.useState("");
  const [customModelName, setCustomModelName] = React.useState("");
  const [monthlyBudget, setMonthlyBudget] = React.useState(50);
  const [heartbeatInterval, setHeartbeatInterval] = React.useState("120");
  const [maxConcurrentTasks, setMaxConcurrentTasks] = React.useState("1");

  // API keys state
  const [apiKeys, setApiKeys] = React.useState<ModelApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = React.useState(false);

  // Load API keys when dialog opens
  React.useEffect(() => {
    if (open) {
      setApiKeysLoading(true);
      getModelApiKeys()
        .then((keys) => setApiKeys(keys))
        .catch((err) => { console.error('Failed to load API keys:', err); setApiKeys([]); })
        .finally(() => setApiKeysLoading(false));
    }
  }, [open]);

  // Available providers = only those with configured keys
  const availableProviders = React.useMemo(() => {
    const providerSet = new Set(apiKeys.map((k) => k.provider));
    return Array.from(providerSet);
  }, [apiKeys]);

  // Models for the selected provider
  const modelsForProvider = React.useMemo(() => {
    if (!selectedProvider) return [];
    return PROVIDER_MODELS[selectedProvider] ?? [];
  }, [selectedProvider]);

  // The effective model name (for custom provider, use text input)
  const effectiveModel =
    selectedProvider === "custom" ? customModelName : aiModel;

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedTemplate(null);
      setAgentName("");
      setTitle("");
      setDepartment("engineering");
      setSelectedProvider("");
      setAiModel("");
      setCustomModelName("");
      setMonthlyBudget(50);
      setHeartbeatInterval("120");
      setMaxConcurrentTasks("1");
    }
  }, [open]);

  // When provider changes, auto-select first model (or clear)
  React.useEffect(() => {
    if (selectedProvider === "custom") {
      setAiModel("");
      return;
    }
    const models = PROVIDER_MODELS[selectedProvider] ?? [];
    const recommended = models.find((m) => m.recommended);
    setAiModel(recommended?.value ?? models[0]?.value ?? "");
  }, [selectedProvider]);

  // Apply template defaults when a template is selected and user advances
  function applyTemplate(templateId: string | null) {
    if (!templateId) return;
    const tmpl = ROLE_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    setAgentName(generateAgentName(templateId));
    setTitle(t(tmpl.titleKey));
    setDepartment(tmpl.department);
    setMonthlyBudget(tmpl.defaultBudget);
  }

  function handleNext() {
    if (step === 1) {
      applyTemplate(selectedTemplate);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  }

  function handleBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  const [hiring, setHiring] = React.useState(false);
  const [hireError, setHireError] = React.useState<string | null>(null);

  async function handleHire() {
    setHiring(true);
    setHireError(null);
    try {
      await onHire({
        templateId: selectedTemplate,
        name: agentName,
        title,
        department,
        aiModel: effectiveModel,
        monthlyBudget,
        heartbeatInterval: Number(heartbeatInterval),
        maxConcurrentTasks: Number(maxConcurrentTasks),
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Hire agent failed:', err);
      setHireError(err instanceof Error ? err.message : String(err));
    } finally {
      setHiring(false);
    }
  }

  const template = selectedTemplate
    ? ROLE_TEMPLATES.find((t) => t.id === selectedTemplate) ?? null
    : null;

  const stepTitles: Record<1 | 2 | 3, string> = {
    1: t('agents.hire.step1'),
    2: t('agents.hire.step2'),
    3: t('agents.hire.step3'),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="hire-agent-dialog"
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <UserPlus className="size-5" />
            <span>{t('agents.hire.title')}</span>
            <span className="text-muted-foreground text-sm font-normal">
              — Step {step} of 3: {stepTitles[step]}
            </span>
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex gap-2 pt-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              >
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* ── Step 1: Choose Role Template ── */}
        {step === 1 && (
          <div data-testid="hire-step-1" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {ROLE_TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const isSelected = selectedTemplate === tmpl.id;
                const deptColor = departmentColors[tmpl.department];
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`relative flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:bg-accent/50 ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-blue-500 text-white">
                        <Check className="size-3" />
                      </div>
                    )}
                    <div
                      className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: `${deptColor}20`,
                        color: deptColor,
                      }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {t(tmpl.titleKey)}
                        </span>
                        <div
                          className="size-2 rounded-full"
                          style={{ backgroundColor: deptColor }}
                        />
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                        {t(tmpl.descKey)}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Custom Role option */}
              <button
                type="button"
                onClick={() => setSelectedTemplate("custom")}
                className={`relative flex items-start gap-3 rounded-lg border border-dashed p-3 text-left transition-all hover:bg-accent/50 ${
                  selectedTemplate === "custom"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border"
                }`}
              >
                {selectedTemplate === "custom" && (
                  <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-blue-500 text-white">
                    <Check className="size-3" />
                  </div>
                )}
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Sparkles className="size-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">{t('agents.hire.customRole', 'Custom Role')}</span>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    Define a custom role from scratch
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Configure Agent ── */}
        {step === 2 && (
          <div data-testid="hire-step-2" className="space-y-5">
            {/* Agent Name */}
            <div className="space-y-2">
              <Label htmlFor="agent-name">{t('agents.hire.agentName', 'Agent Name')}</Label>
              <Input
                id="agent-name"
                placeholder={
                  selectedTemplate && selectedTemplate !== "custom"
                    ? `e.g. ${generateAgentName(selectedTemplate)}`
                    : "Enter agent name"
                }
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="agent-title">{t('agents.hire.title', 'Title')}</Label>
              <Input
                id="agent-title"
                placeholder="e.g. Senior Frontend Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label>{t('agents.hire.department', 'Department')}</Label>
              <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_KEYS.map((d) => (
                    <SelectItem key={d} value={d}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{
                            backgroundColor: departmentColors[d],
                          }}
                        />
                        {t(`departments.${d}`)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Provider & Model */}
            {apiKeysLoading ? (
              <div className="space-y-2">
                <Label>{t("settings.apiKeys.provider")}</Label>
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              </div>
            ) : availableProviders.length === 0 ? (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="size-4 text-yellow-500" />
                  {t("agents.hire.noKeysWarning", "\u26A0\uFE0F Please configure AI model API keys in Settings first")}
                </p>
                <a
                  href="/settings/api-keys"
                  className="text-sm text-blue-500 hover:underline inline-flex items-center gap-1"
                >
                  {t("agents.hire.goToSettings", "Go to Settings \u2192")}
                </a>
              </div>
            ) : (
              <>
                {/* Provider dropdown */}
                <div className="space-y-2">
                  <Label>{t("settings.apiKeys.provider")}</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("agents.hire.selectProvider", "Select provider...")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProviders.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PROVIDER_LABELS[p] ?? p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Model dropdown (or text input for custom) */}
                {selectedProvider && selectedProvider !== "custom" && (
                  <div className="space-y-2">
                    <Label>{t("agents.detail.model", "Model")}</Label>
                    <Select value={aiModel} onValueChange={setAiModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modelsForProvider.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                            {m.recommended ? " \u2B50 Recommended" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedProvider === "custom" && (
                  <div className="space-y-2">
                    <Label>{t("agents.detail.model", "Model")}</Label>
                    <Input
                      placeholder={t("agents.hire.customModelPlaceholder", "Enter model name...")}
                      value={customModelName}
                      onChange={(e) => setCustomModelName(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {/* Monthly Budget */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("onboarding.monthlyBudget", "Monthly Budget")}</Label>
                <span className="text-muted-foreground text-sm">
                  ${monthlyBudget}
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[monthlyBudget]}
                onValueChange={(v) => setMonthlyBudget(v[0] ?? 0)}
              />
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>$0</span>
                <span>$100</span>
              </div>
              {effectiveModel && MODEL_COST_PER_1K[effectiveModel] != null && (
                <p className="text-xs text-muted-foreground">
                  ~{estimateRequestsPerMonth(monthlyBudget, effectiveModel)}{" "}
                  {t("agents.hire.requestsPerMonth", "requests/month with {{model}}", { model: effectiveModel })}
                </p>
              )}
            </div>

            {/* Heartbeat Interval */}
            <div className="space-y-2">
              <Label>{t('agents.hire.heartbeatInterval', 'Heartbeat Interval')}</Label>
              <Select
                value={heartbeatInterval}
                onValueChange={setHeartbeatInterval}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEARTBEAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Concurrent Tasks */}
            <div className="space-y-2">
              <Label>{t('agents.hire.maxConcurrentTasks', 'Max Concurrent Tasks')}</Label>
              <Select
                value={maxConcurrentTasks}
                onValueChange={setMaxConcurrentTasks}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONCURRENT_TASK_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Confirm ── */}
        {step === 3 && (
          <div data-testid="hire-step-3" className="space-y-6">
            {/* Agent preview */}
            <div className="flex items-center gap-4">
              <AgentAvatarVideo
                agentName={agentName || "??"}
                department={department}
                status="idle"
                size="lg"
                showRing
              />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {agentName || "Unnamed Agent"}
                </h3>
                <p className="text-muted-foreground text-sm">{title || "No title"}</p>
                <Badge
                  variant="outline"
                  className="mt-1"
                  style={{
                    borderColor: departmentColors[department],
                    color: departmentColors[department],
                  }}
                >
                  {t(`departments.${department}`, department)}
                </Badge>
              </div>
            </div>

            {/* Summary card */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('agents.hire.step3', 'Configuration Summary')}
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <SummaryRow label={t('agents.hire.step1', 'Template')} value={template ? t(template.titleKey) : t('agents.hire.customRole', 'Custom')} />
                <SummaryRow label={t('auth.name', 'Name')} value={agentName || "—"} />
                <SummaryRow label={t('agents.hire.title', 'Title')} value={title || "—"} />
                <SummaryRow
                  label={t('agents.hire.department', 'Department')}
                  value={t(`departments.${department}`, department)}
                />
                <SummaryRow
                  label={t("agents.detail.model", "Model")}
                  value={
                    selectedProvider
                      ? `${PROVIDER_LABELS[selectedProvider] ?? selectedProvider} / ${effectiveModel || "—"}`
                      : "—"
                  }
                />
                <SummaryRow label={t('onboarding.monthlyBudget', 'Monthly Budget')} value={`$${monthlyBudget}`} />
                <SummaryRow
                  label={t('agents.hire.heartbeatInterval', 'Heartbeat')}
                  value={`${heartbeatInterval}s`}
                />
                <SummaryRow
                  label={t('agents.hire.maxConcurrentTasks', 'Max Tasks')}
                  value={maxConcurrentTasks}
                />
              </div>
            </div>

            {/* Error from hire attempt */}
            {hireError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-destructive">
                  <AlertTriangle className="size-4" />
                  {t('agents.hire.failed', 'Failed to hire agent')}
                </p>
                <p className="mt-1 text-destructive/80">{hireError}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={hiring}>
              <ChevronLeft className="size-4" />
              {t('common.back')}
            </Button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={step === 1 && selectedTemplate === null}
            >
              {t('common.next')}
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={() => void handleHire()} disabled={!agentName.trim() || hiring}>
              {hiring ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {hiring ? t('common.loading') : t('agents.hire.hireAgent', 'Hire Agent')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Small helper for the summary rows ──────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </>
  );
}
