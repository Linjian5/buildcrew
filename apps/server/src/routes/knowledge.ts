import { Router } from 'express';
import { z } from 'zod';
import { eq, and, count, sql } from '@buildcrew/db';
import { db, knowledgeEntries } from '@buildcrew/db';
import { validate, parsePagination } from '../lib/validate.js';
import { ok, paginated, notFound } from '../lib/response.js';
import { param } from '../lib/params.js';
import { checkLimit } from '../middleware/plan-guard.js';
import { validateCompanyOwnership } from '../middleware/company-ownership.js';

const router = Router();

const createKnowledgeSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(10000),
  category: z.enum(['pattern', 'quirk', 'config', 'failure', 'adr', 'glossary']).default('pattern'),
  source_task_id: z.string().uuid().optional(),
  source_agent_id: z.string().uuid().optional(),
  relevance_tags: z.array(z.string()).optional(),
});

// POST /companies/:companyId/knowledge — Create entry
router.post('/companies/:companyId/knowledge', validateCompanyOwnership, checkLimit('knowledge'), validate(createKnowledgeSchema), async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const body = req.body as z.infer<typeof createKnowledgeSchema>;

    // Generate simulated embedding (1536 dimensions, random unit vector)
    const embedding = generateMockEmbedding();

    const [entry] = await db
      .insert(knowledgeEntries)
      .values({
        companyId,
        title: body.title,
        content: body.content,
        category: body.category,
        sourceTaskId: body.source_task_id,
        sourceAgentId: body.source_agent_id,
        relevanceTags: body.relevance_tags ?? [],
      })
      .returning();

    if (!entry) return notFound(res, 'Entry');

    // Store embedding via raw SQL
    await db.execute(
      sql`UPDATE knowledge_entries SET embedding = ${sql.raw(`'[${embedding.join(',')}]'::vector`)} WHERE id = ${entry.id}`,
    );

    ok(res, formatEntry(entry), 201);
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/knowledge — List
router.get('/companies/:companyId/knowledge', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const offset = (page - 1) * limit;

    const conditions = [eq(knowledgeEntries.companyId, companyId), eq(knowledgeEntries.expired, false)];
    const category = req.query['category'] as string | undefined;
    if (category) conditions.push(eq(knowledgeEntries.category, category));

    const where = and(...conditions);

    const [rows, [countRow]] = await Promise.all([
      db.select().from(knowledgeEntries).where(where).limit(limit).offset(offset).orderBy(knowledgeEntries.createdAt),
      db.select({ total: count() }).from(knowledgeEntries).where(where),
    ]);

    paginated(res, rows.map(formatEntry), { page, limit, total: Number(countRow?.total ?? 0) });
  } catch (e) {
    next(e);
  }
});

// GET /companies/:companyId/knowledge/search?q=... — Semantic search
router.get('/companies/:companyId/knowledge/search', validateCompanyOwnership, async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    const query = (req.query['q'] as string) ?? '';
    const limitParam = Math.min(Number(req.query['limit'] ?? 10), 50);

    if (!query) {
      return ok(res, []);
    }

    // Generate mock query embedding
    const queryEmbedding = generateMockEmbedding();

    const rows = await db.execute(
      sql`SELECT *, 1 - (embedding <=> ${sql.raw(`'[${queryEmbedding.join(',')}]'::vector`)}) as similarity
          FROM knowledge_entries
          WHERE company_id = ${companyId} AND expired = false AND embedding IS NOT NULL
          ORDER BY embedding <=> ${sql.raw(`'[${queryEmbedding.join(',')}]'::vector`)}
          LIMIT ${limitParam}`,
    );

    const results = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r['id'],
      company_id: r['company_id'],
      category: r['category'],
      title: r['title'],
      content: r['content'],
      similarity: Number(r['similarity'] ?? 0),
      citation_count: Number(r['citation_count'] ?? 0),
      confidence: Number(r['confidence'] ?? 0),
      relevance_tags: r['relevance_tags'],
      created_at: r['created_at'],
    }));

    ok(res, results);
  } catch (e) {
    next(e);
  }
});

// DELETE /companies/:companyId/knowledge/:entryId — Mark expired
router.delete('/companies/:companyId/knowledge/:entryId', validateCompanyOwnership, async (req, res, next) => {
  try {
    const entryId = param(req, 'entryId');
    const [entry] = await db
      .update(knowledgeEntries)
      .set({ expired: true, updatedAt: new Date() })
      .where(and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.companyId, param(req, 'companyId'))))
      .returning();

    if (!entry) return notFound(res, 'Knowledge entry');
    ok(res, { id: entry.id, expired: true });
  } catch (e) {
    next(e);
  }
});

// --- Helpers ---

function generateMockEmbedding(): number[] {
  const vec = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => Math.round((v / norm) * 1e6) / 1e6);
}

type EntryRow = typeof knowledgeEntries.$inferSelect;

function formatEntry(row: EntryRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    category: row.category,
    title: row.title,
    content: row.content,
    source_task_id: row.sourceTaskId,
    source_agent_id: row.sourceAgentId,
    relevance_tags: row.relevanceTags,
    citation_count: row.citationCount,
    confidence: row.confidence,
    expired: row.expired,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export { router as knowledgeRouter };
