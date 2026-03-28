import { eq, sql } from '@buildcrew/db';
import { db, conversations, knowledgeEntries } from '@buildcrew/db';

/**
 * Auto-extract knowledge from task conversations after completion.
 */
export async function extractKnowledgeFromTask(companyId: string, taskId: string, agentId: string | null) {
  // Get all conversations for this task
  const convos = await db
    .select()
    .from(conversations)
    .where(eq(conversations.taskId, taskId))
    .orderBy(conversations.createdAt);

  if (convos.length === 0) return [];

  const extracted: Array<{ title: string; content: string; category: string }> = [];

  for (const c of convos) {
    const text = c.content.toLowerCase();

    // Simple rule-based extraction
    if (text.includes('error') || text.includes('fix') || text.includes('workaround') || text.includes('bug')) {
      extracted.push({
        title: `Fix/Workaround from task ${taskId.slice(0, 8)}`,
        content: c.content.slice(0, 2000),
        category: text.includes('error') || text.includes('bug') ? 'failure' : 'quirk',
      });
    } else if (text.includes('config') || text.includes('env') || text.includes('setup') || text.includes('install')) {
      extracted.push({
        title: `Configuration note from task ${taskId.slice(0, 8)}`,
        content: c.content.slice(0, 2000),
        category: 'config',
      });
    } else if (c.content.length > 200) {
      // Longer content might be a useful pattern
      extracted.push({
        title: `Pattern from task ${taskId.slice(0, 8)}`,
        content: c.content.slice(0, 2000),
        category: 'pattern',
      });
    }
  }

  // Deduplicate: check if similar title already exists (simple substring match)
  const results = [];
  for (const item of extracted) {
    const [existing] = await db
      .select()
      .from(knowledgeEntries)
      .where(
        sql`${knowledgeEntries.companyId} = ${companyId}
            AND ${knowledgeEntries.title} = ${item.title}
            AND ${knowledgeEntries.expired} = false`,
      );

    if (existing) {
      // Merge: increase confidence
      await db
        .update(knowledgeEntries)
        .set({
          confidence: Math.min(1.0, (existing.confidence ?? 0.5) + 0.1),
          updatedAt: new Date(),
        })
        .where(eq(knowledgeEntries.id, existing.id));
    } else {
      // Create new entry
      const embedding = generateMockEmbedding();
      const [entry] = await db
        .insert(knowledgeEntries)
        .values({
          companyId,
          title: item.title,
          content: item.content,
          category: item.category,
          sourceTaskId: taskId,
          sourceAgentId: agentId,
          confidence: 0.6,
        })
        .returning();

      if (entry) {
        await db.execute(
          sql`UPDATE knowledge_entries SET embedding = ${sql.raw(`'[${embedding.join(',')}]'::vector`)} WHERE id = ${entry.id}`,
        );
        results.push(entry);
      }
    }
  }

  return results;
}

function generateMockEmbedding(): number[] {
  const vec = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => Math.round((v / norm) * 1e6) / 1e6);
}
