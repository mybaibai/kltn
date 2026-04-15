import express from 'express';
import { create, getAll, getDetail, getByRequester, getByTeam, updateStatus, assign }
  from '../controllers/sosController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.post('/',                         create);
router.get('/',                          getAll);
router.get('/requester/:requesterId',    getByRequester);
router.get('/team/:teamId',              getByTeam);
router.get('/:id',                       getDetail);
router.patch('/:id/status',              updateStatus);
router.patch('/:id/assign',              assign);

export default router;
