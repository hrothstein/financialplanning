/**
 * Top-level asset/liability routes for updates and deletes by itemId.
 * (Creation and per-client listing live under /clients/:clientId/assets.)
 * PRD §5 "Net Worth".
 */

import { Router } from 'express';
import * as ops from '../lib/operations.js';

const router = Router();

// PUT /assets/:itemId
router.put('/:itemId', (req, res, next) => {
  try {
    res.json(ops.updateAsset(req.params.itemId, req.body));
  } catch (err) {
    next(err);
  }
});

// DELETE /assets/:itemId
router.delete('/:itemId', (req, res, next) => {
  try {
    res.json(ops.deleteAsset(req.params.itemId));
  } catch (err) {
    next(err);
  }
});

export default router;
