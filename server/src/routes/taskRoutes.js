import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

export const taskRouter = Router();

taskRouter.use(authenticate);

taskRouter.get('/', authorize('permission:task.read'), taskController.listTasks);
taskRouter.get('/overdue', authorize('permission:task.read'), taskController.listOverdueTasks);
taskRouter.get('/due-today', authorize('permission:task.read'), taskController.listTasksDueToday);
taskRouter.get('/:id', authorize('permission:task.read'), taskController.getTask);
taskRouter.post('/', authorize('permission:task.write'), taskController.createTask);
taskRouter.patch('/:id/assign', authorize('permission:task.write'), taskController.assignTask);
taskRouter.patch('/:id/complete', authorize('permission:task.write'), taskController.completeTask);
taskRouter.patch('/:id/cancel', authorize('permission:task.write'), taskController.cancelTask);
taskRouter.patch('/:id/escalate', authorize('permission:task.write'), taskController.escalateTask);
