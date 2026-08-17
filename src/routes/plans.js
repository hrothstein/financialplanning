/**
 * Plan routes: CRUD + aggregate summary + plan-wide Monte Carlo. PRD §5 "Plans".
 */

import { Router } from 'express';
import * as ops from '../lib/operations.js';
import { paginate, paginatedResponse } from '../lib/errors.js';

const router = Router();

// GET /plans — filter ?clientId= ?status=
router.get('/', (req, res, next) => {
  try {
    const plans = ops.listPlans({ clientId: req.query.clientId, status: req.query.status });
    res.json(paginatedResponse(plans, paginate(req.query)));
  } catch (err) {
    next(err);
  }
});

// POST /plans
router.post('/', (req, res, next) => {
  try {
    res.status(201).json(ops.createPlan(req.body));
  } catch (err) {
    next(err);
  }
});

// GET /plans/:planId
router.get('/:planId', (req, res, next) => {
  try {
    res.json(ops.getPlan(req.params.planId));
  } catch (err) {
    next(err);
  }
});

// PUT /plans/:planId
router.put('/:planId', (req, res, next) => {
  try {
    res.json(ops.updatePlan(req.params.planId, req.body));
  } catch (err) {
    next(err);
  }
});

// DELETE /plans/:planId
router.delete('/:planId', (req, res, next) => {
  try {
    res.json(ops.deletePlan(req.params.planId));
  } catch (err) {
    next(err);
  }
});

// GET /plans/:planId/summary — aggregate plan summary (§4.5)
router.get('/:planId/summary', (req, res, next) => {
  try {
    res.json(ops.getPlanSummary(req.params.planId, { asOf: req.query.asOf }));
  } catch (err) {
    next(err);
  }
});

// GET /plans/:planId/monte-carlo — per-goal + blended probability of success
router.get('/:planId/monte-carlo', (req, res, next) => {
  try {
    res.json(
      ops.runPlanMonteCarlo(req.params.planId, {
        iterations: req.query.iterations,
        seed: req.query.seed,
        asOf: req.query.asOf,
      }),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
