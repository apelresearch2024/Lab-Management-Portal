import express from 'express';
import { requestOTP, verifyOTP, addScholar } from '../controllers/authController.js';
import { authenticateToken, requireProfessor } from '../middleware/authMiddleware.js';

const router = express.Router();

// Publicly Accessible Authentication Endpoints
router.post('/auth/request-otp', requestOTP);
router.post('/auth/verify-otp', verifyOTP);

// Protected Endpoint (Only authorized professors can execute this)
router.post('/auth/add-scholar', authenticateToken, requireProfessor, addScholar);

export default router;