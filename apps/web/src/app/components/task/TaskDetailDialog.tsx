import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { Clock, DollarSign, FileText, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { AgentAvatarVideo } from '../agent/AgentAvatarVideo';
import type { TaskItem } from '../../data/tasks';

const statusColors: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground',
  'in-progress': 'bg-primary/10 text-primary',
  'in-review': 'bg-purple-500/10 text-purple-500',
  done: 'bg-green-500/10 text-green-500',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500/10 text-gray-400',
  medium: 'bg-blue-500/10 text-blue-400',
  high: 'bg-amber-500/10 text-amber-400',
  critical: 'bg-rose-500/10 text-rose-400',
};

interface TaskDetailDialogProps {
  task: TaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const { t } = useTranslation();

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-lg">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Status & Priority */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusColors[task.status] ?? ''}>
              {t(`tasks.status.${task.status}`, task.status)}
            </Badge>
            <Badge className={priorityColors[task.priority] ?? ''}>
              {t(`tasks.priority.${task.priority}`, task.priority)}
            </Badge>
            {task.score != null && (
              <Badge variant="outline" className="border-green-500/30 text-green-500">
                {task.score}/100
              </Badge>
            )}
          </div>

          {/* Assigned Agent */}
          {task.agentName && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <AgentAvatarVideo
                agentName={task.agentName}
                department="engineering"
                status="working"
                size="sm"
                showRing={false}
              />
              <div>
                <p className="text-sm font-medium text-foreground">{task.agentName}</p>
                <p className="text-xs text-muted-foreground">{t('tasks.assignedAgent', 'Assigned Agent')}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('tasks.description', 'Description')}
              </h4>
              <p className="text-sm text-foreground leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {task.duration && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{task.duration}</span>
              </div>
            )}
            {task.cost && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                <span>{task.cost}</span>
              </div>
            )}
            {task.completedAt && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>{task.completedAt}</span>
              </div>
            )}
          </div>

          {/* Deliverable / Result */}
          {task.result && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {t('tasks.deliverable', 'Deliverable')}
              </h4>
              <div className="rounded-lg border border-border bg-muted/30 p-4 prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2">
                <Markdown>{task.result}</Markdown>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
