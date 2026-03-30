//Backend/src/routes/teamRoutes.js
import express from 'express';
import { getAll, getDetail, create, update, updateLocation, findNearest, remove }
  from '../controllers/teamController.js';

const router = express.Router();

router.get('/nearest',        findNearest);    // ⚠️ phải đặt TRƯỚC /:id
router.get('/',               getAll);
router.get('/:id',            getDetail);
router.post('/',              create);
router.put('/:id',            update);
router.patch('/:id/location', updateLocation);
router.delete('/:id',         remove);

export default router;