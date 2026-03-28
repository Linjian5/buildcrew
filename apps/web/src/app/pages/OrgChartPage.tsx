import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut, Loader2, Users, AlertCircle } from 'lucide-react';
import { departmentColors, type Department, type AgentStatus } from '../data/agents';
import type { Agent } from '../data/agents';
import { AgentAvatarVideo } from '../components/agent/AgentAvatarVideo';
import { PageContainer } from '../components/layout/PageContainer';
import { getAgents } from '../../lib/api';
import { toLocalAgent } from '../../lib/adapters';
import { useCompany } from '../../contexts/CompanyContext';

/* ---------------------------------------------------------------------------
 * Tree data types & builder
 * -------------------------------------------------------------------------*/
interface OrgTreeNode {
  id: string;
  name: string;
  role: string;
  department: Department;
  status: AgentStatus;
  children: OrgTreeNode[];
}

// Build tree from agents data: first agent is root, others are children
function buildOrgTree(agents: Agent[]): OrgTreeNode | null {
  if (agents.length === 0) return null;

  function toNode(agent: Agent, children: OrgTreeNode[] = []): OrgTreeNode {
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      department: agent.department,
      status: agent.status,
      children,
    };
  }

  const root = agents[0]!;
  const children = agents.slice(1).map((a) => toNode(a));
  return toNode(root, children);
}

const STATUS_COLORS: Record<string, string> = {
  working: '#10B981',
  idle: '#6B7280',
  paused: '#6B7280',
  warning: '#F59E0B',
  error: '#F43F5E',
};

/* ---------------------------------------------------------------------------
 * Mini card node
 * -------------------------------------------------------------------------*/
function OrgNode({
  node,
  selected,
  onClick,
  onDoubleClick,
}: {
  node: OrgTreeNode;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const { t } = useTranslation();
  const deptColor = departmentColors[node.department] ?? '#6B7280';
  const statusColor = STATUS_COLORS[node.status] ?? '#6B7280';
  const isWorking = node.status === 'working';

  return (
    <button
      data-testid={`org-node-${node.id}`}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 shadow-sm transition-all duration-200 hover:scale-105 text-left ${
        selected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border bg-card'
      }`}
      style={{ borderTopColor: deptColor, borderTopWidth: 2 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 16px ${deptColor}40`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
    >
      <div className="relative">
        <AgentAvatarVideo
          agentName={node.name}
          department={node.department}
          status={node.status}
          size="sm"
          showRing={false}
        />
        {isWorking && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: statusColor }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">{node.name}</span>
          {!isWorking && (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
          )}
        </div>
        <div className="text-xs text-muted-foreground">{t(`roles.${node.role}`, node.role)}</div>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Connecting lines between parent and children using CSS borders
 * -------------------------------------------------------------------------*/
function TreeBranch({
  node,
  selectedId,
  onNodeClick,
  onNodeDoubleClick,
}: {
  node: OrgTreeNode;
  selectedId?: string | null;
  onNodeClick?: (node: OrgTreeNode) => void;
  onNodeDoubleClick?: (node: OrgTreeNode) => void;
}) {
  const deptColor = departmentColors[node.department] ?? '#6B7280';

  if (node.children.length === 0) {
    return (
      <OrgNode
        node={node}
        selected={selectedId === node.id}
        onClick={() => onNodeClick?.(node)}
        onDoubleClick={() => onNodeDoubleClick?.(node)}
      />
    );
  }

  return (
    <div className="flex flex-col items-center">
      <OrgNode
        node={node}
        selected={selectedId === node.id}
        onClick={() => onNodeClick?.(node)}
        onDoubleClick={() => onNodeDoubleClick?.(node)}
      />
      {/* Vertical line down from parent */}
      <div className="h-6 w-px" style={{ backgroundColor: deptColor }} />
      {/* Horizontal connector bar */}
      <div
        className="h-px self-stretch"
        style={{
          backgroundColor: deptColor,
          marginLeft: node.children.length > 1 ? `${100 / (node.children.length * 2)}%` : '50%',
          marginRight: node.children.length > 1 ? `${100 / (node.children.length * 2)}%` : '50%',
        }}
      />
      {/* Children row */}
      <div className="flex items-start justify-evenly gap-6 w-full">
        {node.children.map((child) => (
          <div key={child.id} className="flex flex-col items-center">
            {/* Vertical line down to child */}
            <div
              className="h-6 w-px"
              style={{ backgroundColor: departmentColors[child.department] ?? '#6B7280' }}
            />
            <TreeBranch node={child} selectedId={selectedId} onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Main Page
 * -------------------------------------------------------------------------*/
export function OrgChartPage() {
  const { currentCompanyId } = useCompany();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(() => {
    if (!currentCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getAgents(currentCompanyId)
      .then((data) => setAgents(data.map(toLocalAgent)))
      .catch((err) => {
        console.error('Failed to fetch agents:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [currentCompanyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const orgTree = useMemo(() => buildOrgTree(agents), [agents]);

  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of agents) {
      counts[a.department] = (counts[a.department] ?? 0) + 1;
    }
    return counts;
  }, [agents]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of agents) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, [agents]);

  const uniqueDepts = Object.keys(deptCounts);
  const selectedAgent = agents.find((a) => a.id === selectedNodeId) ?? null;

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.1, 2)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.1, 0.3)), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => {
        const next = z + (e.deltaY < 0 ? 0.05 : -0.05);
        return Math.min(2, Math.max(0.3, next));
      });
    }
  }, []);

  if (loading) {
    return (
      <PageContainer className="flex items-center justify-center" data-testid="org-chart-page">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="flex items-center justify-center" data-testid="org-chart-page">
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90" onClick={fetchData}>
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </PageContainer>
    );
  }

  if (agents.length === 0) {
    return (
      <PageContainer className="flex flex-col items-center justify-center" data-testid="org-chart-page">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-foreground">{t('empty.noOrgChart')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('empty.noOrgChartDesc')}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="relative flex" data-testid="org-chart-page">
      {/* Main area — tree fills the viewport */}
      <div className="flex-1 h-full relative flex flex-col min-w-0">
        {/* Zoom controls — positioned absolute top-right */}
        <div className="absolute top-0 right-0 z-20 flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-sm text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Header */}
        <div className="mb-3 shrink-0">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{t('orgChart.title', 'Organization Chart')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('orgChart.subtitle', { agents: agents.length, departments: uniqueDepts.length })}
          </p>
        </div>

        {/* Zoomable tree — fills remaining minus office placeholder */}
        <div
          ref={containerRef}
          className="overflow-auto scrollbar-thin rounded-xl border border-border bg-card p-4 min-h-0 mb-3"
          style={{ maxHeight: 'calc(100% - 240px)' }}
          onWheel={handleWheel}
        >
          <div
            className="inline-flex min-w-full justify-center transition-transform duration-150"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            {orgTree && (
              <TreeBranch
                node={orgTree}
                selectedId={selectedNodeId}
                onNodeClick={(node) => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
                onNodeDoubleClick={(node) => navigate(`/chat?agent=${node.id}&name=${encodeURIComponent(node.name)}`)}
              />
            )}
          </div>
        </div>

        {/* Selected agent info */}
        {selectedAgent && (
          <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-4">
            <AgentAvatarVideo agentName={selectedAgent.name} department={selectedAgent.department} status={selectedAgent.status} size="sm" showRing={false} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{selectedAgent.name}</span>
                <span className="text-xs capitalize text-muted-foreground">{selectedAgent.status}</span>
              </div>
              <div className="text-xs text-muted-foreground">{t(`roles.${selectedAgent.role}`, selectedAgent.role)} · {t(`departments.${selectedAgent.department}`, selectedAgent.department)}</div>
            </div>
            <button
              className="shrink-0 text-xs text-primary hover:underline"
              onClick={() => navigate(`/chat?agent=${selectedAgent.id}&name=${encodeURIComponent(selectedAgent.name)}`)}
            >
              {t('overview.viewChat', 'View Chat')} →
            </button>
          </div>
        )}

        {/* Office View Placeholder — inside main column */}
        <div className="shrink-0 h-[180px] rounded-xl border border-border bg-card/80 overflow-hidden relative">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="15" width="130" height="80" rx="4" stroke="#1E293B" strokeWidth="1.5" />
            <text x="85" y="45" textAnchor="middle" fontSize="10" fill="#475569">CEO Office</text>
            <circle cx="65" cy="65" r="4" fill="#8B5CF6" opacity="0.6" />
            <text x="77" y="69" fontSize="8" fill="#475569">Aria</text>

            <rect x="190" y="15" width="260" height="80" rx="4" stroke="#1E293B" strokeWidth="1.5" />
            <text x="320" y="12" textAnchor="middle" fontSize="10" fill="#475569">Engineering</text>
            <rect x="210" y="35" width="38" height="22" rx="2" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="229" cy="46" r="3" fill="#3B82F6" opacity="0.6" />
            <text x="229" y="70" textAnchor="middle" fontSize="7" fill="#475569">Atlas</text>
            <rect x="260" y="35" width="38" height="22" rx="2" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="279" cy="46" r="3" fill="#3B82F6" opacity="0.6" />
            <text x="279" y="70" textAnchor="middle" fontSize="7" fill="#475569">Nova</text>
            <rect x="310" y="35" width="38" height="22" rx="2" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="329" cy="46" r="3" fill="#3B82F6" opacity="0.6" />
            <text x="329" y="70" textAnchor="middle" fontSize="7" fill="#475569">Echo</text>
            <rect x="360" y="35" width="38" height="22" rx="2" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="379" cy="46" r="3" fill="#F59E0B" opacity="0.6" />
            <text x="379" y="70" textAnchor="middle" fontSize="7" fill="#475569">Sentinel</text>

            <rect x="490" y="15" width="110" height="80" rx="4" stroke="#1E293B" strokeWidth="1.5" />
            <text x="545" y="45" textAnchor="middle" fontSize="10" fill="#475569">Meeting Room</text>
            <ellipse cx="545" cy="65" rx="28" ry="12" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 2" />

            <rect x="190" y="110" width="200" height="55" rx="4" stroke="#1E293B" strokeWidth="1.5" />
            <text x="290" y="108" textAnchor="middle" fontSize="10" fill="#475569">Creative & Marketing</text>
            <rect x="210" y="125" width="38" height="22" rx="2" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="229" cy="136" r="3" fill="#A855F7" opacity="0.6" />
            <text x="229" y="158" textAnchor="middle" fontSize="7" fill="#475569">Pixel</text>
            <rect x="260" y="125" width="38" height="22" rx="2" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="279" cy="136" r="3" fill="#14B8A6" opacity="0.6" />
            <text x="279" y="158" textAnchor="middle" fontSize="7" fill="#475569">Sage</text>
            <rect x="310" y="125" width="38" height="22" rx="2" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="329" cy="136" r="3" fill="#14B8A6" opacity="0.6" />
            <text x="329" y="158" textAnchor="middle" fontSize="7" fill="#475569">Scout</text>

            <line x1="150" y1="55" x2="190" y2="55" stroke="#1E293B" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="450" y1="55" x2="490" y2="55" stroke="#1E293B" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="290" y1="95" x2="290" y2="110" stroke="#1E293B" strokeWidth="1" strokeDasharray="4 3" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <p className="text-sm font-medium text-[#475569]">🏢 {t('orgChart.officeViewTitle')}</p>
            <p className="mt-1 text-xs text-[#475569]/70">{t('orgChart.officeViewDesc')}</p>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="hidden w-[260px] shrink-0 border-l border-border bg-card p-4 lg:block overflow-y-auto scrollbar-thin scrollbar-thin">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t('orgChart.summary', 'Summary')}</h2>

        {/* Total agents */}
        <div className="mb-4">
          <div className="text-3xl font-bold text-foreground">{agents.length}</div>
          <div className="text-sm text-muted-foreground">{t('orgChart.totalAgents', 'Total agents')}</div>
        </div>

        {/* Department distribution */}
        <div className="mb-4">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('orgChart.departments', 'Departments')}</h3>
          <div className="space-y-2">
            {Object.entries(deptCounts).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: departmentColors[dept as Department] ?? '#6B7280' }}
                  />
                  <span className="text-sm capitalize text-foreground">{t(`departments.${dept}`, dept)}</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status distribution */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('orgChart.status', 'Status')}</h3>
          <div className="space-y-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[status] ?? '#6B7280' }}
                  />
                  <span className="text-sm capitalize text-foreground">{t(`agents.status.${status}`, status)}</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

    </PageContainer>
  );
}
