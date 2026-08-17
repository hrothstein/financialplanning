/**
 * Portfolio (book-of-business) route. Aggregates every client, goal, asset,
 * and plan into a single advisor overview.
 */

import { Router } from 'express';
import * as ops from '../lib/operations.js';

const router = Router();

// GET /portfolio/overview
router.get('/overview', (_req, res, next) => {
  try {
    res.json(ops.getPortfolioOverview());
  } catch (err) {
    next(err);
  }
});

export default router;
