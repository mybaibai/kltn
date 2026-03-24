import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js'; // Nhớ đuôi .js
import userRoutes from './routes/userRoutes.js'; // Nhớ đuôi .js

// Load biến môi trường
dotenv.config();

const app = express();

// Middleware quan trọng: Giúp Express hiểu được dữ liệu JSON
// Nếu thiếu dòng này, req.body sẽ bị undefined
app.use(express.json());

// Kết nối Database
connectDB();

// Route gốc
// Mọi request bắt đầu bằng /api/users sẽ đi vào userRoutes
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});