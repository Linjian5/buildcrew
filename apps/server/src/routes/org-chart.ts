import { Router } from 'express';
import { eq } from '@buildcrew/db';
import { db, agents } from '@buildcrew/db';
import { ok } from '../lib/response.js';
import { param } from '../lib/params.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';

const router = Router();

interface OrgNode {
  agent: {
    id: string;
    name: string;
    title: string;
    department: string | null;
    level: string | null;
    status: string | null;
  };
  children: OrgNode[];
}

// GET /companies/:companyId/org-chart
router.get('/companies/:companyId/org-chart', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');

    const allAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));

    // Build tree
    const nodeMap = new Map<string, OrgNode>();
    const byDepartment: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const a of allAgents) {
      nodeMap.set(a.id, {
        agent: { id: a.id, name: a.name, title: a.title, department: a.department, level: a.level, status: a.status },
        children: [],
      });
      byDepartment[a.department ?? 'unassigned'] = (byDepartment[a.department ?? 'unassigned'] ?? 0) + 1;
      byStatus[a.status ?? 'unknown'] = (byStatus[a.status ?? 'unknown'] ?? 0) + 1;
    }

    // Link children to parents
    const roots: OrgNode[] = [];
    for (const a of allAgents) {
      const node = nodeMap.get(a.id)!;
      if (a.reportsTo && nodeMap.has(a.reportsTo)) {
        nodeMap.get(a.reportsTo)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // If single root, use it; otherwise wrap in virtual root
    const root = roots.length === 1 ? roots[0]! : { agent: { id: '', name: 'Company', title: 'Root', department: null, level: null, status: null }, children: roots };

    ok(res, {
      root,
      stats: {
        total: allAgents.length,
        by_department: byDepartment,
        by_status: byStatus,
      },
    });
  } catch (e) {
    next(e);
  }
});

export { router as orgChartRouter };
