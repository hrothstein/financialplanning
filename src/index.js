/**
 * Financial Planning System — Express app bootstrap.
 *
 * Mounts REST routes under /api/v1, Swagger UI at /docs, and the MCP server at
 * /mcp. In-memory store is seeded on boot. Demo-grade: no auth, CORS open,
 * data resets on restart. PRD §2.
 */

import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { reset } from './data/store.js';
import { toErrorBody, ApiError } from './lib/errors.js';
import { mountSwagger } from './swagger.js';
import { mountMcp } from './mcp/server.js';

import clientsRouter from './routes/clients.js';
import goalsRouter from './routes/goals.js';
import plansRouter from './routes/plans.js';
import assetsRouter from './routes/assets.js';
import demoRouter from './routes/demo.js';

const PORT = process.env.PORT || 3003;

// Path to the built frontend (frontend/dist). Present only after a Vite build
// (locally via `npm run build`, on Heroku via the postinstall hook). When it's
// missing the app still runs headless with just the API/docs/MCP.
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist');
const HAS_FRONTEND = existsSync(join(DIST_DIR, 'index.html'));

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Seed the store on app creation (also re-runnable via POST /api/v1/demo/reset).
  reset();

  // --- API docs + MCP (mounted at the root, not under /api/v1) ---
  mountSwagger(app);
  mountMcp(app);

  // Serve the built frontend's static assets (JS/CSS/etc.) if present.
  if (HAS_FRONTEND) {
    app.use(express.static(DIST_DIR));
  } else {
    // No frontend build: keep a friendly JSON landing page at the root.
    app.get('/', (_req, res) => {
      res.json({
        service: 'financial-planning',
        version: '1.0.0',
        docs: '/docs',
        health: '/api/v1/health',
        mcp: '/mcp',
        api: '/api/v1',
      });
    });
  }

  // --- REST API under /api/v1 ---
  const api = express.Router();
  api.use('/', demoRouter); // /health, /demo/reset
  api.use('/clients', clientsRouter); // also hosts net-worth + assets sub-resources
  api.use('/goals', goalsRouter);
  api.use('/plans', plansRouter);
  api.use('/assets', assetsRouter);
  app.use('/api/v1', api);

  // 404 for unmatched API routes.
  app.use('/api/v1', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // SPA fallback: for any other GET that isn't an API/docs/mcp path, return the
  // frontend's index.html so client-side routes (/clients/:id, /goals/:id) work
  // on refresh/deep-link. Only active when a build is present.
  if (HAS_FRONTEND) {
    app.get(/^(?!\/(api|docs|mcp)(\/|$)).*/, (_req, res) => {
      res.sendFile(join(DIST_DIR, 'index.html'));
    });
  }

  // Central error handler — renders ApiError (and unknown errors) as the
  // documented { error: { code, message, details } } body.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err instanceof ApiError ? err.status : 500;
    if (!(err instanceof ApiError)) {
      // Log unexpected errors for the operator; still return a clean body.
      console.error('[unexpected error]', err);
    }
    res.status(status).json(toErrorBody(err));
  });

  return app;
}

// Start the server unless imported for testing.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Financial Planning System listening on port ${PORT}`);
    console.log(`  REST:    http://localhost:${PORT}/api/v1`);
    console.log(`  Docs:    http://localhost:${PORT}/docs`);
    console.log(`  MCP:     http://localhost:${PORT}/mcp  (health: /mcp/health)`);
    console.log(`  Health:  http://localhost:${PORT}/api/v1/health`);
  });
}
