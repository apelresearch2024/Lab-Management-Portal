import express from 'express';
import { getConsumables, requestConsumables, updateConsumableStatus} from '../controllers/consumablesController.js';
import { authenticateToken } from '../middleware/authMiddleWare.js'; 

const consumableRouter = express.Router();

// Route pathways pointing directly to our controller functions
consumableRouter.get('/', authenticateToken, getConsumables);
consumableRouter.post('/request', authenticateToken, requestConsumables);
consumableRouter.put('/update-status', authenticateToken, updateConsumableStatus);

export default consumableRouter;