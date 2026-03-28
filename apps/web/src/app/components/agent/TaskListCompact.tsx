import { useTranslation } from 'react-i18next';
import { Check, Loader2, Clock } from 'lucide-react';


export interface CompactTask {
  id: string | number;
  title: string;
  status: 'completed' | 'active' | 'queued';
  duration?: string;
  cost?: string;
  progress?: number;
}

interface TaskListCompactProps {
  tasks: CompactTask[];
  maxItems?: number;
  className?: string;
}

export function TaskListCompact({ tasks, maxItems = 5, className }: TaskListCompactProps) {
  const { t } = useTranslation();
  const completedTasks = tasks.filter(tk => tk.status === 'completed').length;
  const totalTasks = tasks.length;
  const visibleTasks = tasks.slice(0, maxItems);

  return (
    <div data-testid="task-list-compact" className={`flex-1 overflow-hidden ${className ?? ''}`}>
      <div className="flex justify-between items-center mb-3 px-2">
        <span className="font-semibold text-sm text-foreground">{t('agents.detail.tasksThisSprint')}</span>
        <span className="text-xs text-muted-foreground">
          {completedTasks}/{totalTasks}
        </span>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[180px] px-2 scrollbar-thin">
        {visibleTasks.map((task) => (
          <div
            key={task.id}
            data-testid={`agent-task-${task.id}`}
            className={[
              'flex items-start gap-2 p-2 rounded-lg text-xs transition-colors',
              task.status === 'completed'
                ? 'bg-[#10B981]/10'
                : task.status === 'active'
                  ? 'bg-[#3B82F6]/10 border-l-2 border-[#3B82F6] animate-[active-task-glow_2s_ease-in-out_infinite]'
                  : 'bg-muted/30',
            ].join(' ')}
          >
            <div className="mt-0.5 flex-shrink-0">
              {task.status === 'completed' && <Check className="w-3.5 h-3.5 text-[#10B981]" />}
              {task.status === 'active' && <Loader2 className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />}
              {task.status === 'queued' && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-medium truncate text-foreground">{task.title}</div>
              {(task.duration || task.cost) && (
                <div className="text-muted-foreground mt-0.5">
                  {task.duration} · {task.cost}
                </div>
              )}
              {task.status === 'active' && task.progress != null && (
                <div className="mt-1.5 w-full h-1 bg-muted/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                </div>
              )}
              {task.status === 'queued' && (
                <div className="text-muted-foreground mt-0.5">{t('tasks.queued')}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
