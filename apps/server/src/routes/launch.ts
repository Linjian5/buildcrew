import { Router } from 'express';
import { eq, and, sql, desc } from '@buildcrew/db';
import { db, companies, agents, chatThreads } from '@buildcrew/db';
import { ok, notFound, err } from '../lib/response.js';
import { param } from '../lib/params.js';
import { getUser } from '../middleware/auth.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';
import { emitEvent } from '../ws.js';

const router = Router();

/**
 * POST /companies/:companyId/launch
 *
 * Called when user clicks the "Launch/启动" button in the UI.
 * This does NOT auto-execute anything. It finds the active CEO thread
 * and delegates to the confirm-plan logic (hire → goals → tasks → assign).
 *
 * The actual execution happens via a redirect to the confirm-plan endpoint logic.
 */
router.post('/companies/:companyId/launch', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const userId = getUser(req).userId;
    const language = (req.body as { language?: string }).language ?? 'en';

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return notFound(res, 'Company');

    // Find CEO agent
    const team = await db.select().from(agents).where(eq(agents.companyId, companyId));
    const ceo = team.find((a) => a.title?.toLowerCase().includes('ceo'));
    if (!ceo) return err(res, 400, 'NO_CEO', 'No CEO agent found.');

    // Find the active CEO thread (where the plan conversation happened)
    const [activeThread] = await db.select().from(chatThreads).where(
      and(
        eq(chatThreads.companyId, companyId),
        eq(chatThreads.agentId, ceo.id),
        sql`${chatThreads.status} != 'closed'`,
      ),
    ).orderBy(desc(chatThreads.updatedAt)).limit(1);

    if (!activeThread) {
      return err(res, 400, 'NO_THREAD', 'No active CEO thread found. Please start a conversation with Aria first.');
    }

    // Forward to confirm-plan by calling the internal handler directly
    // This reuses the same confirm-plan logic without requiring the frontend
    // to know about two different endpoints.
    req.params['threadId'] = activeThread.id;
    (req.body as Record<string, unknown>).language = language;

    // Import and call the confirm-plan handler
    const { executeConfirmPlan, executeReadyPlan } = await import('./chat.js');

    // If execute: true, go straight to execution (user clicked "立即执行")
    const execute = (req.body as Record<string, unknown>).execute === true;

    const result = execute
      ? await executeReadyPlan({ threadId: activeThread.id, companyId, userId, language: language as 'en' | 'zh' | 'ja' })
      : await executeConfirmPlan({ threadId: activeThread.id, companyId, userId, language: language as 'en' | 'zh' | 'ja' });

    if (result.error) {
      return err(res, result.httpStatus ?? 400, result.error.code, result.error.message);
    }

    emitEvent(companyId, 'company.launched', {
      company_id: companyId,
      thread_id: activeThread.id,
    });

    ok(res, {
      company_id: companyId,
      thread_id: activeThread.id,
      ...result.data,
    });
  } catch (e) {
    next(e);
  }
});

export { router as launchRouter };
