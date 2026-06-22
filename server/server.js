import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import consumablesRoutes from './routes/consumableRoutes.js';
import equipmentRoutes from './routes/equipmentRoutes.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Universal Middlewares
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
// Specialized Modular Route Registrations
app.use('/api', authRoutes);                  // Mounts login to /api/login
app.use('/api/consumables', consumablesRoutes); // Mounts paths to /api/consumables and /api/consumables/request
app.use('/api/equipments', equipmentRoutes);
// Start Application Server
app.listen(PORT, () => {
  console.log(`🚀 Clean Modular Server listening on http://localhost:${PORT}`);
});