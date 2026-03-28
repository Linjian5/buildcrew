import { useTranslation } from 'react-i18next';
import { type TaskItem } from '../data/tasks';
import { Clock, DollarSign, CheckCircle, Circle, AlertCircle, Flag, FileText } from 'lucide-react';
import { AgentAvatarVideo } from './agent/AgentAvatarVideo';


interface TaskCardProps {
  task: TaskItem;
  onClick?: () => void;
}

const priorityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-gray-500/10', text: 'text-gray-400' },
  medium: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  high: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  critical: { bg: 'bg-rose-500/10', text: 'text-rose-400' },
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { t } = useTranslation();
  const hasAgent = Boolean(task.agentId && task.agentName);
  const prio = priorityColors[task.priority] ?? priorityColors.medium!;

  // ── Backlog (+ Blocked) ──
  if (task.status === 'backlog') {
    const isBlocked = task.priority === 'critical' || !!task.blockedReason;
    return (
      <div
        data-testid={`task-card-${task.id}`}
        onClick={onClick}
        className={`rounded-xl border bg-card p-4 transition-colors cursor-pointer ${
          isBlocked ? 'border-destructive/40 hover:border-destructive' : 'border-border hover:border-primary/30'
        }`}
      >
        <div className="flex items-start gap-2 mb-2">
          <Flag className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isBlocked ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${prio.bg} ${prio.text}`}>
            {t(`tasks.priority.${task.priority}`)}
          </span>
          {isBlocked && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-destructive/10 text-destructive">
              {t('tasks.blocked', 'Blocked')}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground mb-1">{task.title}</p>
        {task.blockedReason && (
          <p className="text-xs text-destructive/80 mb-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {task.blockedReason}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span>{t('tasks.unassigned', 'Unassigned')}</span>
        </div>
      </div>
    );
  }

  // ── In Progress ──
  if (task.status === 'in-progress') {
    return (
      <div data-testid={`task-card-${task.id}`} onClick={onClick} className="rounded-xl border border-primary/20 bg-card p-4 transition-colors hover:border-primary/50 cursor-pointer">
        <div className="flex items-start gap-3 mb-3">
          {hasAgent && (
            <AgentAvatarVideo agentName={task.agentName!} department="engineering" status="working" size="sm" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{task.title}</p>
            {hasAgent && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
                <span className="text-xs font-medium text-secondary">{task.agentName}</span>
              </div>
            )}
            {task.goal && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{task.goal}</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {t('tasks.status.in-progress', 'In Progress')}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-3 h-1 w-full rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: '60%' }} />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {task.duration && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{task.duration}</span>
              </div>
            )}
            {task.cost && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>{task.cost}</span>
              </div>
            )}
          </div>
          <Flag className="h-3 w-3" />
        </div>
      </div>
    );
  }

  // ── In Review ──
  if (task.status === 'in-review') {
    return (
      <div data-testid={`task-card-${task.id}`} onClick={onClick} className="rounded-xl border border-[#A855F7]/20 bg-card p-4 transition-colors hover:border-[#A855F7]/50 cursor-pointer">
        <div className="flex items-start gap-3 mb-4">
          {hasAgent && (
            <AgentAvatarVideo agentName={task.agentName!} department="engineering" status="working" size="sm" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{task.title}</p>
            {hasAgent && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-[#A855F7]" />
                <span className="text-xs font-medium text-[#A855F7]">{task.agentName}</span>
              </div>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-500">
            {t('tasks.status.in-review', 'In Review')}
          </span>
        </div>

        {/* Review pipeline stages */}
        {task.reviewStatus && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
              {task.reviewStatus.autoCheck
                ? <CheckCircle className="h-3.5 w-3.5 text-secondary shrink-0" />
                : <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <span className={task.reviewStatus.autoCheck ? 'text-secondary' : 'text-muted-foreground'}>
                {t('review.stages.autoCheck')}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
              {task.reviewStatus.peerReview
                ? <CheckCircle className="h-3.5 w-3.5 text-secondary shrink-0" />
                : <AlertCircle className="h-3.5 w-3.5 text-accent shrink-0" />}
              <span className={task.reviewStatus.peerReview ? 'text-secondary' : 'text-accent'}>
                {t('review.stages.peerReview')}
              </span>
            </div>
            {task.reviewStatus.humanGate !== undefined && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
                {task.reviewStatus.humanGate
                  ? <CheckCircle className="h-3.5 w-3.5 text-secondary shrink-0" />
                  : <AlertCircle className="h-3.5 w-3.5 text-accent shrink-0" />}
                <span className={task.reviewStatus.humanGate ? 'text-secondary' : 'text-accent'}>
                  {t('review.stages.humanGate')} {!task.reviewStatus.humanGate && `(${t('tasks.awaitingApproval', 'Awaiting')})`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Approve / Reject */}
        {!task.reviewStatus?.humanGate && (
          <div className="flex gap-2">
            <button data-testid={`approve-btn-${task.id}`} className="flex-1 rounded-lg border border-secondary/30 py-2 text-xs font-medium text-secondary transition-colors hover:bg-secondary/10">
              {t('common.approve')}
            </button>
            <button data-testid={`reject-btn-${task.id}`} className="flex-1 rounded-lg border border-destructive/30 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10">
              {t('common.reject')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Done ──
  if (task.status === 'done') {
    return (
      <div data-testid={`task-card-${task.id}`} onClick={onClick} className="rounded-xl border border-border bg-card p-4 transition-opacity hover:opacity-100 cursor-pointer opacity-80">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground mb-1.5">{task.title}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {task.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{task.duration}</span>
                </div>
              )}
              {task.cost && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span>{task.cost}</span>
                </div>
              )}
              {task.score && (
                <span className="rounded-full border border-secondary/30 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                  {task.score}/100
                </span>
              )}
            </div>
            {task.completedAt && (
              <p className="text-xs text-muted-foreground mt-1.5">{task.completedAt}</p>
            )}
            {task.result && (
              <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{task.result.replace(/[#*`\n]/g, ' ').slice(0, 80)}{task.result.length > 80 ? '...' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
