import express from 'express';
import { create, getAll, getDetail, update, toggleActive, remove, getMe, updateProfile }
  from '../controllers/userController.js';
import { requireAuth, attachAuthUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me',                   requireAuth, attachAuthUser, getMe);
router.put('/profile',              requireAuth, attachAuthUser, updateProfile);

router.get('/',                     getAll);
router.get('/:id',                  getDetail);
router.put('/:id',                  update);
router.patch('/:id/toggle-active',  toggleActive);
router.delete('/:id',               remove);

export default router;