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
  process.env.FRONTEND_URL, 
  'http://localhost:5173'   
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const sanitizedOrigin = origin.replace(/\/$/, "");
    const sanitizedBaseOrigins = baseOrigins
      .filter(Boolean)
      .map(url => url.replace(/\/$/, ""));

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
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', authRoutes);                  
app.use('/api/consumables', consumablesRoutes); 
app.use('/api/equipments', equipmentRoutes);
// Start Application Server
app.listen(PORT, () => {
  console.log(`🚀 Clean Modular Server listening on http://localhost:${PORT}`);
});