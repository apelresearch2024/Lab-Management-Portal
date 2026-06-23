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
const baseOrigins = [
  process.env.FRONTEND_URL, // Your production URL env variable
  'http://localhost:5173'    // Local development environment
];

// 2. Implement dynamic origin checking
const corsOptions = {
  origin: function (origin, callback) {
    // Allow server-to-server requests or tools like Postman (where origin is undefined)
    if (!origin) return callback(null, true);

    // Clean up trailing slashes for robust matching consistency
    const sanitizedOrigin = origin.replace(/\/$/, "");
    const sanitizedBaseOrigins = baseOrigins
      .filter(Boolean)
      .map(url => url.replace(/\/$/, ""));

    // Check if the incoming origin is explicitly listed OR belongs to your Vercel deployments
    const isExplicitlyAllowed = sanitizedBaseOrigins.includes(sanitizedOrigin);
    const isVercelSubdomain = sanitizedOrigin.endsWith('.vercel.app');

    if (isExplicitlyAllowed || isVercelSubdomain) {
      callback(null, true);
    } else {
      console.error(`🛑 CORS Blocked: Request origin '${origin}' not authorized.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // Fixes potential preflight issues on older legacy browsers
};

// 3. Mount the configured middleware
app.use(cors(corsOptions));
app.use(express.json());
// Specialized Modular Route Registrations
app.use('/api', authRoutes);                  // Mounts login to /api/login
app.use('/api/consumables', consumablesRoutes); // Mounts paths to /api/consumables and /api/consumables/request
app.use('/api/equipments', equipmentRoutes);
// Start Application Server
app.listen(PORT, () => {
  console.log(`🚀 Clean Modular Server listening on http://localhost:${PORT}`);
});