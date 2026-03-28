import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { type TaskItem, type TaskStatus } from '../../data/tasks';
import { TaskCard } from '../TaskCard';

export interface KanbanColumnProps {
  id: TaskStatus;
  label: string;
  color: string;
  tasks: TaskItem[];
  isDragOver?: boolean;
  draggedTaskId?: number | null;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  onDragStart?: (task: TaskItem) => void;
  onTaskClick?: (task: TaskItem) => void;
}

export function KanbanColumn({
  id,
  label,
  color,
  tasks,
  isDragOver = false,
  draggedTaskId = null,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onTaskClick,
}: KanbanColumnProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex h-full min-w-[300px] flex-1 flex-col"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid={`kanban-column-${id}`}
    >
      {/* Column header — dot + label + count badge */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        </div>
        <span
          className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium"
          style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Separator line */}
      <div className="mb-4 h-px" style={{ backgroundColor: `${color}30` }} />

      {/* Task cards — scrollable */}
      <div
        className={`flex-1 space-y-3 overflow-y-auto scrollbar-thin pr-1 transition-colors ${
          isDragOver ? 'bg-primary/5 rounded-lg' : ''
        }`}
      >
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={() => onDragStart?.(task)}
            className={`transition-opacity ${draggedTaskId === task.id ? 'opacity-40' : ''}`}
          >
            <TaskCard task={task} onClick={() => onTaskClick?.(task)} />
          </div>
        ))}

        {tasks.length === 0 && !isDragOver && (
          <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            {t('common.noData', 'No tasks')}
          </div>
        )}

        {isDragOver && tasks.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm text-primary">
            Drop here
          </div>
        )}
      </div>

      {/* Add task button at bottom */}
      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
        <Plus className="h-4 w-4" />
        {t('tasks.addTask', 'Add Task')}
      </button>
    </div>
  );
}
