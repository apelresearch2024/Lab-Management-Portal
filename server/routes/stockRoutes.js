import express from 'express';
import { getStocks, uploadStocks, adjustStockQuantity } from '../controllers/stockController.js';
import { authenticateToken } from '../middleware/authMiddleWare.js'; 

const stockRouter = express.Router();

stockRouter.get('/', authenticateToken, getStocks);
stockRouter.post('/upload', authenticateToken, uploadStocks);
stockRouter.put('/adjust', authenticateToken, adjustStockQuantity);

export default stockRouter;