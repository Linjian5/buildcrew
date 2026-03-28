import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from '@buildcrew/db';
import { db, agents, companies, agentLoans } from '@buildcrew/db';
import { validate } from '../lib/validate.js';
import { ok, notFound, err } from '../lib/response.js';
import { param } from '../lib/params.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';

const router = Router();

const loanSchema = z.object({
  to_company_id: z.string().uuid(),
  duration_hours: z.number().int().min(1).max(720),
});

// POST /companies/:companyId/agents/:agentId/loan — Initiate loan
router.post('/companies/:companyId/agents/:agentId/loan', validateCompanyOwnership, validate(loanSchema), async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const agentId = param(req, 'agentId');
    const body = req.body as z.infer<typeof loanSchema>;

    // Verify agent belongs to company
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));
    if (!agent) return notFound(res, 'Agent');

    // Verify target company exists
    const [targetCompany] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, body.to_company_id));
    if (!targetCompany) return notFound(res, 'Target company');

    if (companyId === body.to_company_id) {
      return err(res, 400, 'SAME_COMPANY', 'Cannot loan agent to the same company');
    }

    // Check no active loan
    const [existingLoan] = await db
      .select()
      .from(agentLoans)
      .where(and(eq(agentLoans.agentId, agentId), eq(agentLoans.status, 'active')));
    if (existingLoan) {
      return err(res, 409, 'ALREADY_LOANED', 'Agent is already on loan');
    }

    const [loan] = await db
      .insert(agentLoans)
      .values({
        agentId,
        fromCompanyId: companyId,
        toCompanyId: body.to_company_id,
        durationHours: body.duration_hours,
      })
      .returning();

    ok(res, {
      id: loan!.id,
      agent_id: loan!.agentId,
      from_company_id: loan!.fromCompanyId,
      to_company_id: loan!.toCompanyId,
      duration_hours: loan!.durationHours,
      status: loan!.status,
      started_at: loan!.startedAt?.toISOString() ?? null,
    }, 201);
  } catch (e) {
    next(e);
  }
});

export { router as agentLoansRouter };
