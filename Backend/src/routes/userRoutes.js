//Backend/src/routes/userRoutes.js
import express from 'express';
import { create, getAll, getDetail, update, toggleActive, remove }
  from '../controllers/userController.js';

const router = express.Router();

router.get('/',                     getAll);
router.get('/:id',                  getDetail);
router.put('/:id',                  update);
router.patch('/:id/toggle-active',  toggleActive);
router.delete('/:id',               remove);
// router.post('/login', login);
export default router;

