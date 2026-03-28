import { Router } from 'express';
import { db } from '@buildcrew/db';
import { sql } from '@buildcrew/db';

const router = Router();

router.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';

  try {
    await db.execute(sql`SELECT 1`);
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  res.json({
    data: {
      status: 'ok',
      db: dbStatus,
      uptime: process.uptime(),
    },
    error: null,
  });
});

export { router as healthRouter };
