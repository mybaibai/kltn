import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import sosRoutes from "./routes/sosRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";

dotenv.config();

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser()); 

connectDB();

app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/auth", authRoutes);

app.get("/", (_, res) => res.json({ message: "✅ SOS API đang chạy" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
