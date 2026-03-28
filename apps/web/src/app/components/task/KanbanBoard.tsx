import { useState, useCallback } from 'react';
import { type TaskItem, type TaskStatus } from '../../data/tasks';
import { KanbanColumn } from './KanbanColumn';

export interface KanbanBoardProps {
  tasks: TaskItem[];
  onTaskMove?: (taskId: number, newStatus: TaskStatus) => void;
  onTaskClick?: (task: TaskItem) => void;
  className?: string;
}

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: '#94A3B8' },
  { id: 'in-progress', label: 'In Progress', color: '#3B82F6' },
  { id: 'in-review', label: 'In Review', color: '#A855F7' },
  { id: 'done', label: 'Done', color: '#10B981' },
];

export function KanbanBoard({ tasks, onTaskMove, onTaskClick, className }: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<TaskItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const getColumnTasks = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  const handleDragStart = useCallback((task: TaskItem) => {
    setDraggedTask(task);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (targetStatus: TaskStatus) => {
      if (draggedTask && draggedTask.status !== targetStatus) {
        onTaskMove?.(draggedTask.id, targetStatus);
      }
      setDraggedTask(null);
      setDragOverColumn(null);
    },
    [draggedTask, onTaskMove]
  );

  return (
    <div
      className={`flex h-full gap-6 overflow-x-auto pb-4 scrollbar-thin ${className ?? ''}`}
      data-testid="kanban-board"
    >
      {columns.map((col) => (
        <KanbanColumn
          key={col.id}
          id={col.id}
          label={col.label}
          color={col.color}
          tasks={getColumnTasks(col.id)}
          isDragOver={dragOverColumn === col.id}
          draggedTaskId={draggedTask?.id ?? null}
          onDragOver={(e) => handleDragOver(e, col.id)}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(col.id)}
          onDragStart={handleDragStart}
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  );
}
