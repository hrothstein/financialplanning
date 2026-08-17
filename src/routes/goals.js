/**
 * Goal routes: CRUD + deterministic projection + Monte Carlo. PRD §5 "Goals".
 */

import { Router } from 'express';
import * as ops from '../lib/operations.js';
import { paginate, paginatedResponse } from '../lib/errors.js';

const router = Router();

// GET /goals — filters: ?clientId= ?type= ?status= ?priority=
router.get('/', (req, res, next) => {
  try {
    const goals = ops.listGoals({
      clientId: req.query.clientId,
      type: req.query.type,
      status: req.query.status,
      priority: req.query.priority,
    });
    res.json(paginatedResponse(goals, paginate(req.query)));
  } catch (err) {
    next(err);
  }
});

// POST /goals — create
router.post('/', (req, res, next) => {
  try {
    res.status(201).json(ops.createGoal(req.body));
  } catch (err) {
    next(err);
  }
});

// GET /goals/:goalId
router.get('/:goalId', (req, res, next) => {
  try {
    res.json(ops.getGoal(req.params.goalId));
  } catch (err) {
    next(err);
  }
});

// PUT /goals/:goalId — update (recomputes status)
router.put('/:goalId', (req, res, next) => {
  try {
    res.json(ops.updateGoal(req.params.goalId, req.body));
  } catch (err) {
    next(err);
  }
});

// DELETE /goals/:goalId
router.delete('/:goalId', (req, res, next) => {
  try {
    res.json(ops.deleteGoal(req.params.goalId));
  } catch (err) {
    next(err);
  }
});

// GET /goals/:goalId/projection — deterministic projection (§4.2)
router.get('/:goalId/projection', (req, res, next) => {
  try {
    res.json(ops.runGoalProjection(req.params.goalId, { asOf: req.query.asOf }));
  } catch (err) {
    next(err);
  }
});

// GET /goals/:goalId/monte-carlo — Monte Carlo (§4.3)
router.get('/:goalId/monte-carlo', (req, res, next) => {
  try {
    res.json(
      ops.runGoalMonteCarlo(req.params.goalId, {
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
