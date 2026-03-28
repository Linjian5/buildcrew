import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Agent, departmentColors } from '../data/agents';
import { AgentAvatarVideo } from './agent/AgentAvatarVideo';
import { PerformanceRing } from './agent/PerformanceRing';
import { BudgetBar } from './agent/BudgetBar';
import { TaskListCompact } from './agent/TaskListCompact';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  className?: string;
}

/**
 * Returns Tailwind/inline styles for the card border based on agent status.
 */
function getStatusBorderStyle(status: Agent['status']): {
  className: string;
  style: React.CSSProperties;
} {
  switch (status) {
    case 'working':
      return {
        className: 'animate-[status-pulse_2s_ease-in-out_infinite]',
        style: { '--pulse-color': '#10B981' } as React.CSSProperties,
      };
    case 'warning':
      return {
        className: '',
        style: { borderColor: 'rgba(245, 158, 11, 0.5)' },
      };
    case 'paused':
      return {
        className: 'opacity-80',
        style: {},
      };
    case 'error':
      return {
        className: 'animate-[status-pulse_1.5s_ease-in-out_infinite]',
        style: { '--pulse-color': '#F43F5E' } as React.CSSProperties,
      };
    default:
      return { className: '', style: {} };
  }
}

/** Map agent scoreTrend to PerformanceRing trend prop */
const trendMap = {
  up: 'improving',
  down: 'declining',
  stable: 'stable',
} as const;

export function AgentCard({ agent, onClick, className }: AgentCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deptColor = departmentColors[agent.department];
  const statusBorder = getStatusBorderStyle(agent.status);
  const isWorking = agent.status === 'working';

  return (
    <div
      data-testid={`agent-card-${agent.id}`}
      onClick={onClick}
      className={[
        'relative bg-card border border-border rounded-xl p-4 transition-all cursor-pointer group',
        statusBorder.className,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        minHeight: '520px',
        display: 'flex',
        flexDirection: 'column',
        ...statusBorder.style,
        // Hover glow handled via CSS custom property
        '--dept-color': deptColor,
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = deptColor;
        e.currentTarget.style.boxShadow = `0 0 12px ${deptColor}40`;
      }}
      onMouseLeave={(e) => {
        // Restore status-specific border or default
        if (agent.status === 'warning') {
          e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
        } else {
          e.currentTarget.style.borderColor = '';
        }
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Performance Score Ring - Top Right */}
      <div
        data-testid={`agent-score-${agent.id}`}
        className="absolute top-4 right-4"
      >
        <PerformanceRing
          score={agent.score}
          trend={trendMap[agent.scoreTrend]}
          size={56}
        />
      </div>

      {/* Avatar Section — double-click to chat */}
      <div className="flex flex-col items-center mt-8 mb-6">
        <div
          className="cursor-pointer"
          onDoubleClick={(e) => {
            e.stopPropagation();
            navigate(`/chat?agent=${agent.id}&name=${encodeURIComponent(agent.name)}`);
          }}
          title={t('chat.doubleClickToChat', 'Double-click to chat')}
        >
          <AgentAvatarVideo
            agentName={agent.name}
            department={agent.department}
            status={agent.status}
            size="lg"
          />
        </div>

        <h3 className="mt-4 font-bold text-foreground">{agent.name}</h3>

        {/* Department badge using departmentColors map */}
        <div className="flex items-center gap-2 mt-2">
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${deptColor}33`,
              color: deptColor,
            }}
          >
            {t(`roles.${agent.role}`, agent.role)}
          </span>
        </div>

        <div className="text-xs text-muted-foreground mt-1">
          {agent.runtime}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {Math.round(agent.budget.spent * 8.2)}K tokens &middot; ${agent.budget.spent.toFixed(2)}
        </div>

        <div className="flex items-center gap-2 mt-2 text-sm">
          <div
            className={`w-2 h-2 rounded-full ${
              agent.status === 'working' ? 'bg-[#10B981] animate-pulse' :
              agent.status === 'warning' ? 'bg-[#F59E0B] animate-pulse' :
              agent.status === 'error' ? 'bg-[#F43F5E] animate-pulse' :
              'bg-[#6B7280]'
            }`}
          />
          <span className="capitalize text-muted-foreground">{t(`agents.status.${agent.status}`)}</span>
        </div>
      </div>

      {/* Budget Bar */}
      <BudgetBar
        spent={agent.budget.spent}
        total={agent.budget.total}
        shimmer={isWorking}
        className="px-2 mb-4"
      />

      {/* Divider */}
      <div className="border-t border-border mb-3" />

      {/* Task List */}
      <TaskListCompact
        tasks={agent.tasks}
        maxItems={5}
      />
    </div>
  );
}
