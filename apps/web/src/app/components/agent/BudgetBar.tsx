interface BudgetBarProps {
  spent: number;
  total: number;
  shimmer?: boolean;
  className?: string;
}

export function BudgetBar({ spent, total, shimmer: _shimmer = false, className }: BudgetBarProps) {
  const percentage = (spent / total) * 100;
  const pct = Math.min(percentage, 100);

  const color =
    percentage < 70 ? '#10B981' :
    percentage < 90 ? '#F59E0B' :
    '#F43F5E';

  return (
    <div data-testid="budget-bar" className={`px-2 mb-4 ${className ?? ''}`}>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">
          💰 ${spent.toFixed(1)} / ${total}
        </span>
        <span className="font-medium" style={{ color }}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
