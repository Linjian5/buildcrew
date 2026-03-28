import { eq } from '@buildcrew/db';
import { db, agents, guardianAlerts } from '@buildcrew/db';
import { emitEvent } from '../ws.js';
import { onGuardianAlert } from '../services/ceo-operations.js';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type AlertCategory = 'behavior' | 'security' | 'cost' | 'loop';

interface CreateAlertInput {
  companyId: string;
  agentId?: string;
  taskId?: string;
  severity: AlertSeverity;
  category: AlertCategory;
  description: string;
  evidence?: Record<string, unknown>;
}

const SEVERITY_ACTIONS: Record<AlertSeverity, string> = {
  info: 'log_only',
  warning: 'throttle',
  critical: 'pause_agent',
  emergency: 'kill_task',
};

/**
 * Create an alert and execute auto-response.
 */
export async function createAlert(input: CreateAlertInput) {
  const autoAction = SEVERITY_ACTIONS[input.severity];

  const [alert] = await db
    .insert(guardianAlerts)
    .values({
      companyId: input.companyId,
      agentId: input.agentId,
      taskId: input.taskId,
      severity: input.severity,
      category: input.category,
      description: input.description,
      evidence: input.evidence ?? {},
      autoAction,
    })
    .returning();

  if (!alert) return null;

  // Execute auto-response
  await executeAutoResponse(input.companyId, input.agentId, input.severity);

  // Push via WebSocket
  emitEvent(input.companyId, 'alert.created', {
    id: alert.id,
    severity: alert.severity,
    category: alert.category,
    description: alert.description,
    auto_action: autoAction,
    agent_id: alert.agentId,
    task_id: alert.taskId,
  });

  // B-04: CEO relays critical/emergency alerts to the user
  onGuardianAlert({
    companyId: input.companyId,
    agentId: input.agentId,
    taskId: input.taskId,
    severity: input.severity,
    category: input.category,
    description: input.description,
  }).catch(() => {});

  return alert;
}

/**
 * Execute auto-response based on severity.
 */
async function executeAutoResponse(
  companyId: string,
  agentId: string | undefined,
  severity: AlertSeverity,
) {
  if (!agentId) return;

  switch (severity) {
    case 'warning': {
      // Throttle: double the heartbeat interval
      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
      if (agent) {
        const newInterval = (agent.heartbeatIntervalSec ?? 300) * 2;
        await db
          .update(agents)
          .set({ heartbeatIntervalSec: Math.min(newInterval, 3600), updatedAt: new Date() })
          .where(eq(agents.id, agentId));
      }
      break;
    }
    case 'critical': {
      // Pause agent
      await db
        .update(agents)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(eq(agents.id, agentId));

      emitEvent(companyId, 'agent.status_changed', {
        agent_id: agentId,
        status: 'paused',
        reason: 'guardian_critical_alert',
      });
      break;
    }
    case 'emergency': {
      // Pause agent (kill_task would require more context)
      await db
        .update(agents)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(agents.id, agentId));

      emitEvent(companyId, 'agent.status_changed', {
        agent_id: agentId,
        status: 'error',
        reason: 'guardian_emergency',
      });
      break;
    }
    // info: log_only — no action needed
  }
}

/**
 * Check heartbeat for cost anomaly.
 */
export async function checkCostAnomaly(
  companyId: string,
  agentId: string,
  costUsd: number,
) {
  // Simple heuristic: if single heartbeat cost > $1, trigger warning
  if (costUsd > 1.0) {
    await createAlert({
      companyId,
      agentId,
      severity: 'warning',
      category: 'cost',
      description: `High token cost in single heartbeat: $${costUsd.toFixed(4)}`,
      evidence: { cost_usd: costUsd, threshold: 1.0 },
    });
  }
}

/**
 * Check budget warning thresholds.
 */
export async function checkBudgetWarning(
  companyId: string,
  agentId: string,
  budgetSpent: number,
  budgetMonthly: number,
) {
  if (budgetMonthly <= 0) return;

  const usagePct = (budgetSpent / budgetMonthly) * 100;

  if (usagePct >= 90) {
    await createAlert({
      companyId,
      agentId,
      severity: 'critical',
      category: 'cost',
      description: `Budget usage at ${usagePct.toFixed(1)}% — approaching limit`,
      evidence: { budget_spent: budgetSpent, budget_monthly: budgetMonthly, usage_pct: usagePct },
    });

    emitEvent(companyId, 'budget.warning', {
      agent_id: agentId,
      usage_pct: usagePct,
      level: 'critical',
    });
  } else if (usagePct >= 70) {
    await createAlert({
      companyId,
      agentId,
      severity: 'warning',
      category: 'cost',
      description: `Budget usage at ${usagePct.toFixed(1)}%`,
      evidence: { budget_spent: budgetSpent, budget_monthly: budgetMonthly, usage_pct: usagePct },
    });

    emitEvent(companyId, 'budget.warning', {
      agent_id: agentId,
      usage_pct: usagePct,
      level: 'warning',
    });
  }
}
