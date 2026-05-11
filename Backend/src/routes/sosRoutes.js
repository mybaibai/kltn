import express from 'express';
import { create, getAll, getDetail, getByRequester, getByTeam, updateStatus, assign, patchVictimLocation, cancelSos }
  from '../controllers/sosController.js';
import { requireAuth, attachAuthUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);
router.use(attachAuthUser);

router.post('/',                         create);
router.get('/',                          getAll);
router.get('/requester/:requesterId',    getByRequester);
router.get('/team/:teamId',              getByTeam);
router.patch('/:id/victim-location',      patchVictimLocation);
router.get('/:id',                       getDetail);
router.patch('/:id/status',              updateStatus);
router.patch('/:id/assign',              assign);
router.patch('/:id/cancel',              cancelSos);

export default router;
