import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, LayoutGrid, List, Calendar, Plus, ClipboardList, Loader2, AlertCircle } from 'lucide-react';
import type { TaskItem, TaskStatus } from '../data/tasks';
import { KanbanBoard } from '../components/task/KanbanBoard';
import { TaskDetailDialog } from '../components/task/TaskDetailDialog';
import { ReviewPanel } from '../components/review/ReviewPanel';
import { PageContainer } from '../components/layout/PageContainer';
import { getTasks, getAgents } from '../../lib/api';
import { toLocalTask } from '../../lib/adapters';
import { useCompany } from '../../contexts/CompanyContext';

type FilterType = 'all' | 'approvals' | 'blocked' | 'today';

export function Tasks() {
  const { t } = useTranslation();
  const { currentCompanyId } = useCompany();
  const [view, setView] = useState<'kanban' | 'list' | 'timeline'>('kanban');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [reviewTaskId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);

  const fetchTasks = useCallback(() => {
    if (!currentCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([getTasks(currentCompanyId), getAgents(currentCompanyId)])
      .then(([apiTasks, apiAgents]) => {
        const agentMap = new Map(apiAgents.map((a) => [a.id, a.name]));
        setTasks(apiTasks.map((t) => toLocalTask(t, agentMap.get(t.assigned_agent_id ?? '') ?? undefined)));
      })
      .catch((err) => {
        console.error('Failed to load tasks:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [currentCompanyId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = tasks.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.agentName?.toLowerCase().includes(q)) {
        return false;
      }
    }
    switch (filter) {
      case 'approvals':
        return t.status === 'in-review' && t.reviewStatus?.humanGate === false;
      case 'blocked':
        return t.priority === 'critical' && t.status === 'backlog';
      case 'today':
        return t.status === 'in-progress' || t.status === 'in-review';
      default:
        return true;
    }
  });

  const approvalCount = tasks.filter(
    (t) => t.status === 'in-review' && t.reviewStatus?.humanGate === false
  ).length;

  const handleTaskMove = useCallback((taskId: number, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
  }, []);

  if (loading) {
    return (
      <PageContainer scroll={false}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer scroll={false}>
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90" onClick={fetchTasks}>
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer scroll={false}>
    <div className="grid h-full grid-rows-[auto_1fr]" data-testid="tasks-page">
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="mb-2">{t('tasks.title')}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: t('tasks.filters.all') },
                  { id: 'approvals', label: t('tasks.filters.myApprovals'), count: approvalCount, countColor: 'text-primary' },
                  { id: 'blocked', label: t('tasks.filters.blocked'), count: 0, countColor: 'text-accent' },
                  { id: 'today', label: t('tasks.filters.today') },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  data-testid={`filter-${f.id}`}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === f.id
                      ? 'bg-primary text-white'
                      : 'border border-border bg-card text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {f.label}
                  {'count' in f && f.count ? (
                    <span className={`ml-1 ${f.countColor}`}>({f.count})</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {(
                [
                  { id: 'kanban', icon: LayoutGrid },
                  { id: 'list', icon: List },
                  { id: 'timeline', icon: Calendar },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  data-testid={`view-${v.id}`}
                  className={`rounded-md p-2 transition-colors ${
                    view === v.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={t(`tasks.views.${v.id}` as const, v.id.charAt(0).toUpperCase() + v.id.slice(1))}
                >
                  <v.icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('tasks.searchPlaceholder', 'Search...')}
                data-testid="task-search"
                className="rounded-lg border border-border bg-card py-2 pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                ⌘K
              </kbd>
            </div>

            <button
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              data-testid="task-filter-btn"
            >
              <Filter className="h-4 w-4" />
            </button>

            <button
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              data-testid="create-task-btn"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('tasks.newTask')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {tasks.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-foreground">{t('empty.noTasks')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('empty.noTasksDesc')}</p>
        </div>
      )}

      {/* Kanban Board */}
      {tasks.length > 0 && (
        <div className="min-h-0">
        {view === 'kanban' && (
          <KanbanBoard tasks={filteredTasks} onTaskMove={handleTaskMove} onTaskClick={setDetailTask} className="h-full" />
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="space-y-2" data-testid="list-view">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      task.status === 'done'
                        ? '#10B981'
                        : task.status === 'in-review'
                          ? '#A855F7'
                          : task.status === 'in-progress'
                            ? '#3B82F6'
                            : '#94A3B8',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.agentName ?? t('tasks.unassigned', 'Unassigned')} · {task.status.replace('-', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {task.duration && <span>{task.duration}</span>}
                  {task.cost && <span>{task.cost}</span>}
                  {task.score && <span>{t('tasks.score', { score: task.score })}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Timeline View Placeholder */}
        {view === 'timeline' && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">{t('tasks.timelineComingSoon', 'Timeline view coming soon')}</p>
          </div>
        )}

        </div>
      )}

      {/* Review Panel (slide-over) */}
      <ReviewPanel
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        taskId={reviewTaskId}
        companyId={currentCompanyId}
        onAction={() => {
          // TODO: refetch tasks after review action
        }}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={detailTask}
        open={!!detailTask}
        onOpenChange={(open) => { if (!open) setDetailTask(null); }}
      />
    </div>
    </PageContainer>
  );
}
