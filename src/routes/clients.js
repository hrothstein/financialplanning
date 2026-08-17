/**
 * Client routes (read-only projection). PRD §5 "Clients".
 * Also hosts the per-client net-worth and assets sub-resources (PRD §5 "Net Worth").
 */

import { Router } from 'express';
import * as ops from '../lib/operations.js';
import { paginate, paginatedResponse } from '../lib/errors.js';

const router = Router();

// GET /clients — list with optional ?riskTolerance= filter
router.get('/', (req, res, next) => {
  try {
    const clients = ops.listClients({ riskTolerance: req.query.riskTolerance });
    res.json(paginatedResponse(clients, paginate(req.query)));
  } catch (err) {
    next(err);
  }
});

// GET /clients/:clientId
router.get('/:clientId', (req, res, next) => {
  try {
    res.json(ops.getClient(req.params.clientId));
  } catch (err) {
    next(err);
  }
});

// GET /clients/:clientId/summary
router.get('/:clientId/summary', (req, res, next) => {
  try {
    res.json(ops.getClientSummary(req.params.clientId));
  } catch (err) {
    next(err);
  }
});

// GET /clients/:clientId/net-worth
router.get('/:clientId/net-worth', (req, res, next) => {
  try {
    res.json(ops.getNetWorth(req.params.clientId));
  } catch (err) {
    next(err);
  }
});

// GET /clients/:clientId/assets — list assets & liabilities
router.get('/:clientId/assets', (req, res, next) => {
  try {
    const items = ops.listAssets(req.params.clientId);
    res.json(paginatedResponse(items, paginate(req.query)));
  } catch (err) {
    next(err);
  }
});

// POST /clients/:clientId/assets — add asset/liability
router.post('/:clientId/assets', (req, res, next) => {
  try {
    res.status(201).json(ops.addAsset(req.params.clientId, req.body));
  } catch (err) {
    next(err);
  }
});

export default router;
