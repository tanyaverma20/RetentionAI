import { Router } from 'express';
import * as searchController from '../controllers/searchController.js';
import { authenticate } from '../middlewares/authenticate.js';

export const searchRouter = Router();

searchRouter.use(authenticate);
searchRouter.get('/', searchController.globalSearch);
