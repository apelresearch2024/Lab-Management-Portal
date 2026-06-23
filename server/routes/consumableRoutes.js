import express from 'express';
import { getConsumables, requestConsumables, updateConsumableStatus} from '../controllers/consumablesController.js';
import { authenticateToken } from '../middleware/authMiddleWare.js'; 

const router = express.Router();

// Route pathways pointing directly to our controller functions
router.get('/', authenticateToken, getConsumables);
router.post('/request', authenticateToken, requestConsumables);
router.put('/update-status', authenticateToken, updateConsumableStatus);

export default router;