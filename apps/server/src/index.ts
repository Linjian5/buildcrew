import http from 'http';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import pino from 'pino';
import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import { healthRouter } from './routes/health.js';
import { companiesRouter } from './routes/companies.js';
import { agentsRouter } from './routes/agents.js';
import { tasksRouter } from './routes/tasks.js';
import { heartbeatRouter } from './routes/heartbeat.js';
import { goalsRouter } from './routes/goals.js';
import { budgetRouter } from './routes/budget.js';
import { routingRouter } from './routes/routing.js';
import { guardianRouter } from './routes/guardian.js';
import { reviewsRouter } from './routes/reviews.js';
import { approvalsRouter } from './routes/approvals.js';
import { authRouter } from './routes/auth.js';
import { orgChartRouter } from './routes/org-chart.js';
import { knowledgeRouter } from './routes/knowledge.js';
import { evolutionRouter } from './routes/evolution.js';
import { groupsRouter } from './routes/groups.js';
import { settingsRouter } from './routes/settings.js';
import { agentLoansRouter } from './routes/agent-loans.js';
import { modelKeysRouter } from './routes/model-keys.js';
import { usageRouter } from './routes/usage.js';
import { chatRouter } from './routes/chat.js';
import { launchRouter } from './routes/launch.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { walletRouter } from './routes/wallet.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { initWebSocket } from './ws.js';
import { initCEOWorkLoopWorker } from './services/ceo-work-loop.js';

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' });

const app = express();
const server = http.createServer(app);

// WebSocket
initWebSocket(server);

// BullMQ workers
initCEOWorkLoopWorker();

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(pinoHttp({ logger }));

// B003 fix: disable rate limit in test mode, otherwise 100/min
if (env.NODE_ENV !== 'test') {
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 100,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
}

// B001 fix: validate UUID params globally
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
app.param('id', (_req, res, next, val) => {
  if (!UUID_REGEX.test(val as string)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_UUID', message: `'id' must be a valid UUID` } });
    return;
  }
  next();
});
app.param('companyId', (_req, res, next, val) => {
  if (!UUID_REGEX.test(val as string)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_UUID', message: `'companyId' must be a valid UUID` } });
    return;
  }
  next();
});
app.param('agentId', (_req, res, next, val) => {
  if (!UUID_REGEX.test(val as string)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_UUID', message: `'agentId' must be a valid UUID` } });
    return;
  }
  next();
});
app.param('taskId', (_req, res, next, val) => {
  if (!UUID_REGEX.test(val as string)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_UUID', message: `'taskId' must be a valid UUID` } });
    return;
  }
  next();
});
app.param('alertId', (_req, res, next, val) => {
  if (!UUID_REGEX.test(val as string)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_UUID', message: `'alertId' must be a valid UUID` } });
    return;
  }
  next();
});
app.param('reviewId', (_req, res, next, val) => {
  if (!UUID_REGEX.test(val as string)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_UUID', message: `'reviewId' must be a valid UUID` } });
    return;
  }
  next();
});
app.param('entryId', (_req, res, next, val) => {
  if (!UUID_REGEX.test(val as string)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_UUID', message: `'entryId' must be a valid UUID` } });
    return;
  }
  next();
});
app.param('threadId', (_req, res, next, val) => {
  if (!UUID_REGEX.test(val as string)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_UUID', message: `'threadId' must be a valid UUID` } });
    return;
  }
  next();
});

// Routes — PUBLIC (no auth required)
app.use('/api/v1', healthRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1', subscriptionsRouter); // GET /plans is public, subscription endpoints have internal auth

// Global auth wall — everything below requires a valid JWT
app.use('/api/v1', authMiddleware);

// Routes — PROTECTED (auth required)
app.use('/api/v1', companiesRouter);
app.use('/api/v1', agentsRouter);
app.use('/api/v1', tasksRouter);
app.use('/api/v1', heartbeatRouter);
app.use('/api/v1', goalsRouter);
app.use('/api/v1', budgetRouter);
app.use('/api/v1', routingRouter);
app.use('/api/v1', guardianRouter);
app.use('/api/v1', reviewsRouter);
app.use('/api/v1', approvalsRouter);
app.use('/api/v1', orgChartRouter);
app.use('/api/v1', knowledgeRouter);
app.use('/api/v1', evolutionRouter);
app.use('/api/v1', groupsRouter);
app.use('/api/v1', settingsRouter);
app.use('/api/v1', agentLoansRouter);
app.use('/api/v1', modelKeysRouter);
app.use('/api/v1', usageRouter);
app.use('/api/v1', chatRouter);
app.use('/api/v1', launchRouter);
app.use('/api/v1', walletRouter);

// Error handler
app.use(errorHandler);

server.listen(env.PORT, () => {
  logger.info(`BuildCrew API server running on http://localhost:${env.PORT}`);
});

export { app, server };
