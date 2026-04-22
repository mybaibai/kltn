// Backend/src/server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";                    // ← THÊM
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import sosRoutes from "./routes/sosRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import trackingRoutes from "./routes/trackingRoutes.js";
import * as trackingService from "./services/trackingService.js";
import cookieParser from "cookie-parser";
import { firebaseAdminAuth } from "./config/firebaseAdmin.js";   // ← THÊM (kiểm tra đường dẫn)

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
  transports: ["websocket", "polling"],
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(cookieParser());

connectDB();

app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tracking", trackingRoutes);

app.get("/", (_, res) => res.json({ message: "✅ SOS API đang chạy" }));

// ==================== SOCKET.IO AUTHENTICATION MIDDLEWARE ====================
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (!token) {
      console.log("⚠️ Socket connected without token");
      return next(new Error("Authentication error: No token provided"));
    }

    const cleanToken = token.replace("Bearer ", "").trim();

    // 1. Thử verify JWT (Rescue / Admin / Staff)
    try {
      const payload = jwt.verify(cleanToken, process.env.JWT_SECRET);
      socket.userId = payload.sub || payload.id || payload.userId;
      socket.userRole = (payload.role || "RESCUE").toUpperCase();
      socket.isAuthenticated = true;
      console.log(`✅ Socket authenticated (JWT): ${socket.userRole} - ${socket.userId}`);
      return next();
    } catch (jwtErr) {
      // JWT thất bại → thử Firebase cho Victim
    }

    // 2. Thử verify Firebase ID Token (Victim)
    try {
      const decodedToken = await firebaseAdminAuth.verifyIdToken(cleanToken);
      socket.userId = decodedToken.uid;
      socket.userRole = "VICTIM";
      socket.isAuthenticated = true;
      console.log(`✅ Socket authenticated (Firebase): VICTIM - ${socket.userId}`);
      return next();
    } catch (firebaseErr) {
      console.error("❌ Socket auth failed for both JWT and Firebase");
      return next(new Error("Authentication error: Invalid token"));
    }
  } catch (err) {
    console.error("Socket middleware error:", err.message);
    return next(new Error("Authentication error"));
  }
});

// ==================== SOCKET.IO EVENTS ====================
io.on("connection", (socket) => {
  console.log(`✅ Socket connected: ${socket.id} | Role: ${socket.userRole} | User: ${socket.userId}`);

  // Join rooms dựa trên role
  if (socket.userRole === "VICTIM" && socket.userId) {
    socket.join(`victim-${socket.userId}`);
    console.log(`👤 Victim joined room: victim-${socket.userId}`);
  }

  if ((socket.userRole === "RESCUE" || socket.userRole === "RESPONDER") && socket.userId) {
    socket.join(`rescue-${socket.userId}`);
    socket.join("rescue-all");
    console.log(`🚑 Rescue joined rooms: rescue-${socket.userId} + rescue-all`);
  }

  if ((socket.userRole === "ADMIN" || socket.userRole === "STAFF") && socket.userId) {
    socket.join("admin-dashboard");
    console.log(`🛡️ Admin/Staff joined admin-dashboard`);
  }

  // === Responder stage change event ===
  socket.on("responder_stage_change", async (data) => {
    try {
      const { assignment_id, new_stage, reason } = data;

      const result = await trackingService.updateRescueStage(
        assignment_id,
        new_stage,
        reason,
        socket.userId,
        socket.userRole,
      );

      if (!result.success) {
        socket.emit("error", { message: result.message });
        return;
      }

      // Load SOS để broadcast cho victim
      const RescueAssignmentModel = (await import("./models/rescueAssignmentModel.js")).default;
      const SosRequestModel = (await import("./models/sosRequestModel.js")).default;

      const assignment = await RescueAssignmentModel.findById(assignment_id);
      if (!assignment) return;

      const sos = await SosRequestModel.findById(assignment.request_id);
      if (!sos) return;

      const stageChangeData = {
        assignment_id,
        request_id: assignment.request_id,
        prev_stage: result.prev_stage,
        new_stage: result.new_stage,
        timestamp: new Date(),
      };

      // Broadcast
      io.to(`victim-${sos.victim_id}`).emit("victim_tracking_update", {
        stage: result.new_stage,
        stage_changed: true,
        timestamp: new Date(),
      });

      socket.emit("mission_stage_update", {
        stage: result.new_stage,
        stage_changed: true,
        message: `Stage: ${result.prev_stage} → ${result.new_stage}`,
      });

      io.to("admin-dashboard").emit("stage_changed", stageChangeData);
    } catch (err) {
      console.error("❌ Error in responder_stage_change:", err.message);
      socket.emit("error", { message: err.message });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO listening on ws://localhost:${PORT}`);
});

export { io, app };