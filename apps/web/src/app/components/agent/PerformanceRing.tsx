import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PerformanceRingProps {
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  size?: number;
  className?: string;
}

export function PerformanceRing({ score, trend, size = 56, className }: PerformanceRingProps) {
  const scoreColor =
    score >= 90 ? '#10B981' :
    score >= 70 ? '#3B82F6' :
    score >= 50 ? '#F59E0B' :
    '#F43F5E';

  const half = size / 2;
  const radius = half - 4; // 4px stroke clearance
  const circumference = 2 * Math.PI * radius;
  const dashLength = (score / 100) * circumference;

  return (
    <div data-testid="performance-ring" className={`flex flex-col items-center ${className ?? ''}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={half}
            cy={half}
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-muted"
          />
          <circle
            cx={half}
            cy={half}
            r={radius}
            stroke={scoreColor}
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${dashLength} ${circumference}`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="font-bold" style={{ fontSize: '16px', lineHeight: '1', color: scoreColor }}>
              {score}
            </div>
            <div className="text-muted-foreground" style={{ fontSize: '9px', lineHeight: '1' }}>
              /100
            </div>
          </div>
        </div>
      </div>
      <div className="mt-1">
        {trend === 'improving' && <TrendingUp className="w-3 h-3 text-[#10B981]" />}
        {trend === 'declining' && <TrendingDown className="w-3 h-3 text-[#F59E0B]" />}
        {trend === 'stable' && <Minus className="w-3 h-3 text-muted-foreground" />}
      </div>
    </div>
  );
}
