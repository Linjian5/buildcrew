import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  testId?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  trendText,
  variant = 'default',
  testId,
}: StatCardProps) {
  const variantColors = {
    default: { bg: 'bg-card', border: 'border-border', icon: 'text-primary' },
    success: { bg: 'bg-card', border: 'border-[#10B981]/30', icon: 'text-[#10B981]' },
    warning: { bg: 'bg-card', border: 'border-[#F59E0B]/30', icon: 'text-[#F59E0B]' },
    danger: { bg: 'bg-card', border: 'border-[#F43F5E]/30', icon: 'text-[#F43F5E]' },
  };

  const colors = variantColors[variant];

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl p-6 hover:border-primary/30 transition-colors`} data-testid={testId}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Icon className={`w-5 h-5 ${colors.icon}`} />
            <span className="text-sm text-primary font-medium">{label}</span>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-bold text-foreground">{value}</div>
            {subtitle && (
              <div className="text-sm text-primary">{subtitle}</div>
            )}
            {trendText && (
              <div className={`text-xs font-medium ${
                trend === 'up' ? 'text-[#10B981]' :
                trend === 'down' ? 'text-[#F43F5E]' :
                'text-primary'
              }`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}