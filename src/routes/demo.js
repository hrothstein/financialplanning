/**
 * Utility routes: health check and demo reset. PRD §5 "Utility".
 */

import { Router } from 'express';
import { reset } from '../data/store.js';

const router = Router();

// GET /health
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'financial-planning',
    timestamp: new Date().toISOString(),
  });
});

// POST /demo/reset — restore identical seed data
router.post('/demo/reset', (_req, res) => {
  const counts = reset();
  res.json({
    status: 'ok',
    message: 'Seed data restored',
    counts,
    timestamp: new Date().toISOString(),
  });
});

export default router;
