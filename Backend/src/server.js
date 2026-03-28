import express  from 'express';
import dotenv   from 'dotenv';
import cors     from 'cors';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import sosRoutes  from './routes/sosRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/sos',   sosRoutes);

app.get('/', (_, res) => res.json({ message: '✅ SOS API đang chạy' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));