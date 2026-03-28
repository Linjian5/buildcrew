import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Settings, Trash2, Power, ExternalLink, Code, Loader2, Puzzle, AlertCircle } from 'lucide-react';
import type { Plugin } from '../data/plugins';
import { PageContainer } from '../components/layout/PageContainer';

// TODO: Replace with real API call when plugins endpoint is available
async function getPlugins(): Promise<Plugin[]> {
  // No API endpoint yet — return empty
  return [];
}

export function Plugins() {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    getPlugins()
      .then(setPlugins)
      .catch((err) => {
        console.error('Failed to fetch plugins:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activePlugins = plugins.filter((p) => p.status === 'active');

  if (loading) {
    return (
      <PageContainer scroll={true}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer scroll={true}>
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90" onClick={fetchData}>
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer scroll={true}>
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2">{t('plugins.title')}</h1>
            <p className="text-[#94A3B8]">
              {t('plugins.subtitle', { total: plugins.length, active: activePlugins.length })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-muted text-muted-foreground border border-border rounded-lg hover:border-primary/50 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t('plugins.installFromUrl', 'Install from URL')}
            </button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              {t('plugins.browseMarket', 'Browse Plugin Market')}
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {plugins.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center mb-12">
          <Puzzle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-foreground">{t('empty.noPlugins')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('empty.noPluginsDesc')}</p>
        </div>
      )}

      {/* Installed Plugins Grid */}
      {plugins.length > 0 && (
        <div className="grid grid-cols-2 gap-6 mb-12">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className={`p-6 bg-[#13131A] border rounded-xl transition-all ${
                plugin.status === 'active'
                  ? 'border-[#10B981]/30 hover:border-[#10B981]/50'
                  : 'border-[#1E293B] hover:border-[#3B82F6]/50'
              }`}
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                {/* Icon */}
                <div className="w-12 h-12 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                  {plugin.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{plugin.name}</h3>
                    {plugin.isOfficial && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-[#3B82F6]/20 text-[#3B82F6] rounded-md">
                        {t('plugins.official', 'Official')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#94A3B8]">by {plugin.author}</p>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                  {plugin.status === 'active' ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                      <span className="text-xs font-medium text-[#10B981]">{t('plugins.active')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#6B7280]" />
                      <span className="text-xs font-medium text-[#6B7280]">{t('plugins.disabled')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-[#94A3B8] mb-4">{plugin.description}</p>

              {/* Activity Status */}
              {plugin.status === 'active' && plugin.lastActivity && (
                <div className="p-3 bg-[#0A0A0F] border border-[#1E293B] rounded-lg mb-4">
                  <p className="text-xs text-[#10B981]">{plugin.lastActivity}</p>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-[#1E293B]">
                <span className="text-xs text-[#3B82F6]">{t('plugins.version', { version: plugin.version })}</span>
                <div className="flex items-center gap-2">
                  {plugin.status === 'active' ? (
                    <>
                      <button className="px-3 py-1.5 text-xs font-medium text-[#3B82F6] border border-[#3B82F6] rounded-md hover:bg-[#3B82F6]/10 transition-colors flex items-center gap-1">
                        <Settings className="w-3 h-3" />
                        {t('plugins.configure')}
                      </button>
                      <button className="px-3 py-1.5 text-xs font-medium text-[#F59E0B] border border-[#F59E0B] rounded-md hover:bg-[#F59E0B]/10 transition-colors flex items-center gap-1">
                        <Power className="w-3 h-3" />
                        {t('plugins.disable')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="px-3 py-1.5 text-xs font-medium text-[#10B981] border border-[#10B981] rounded-md hover:bg-[#10B981]/10 transition-colors flex items-center gap-1">
                        <Power className="w-3 h-3" />
                        {t('plugins.enable')}
                      </button>
                      <button className="px-3 py-1.5 text-xs font-medium text-[#F43F5E] border border-[#F43F5E] rounded-md hover:bg-[#F43F5E]/10 transition-colors flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                        {t('plugins.remove')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plugin API Section */}
      <div className="p-8 bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/30 rounded-xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Code className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('plugins.pluginApi')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('plugins.pluginApiDescription', 'Build your own plugins — extend BuildCrew with custom integrations.')}
            </p>

            {/* Code Snippet */}
            <div className="p-4 bg-background border border-border rounded-lg mb-4 overflow-x-auto scrollbar-thin">
              <pre className="text-xs font-mono text-muted-foreground">
                <code>{`export default {
  name: "my-plugin",
  version: "1.0.0",
  onTaskCompleted(task) {
    // Your custom logic here
    console.log('Task completed:', task.id);
  },
  onAgentStatusChange(agent, status) {
    // Handle agent status changes
  }
}`}</code>
              </pre>
            </div>

            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
              {t('plugins.readDocs', 'Read Plugin Docs')}
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    </PageContainer>
  );
}
