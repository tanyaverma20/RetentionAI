import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import * as hrController from '../controllers/hrController.js';

const router = Router();

// Apply authentication middleware to all HR routes
router.use(authenticate);

// Collection param is one of: attendance, performance, surveys, feedback, notes
router.post('/:collection', hrController.createRecord);
router.get('/:collection', hrController.listRecords);
router.get('/:collection/:id', hrController.getRecord);
router.put('/:collection/:id', hrController.updateRecord);
router.delete('/:collection/:id', hrController.deleteRecord);

export default router;
