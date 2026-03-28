import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Filter, Brain, X, Loader2, BookOpen, Lock } from 'lucide-react';

import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import type { KnowledgeType } from '../data/knowledge';
import {
  getKnowledgeEntries,
  searchKnowledge,
  type KnowledgeEntry as ApiKnowledgeEntry,
} from '../../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { useCompany } from '../../contexts/CompanyContext';
import { UpgradePrompt } from '../components/common/UpgradePrompt';

// Toggle to 'free' to show plan restrictions
const userPlan = 'pro' as 'free' | 'pro';
const FREE_KNOWLEDGE_LIMIT = 50;

const knowledgeTypes = ['all', 'pattern', 'api-quirk', 'config', 'past-failure', 'adr'] as const;
type FilterType = (typeof knowledgeTypes)[number];

const typeFilterKeyMap: Record<string, string> = {
  all: 'knowledge.categories.all',
  pattern: 'knowledge.categories.pattern',
  'api-quirk': 'knowledge.categories.apiQuirk',
  config: 'knowledge.categories.config',
  'past-failure': 'knowledge.categories.pastFailure',
  adr: 'knowledge.categories.adr',
};

const typeKeyMap: Record<KnowledgeType, { key: string; fallback: string; color: string }> = {
  pattern: { key: 'knowledge.types.pattern', fallback: 'Pattern', color: '#3B82F6' },
  'api-quirk': { key: 'knowledge.types.apiQuirk', fallback: 'API Quirk', color: '#F59E0B' },
  config: { key: 'knowledge.types.config', fallback: 'Config', color: '#10B981' },
  'past-failure': { key: 'knowledge.types.pastFailure', fallback: 'Past Failure', color: '#F43F5E' },
  adr: { key: 'knowledge.types.adr', fallback: 'ADR', color: '#A855F7' },
};

// Map API type (underscored) to local display type (hyphenated)
function apiTypeToDisplay(apiType: string): KnowledgeType {
  const map: Record<string, KnowledgeType> = {
    pattern: 'pattern',
    api_quirk: 'api-quirk',
    config: 'config',
    past_failure: 'past-failure',
    adr: 'adr',
  };
  return map[apiType] ?? 'pattern';
}

// Map display type (hyphenated) to API type (underscored)
function displayTypeToApi(displayType: string): string {
  const map: Record<string, string> = {
    pattern: 'pattern',
    'api-quirk': 'api_quirk',
    config: 'config',
    'past-failure': 'past_failure',
    adr: 'adr',
  };
  return map[displayType] ?? displayType;
}

interface DisplayEntry {
  id: string;
  type: KnowledgeType;
  title: string;
  preview: string;
  source: string;
  tags: string[];
  confidence: number;
  cited: number;
}

function apiToDisplay(entry: ApiKnowledgeEntry): DisplayEntry {
  return {
    id: entry.id,
    type: apiTypeToDisplay(entry.type),
    title: entry.title,
    preview: entry.content,
    source: entry.source_agent_id ? `Agent ${entry.source_agent_id}` : 'System',
    tags: entry.tags,
    confidence: entry.confidence,
    cited: entry.citation_count,
  };
}

const ADD_ENTRY_TYPES: KnowledgeType[] = ['pattern', 'api-quirk', 'config', 'past-failure', 'adr'];

export function Knowledge() {
  const { currentCompanyId } = useCompany();
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Add entry form state
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<KnowledgeType>('pattern');
  const [newTags, setNewTags] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch entries on mount and when filter changes
  const fetchEntries = useCallback(async (typeFilter: FilterType) => {
    if (!currentCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = typeFilter !== 'all' ? { type: displayTypeToApi(typeFilter) } : undefined;
      const data = await getKnowledgeEntries(currentCompanyId, params);
      let mapped = data.map(apiToDisplay);
      if (typeFilter !== 'all') {
        mapped = mapped.filter((e) => e.type === typeFilter);
      }
      setEntries(mapped);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search with debounce
  const handleSearch = useCallback(
    (query: string) => {
      setSearch(query);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!query.trim()) {
        fetchEntries(activeFilter);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const data = await searchKnowledge(currentCompanyId, query);
          let mapped = data.map(apiToDisplay);
          if (activeFilter !== 'all') {
            mapped = mapped.filter((e) => e.type === activeFilter);
          }
          setEntries(mapped);
        } catch {
          setEntries([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [activeFilter, fetchEntries],
  );

  // Filter change handler
  const handleFilterChange = useCallback(
    (type: FilterType) => {
      setActiveFilter(type);
      if (search.trim()) {
        // Re-run search with new filter
        handleSearch(search);
      } else {
        fetchEntries(type);
      }
    },
    [search, handleSearch, fetchEntries],
  );

  useEffect(() => {
    fetchEntries('all');
  }, [fetchEntries]);

  const handleAddSubmit = () => {
    console.log('Add Knowledge Entry:', {
      title: newTitle,
      content: newContent,
      type: newType,
      tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setShowDialog(false);
    setNewTitle('');
    setNewContent('');
    setNewType('pattern');
    setNewTags('');
  };

  return (
    <PageContainer scroll={true}>
    <div data-testid="knowledge-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="mb-2">{t('knowledge.title')}</h1>
            <p className="text-[#94A3B8]">
              {t('knowledge.subtitle', { count: entries.length })}
            </p>
          </div>
          <button
            onClick={() => {
              if (userPlan === 'free' && entries.length >= FREE_KNOWLEDGE_LIMIT) {
                setUpgradeOpen(true);
              } else {
                setShowDialog(true);
              }
            }}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              userPlan === 'free' && entries.length >= FREE_KNOWLEDGE_LIMIT
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-[#3B82F6] text-white hover:bg-[#3B82F6]/90'
            }`}
          >
            <Plus className="w-4 h-4" />
            {t('knowledge.addEntry')}
            {userPlan === 'free' && (
              <span className="ml-1 text-xs opacity-75">
                {entries.length}/{FREE_KNOWLEDGE_LIMIT}
                {entries.length >= FREE_KNOWLEDGE_LIMIT && <Lock className="w-3 h-3 inline ml-1 text-amber-500" />}
              </span>
            )}
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Brain className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
            <input
              data-testid="knowledge-search"
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t('knowledge.searchPlaceholder')}
              className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button className="p-3 bg-[#13131A] border border-[#1E293B] rounded-lg text-[#94A3B8] hover:text-white hover:border-[#3B82F6]/50 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {knowledgeTypes.map((type) => (
            <button
              key={type}
              data-testid={`knowledge-filter-${type}`}
              onClick={() => handleFilterChange(type)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeFilter === type
                  ? 'bg-primary text-white'
                  : 'bg-card text-muted-foreground border border-border hover:border-primary/50'
              }`}
            >
              {t(typeFilterKeyMap[type]!, type)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          <span className="ml-3 text-[#94A3B8]">{t('knowledge.loading', 'Loading knowledge entries...')}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-foreground">{t('empty.noKnowledge')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('empty.noKnowledgeDesc')}</p>
        </div>
      )}

      {/* Masonry Grid */}
      {!loading && entries.length > 0 && (
        <ResponsiveMasonry columnsCountBreakPoints={{ 350: 1, 768: 2, 1200: 3 }}>
          <Masonry gutter="24px">
            {entries.map((entry) => {
              const typeInfo = typeKeyMap[entry.type];
              return (
                <div
                  key={entry.id}
                  data-testid={`knowledge-card-${entry.id}`}
                  className="p-5 bg-[#13131A] border border-[#1E293B] rounded-xl hover:border-[#3B82F6]/50 transition-all cursor-pointer group"
                >
                  {/* Type Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="px-2.5 py-1 text-xs font-semibold rounded-md"
                      style={{
                        backgroundColor: `${typeInfo.color}20`,
                        color: typeInfo.color,
                      }}
                    >
                      {t(typeInfo.key, typeInfo.fallback)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-white mb-2 group-hover:text-[#3B82F6] transition-colors">
                    {entry.title}
                  </h3>

                  {/* Preview */}
                  <p className="text-sm text-[#94A3B8] mb-4 line-clamp-3">{entry.preview}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs bg-[#1E1E2A] text-[#94A3B8] rounded border border-[#1E293B]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#1E293B]">
                    <p className="text-xs text-[#3B82F6]">{entry.source}</p>
                  </div>

                  {/* Confidence Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{t('knowledge.confidence')}</span>
                      <span className="text-xs font-semibold text-foreground">{entry.confidence}%</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${entry.confidence}%`,
                          backgroundColor:
                            entry.confidence >= 90
                              ? '#10B981'
                              : entry.confidence >= 70
                              ? '#3B82F6'
                              : '#F59E0B',
                        }}
                      />
                    </div>
                    <p className="text-xs text-accent mt-1">{t('knowledge.cited', { count: entry.cited })}</p>
                  </div>
                </div>
              );
            })}
          </Masonry>
        </ResponsiveMasonry>
      )}

      <UpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="knowledge"
        currentUsage={entries.length}
        limit={FREE_KNOWLEDGE_LIMIT}
      />

      {/* Add Entry Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#13131A] border border-[#1E293B] rounded-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{t('knowledge.addKnowledgeEntry', 'Add Knowledge Entry')}</h2>
              <button
                onClick={() => setShowDialog(false)}
                className="text-[#94A3B8] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm text-[#94A3B8] mb-1">{t('knowledge.form.title', 'Title')}</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('knowledge.form.titlePlaceholder', 'Knowledge entry title...')}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E293B] rounded-lg text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm text-[#94A3B8] mb-1">{t('knowledge.form.content', 'Content')}</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={t('knowledge.form.contentPlaceholder', 'Describe the knowledge...')}
                  rows={4}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E293B] rounded-lg text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#3B82F6] transition-colors resize-none"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm text-[#94A3B8] mb-1">{t('knowledge.form.type', 'Type')}</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as KnowledgeType)}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E293B] rounded-lg text-sm text-white focus:outline-none focus:border-[#3B82F6] transition-colors"
                >
                  {ADD_ENTRY_TYPES.map((typ) => (
                    <option key={typ} value={typ}>
                      {t(typeKeyMap[typ].key, typeKeyMap[typ].fallback)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm text-[#94A3B8] mb-1">{t('knowledge.form.tags', 'Tags (comma-separated)')}</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder={t('knowledge.form.tagsPlaceholder', 'auth, jwt, security')}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E293B] rounded-lg text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 text-sm text-[#94A3B8] hover:text-white transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddSubmit}
                className="px-4 py-2 bg-[#3B82F6] text-white text-sm rounded-lg hover:bg-[#3B82F6]/90 transition-colors"
              >
                {t('knowledge.addEntry')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageContainer>
  );
}
