import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import sosRoutes from "./routes/sosRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import trackingRoutes from "./routes/trackingRoutes.js";
import * as trackingService from "./services/trackingService.js";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { firebaseAdminAuth } from "./config/firebaseAdmin.js";

function normalizeSocketRole(role) {
  const value = String(role || "").trim().toUpperCase();
  if (!value) return null;
  if (value === "RESPONDER" || value === "RESCUE") return "RESCUE";
  if (value === "VICTIM") return "VICTIM";
  if (value === "ADMIN") return "ADMIN";
  if (value === "STAFF") return "STAFF";
  return value;
}

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

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: false,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

connectDB();

app.use("/api/users", userRoutes);
app.use("/api/user", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tracking", trackingRoutes);

app.get("/", (_, res) => res.json({ message: "✅ SOS API đang chạy" }));

// ===== SOCKET.IO MIDDLEWARE =====
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const userId = socket.handshake.auth.userId;
  const userRole = socket.handshake.auth.userRole;

  console.log(`🔐 Socket auth middleware - userId: ${userId}, userRole: ${userRole}, hasToken: ${!!token}`);

  if (!token) {
    console.log("⚠️ Socket connected without token");
    socket.userId = userId;
    socket.userRole = userRole;
    console.log(`📝 Socket set to - userId: ${socket.userId}, role: ${socket.userRole}`);
    return next();
  }

  try {
    // 1. Thử verify bằng Firebase
    try {
      const decodedToken = await firebaseAdminAuth.verifyIdToken(token);
      // Ưu tiên dùng MongoDB _id từ handshake, fallback về Firebase UID
      socket.userId = userId || decodedToken.uid;
      socket.userRole = normalizeSocketRole(userRole || "VICTIM");
      console.log(`✅ Firebase verified - userId: ${socket.userId}, role: ${socket.userRole}`);
      return next();
    } catch (fbErr) {
      // Không phải Firebase token, chuyển sang thử JWT
    }

    // 2. Thử verify bằng JWT nội bộ
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const decoded = jwt.verify(token, secret);
        socket.userId = decoded.sub || userId;
        socket.userRole = normalizeSocketRole(decoded.role || userRole);
        console.log(`✅ JWT verified - userId: ${socket.userId}, role: ${socket.userRole}`);
        return next();
      } catch (jwtErr) {
        // Token không hợp lệ
      }
    }

    // Fallback nếu verify thất bại nhưng vẫn cho kết nối (hoặc có thể block tùy security)
    socket.userId = userId;
    socket.userRole = normalizeSocketRole(userRole);
    console.log(`⚠️ Fallback - userId: ${socket.userId}, role: ${socket.userRole}`);
    next();
  } catch (err) {
    console.error("❌ Socket auth middleware error:", err.message);
    next();
  }
});

// ===== SOCKET.IO EVENTS =====
io.on("connection", (socket) => {
  socket.userRole = normalizeSocketRole(socket.userRole);
  console.log(`✅ Socket connected: ${socket.id} (User: ${socket.userId}, Role: ${socket.userRole})`);

  // === Join rooms by role ===
  if (socket.userRole === "VICTIM") {
    socket.join(`victim-${socket.userId}`);
    console.log(
      `👤 Victim ${socket.userId} joined room victim-${socket.userId}`,
    );
  }

  if (socket.userRole === "RESCUE") {
    socket.join(`rescue-${socket.userId}`);
    socket.join("rescue-all");
    console.log(
      `🚑 Rescue ${socket.userId} joined room rescue-${socket.userId} + rescue-all (Role: ${socket.userRole})`,
    );
    console.log(`📊 Sockets in rescue-all room:`, io.sockets.adapter.rooms.get("rescue-all")?.size || 0);
  }

  if (socket.userRole === "ADMIN" || socket.userRole === "STAFF") {
    socket.join("admin-dashboard");
    console.log(`🛡️ Admin joined admin-dashboard`);
  }

  // === Responder location update ===
  socket.on("responder_location_update", async (data) => {
    try {
      const { assignment_id, latitude, longitude } = data;
      console.log("📍 Location update:", {
        assignment_id,
        latitude,
        longitude,
      });

      // Gọi tracking service
      const result = await trackingService.updateRescueLocation(
        assignment_id,
        latitude,
        longitude,
        socket.userId,
      );

      if (!result.success) {
        socket.emit("error", { message: result.message });
        return;
      }

      // Load SOS để lấy victim_id
      const SosRequest = (await import("./models/sosRequestModel.js")).default;
      const RescueAssignment = (
        await import("./models/rescueAssignmentModel.js")
      ).default;
      const assignment = await RescueAssignment.findById(assignment_id);
      const sos = await SosRequest.findById(assignment.request_id);

      const trackingData = {
        assignment_id,
        stage: result.assignment.stage,
        distance_km: result.distance_km,
        eta_minutes: result.eta_minutes,
        rescue_location: result.assignment.current_location,
        victim_location: sos.location,
        stage_changed: result.stage_changed,
        timestamp: new Date(),
      };

      // 📢 Broadcast to VICTIM
      io.to(`victim-${sos.victim_id}`).emit("victim_tracking_update", {
        stage: result.assignment.stage,
        distance_km: result.distance_km,
        eta_minutes: result.eta_minutes,
        rescue_location: result.assignment.current_location,
        stage_changed: result.stage_changed,
        timestamp: new Date(),
      });

      // 📢 Broadcast to RESCUE (confirm)
      socket.emit("mission_location_confirmed", {
        distance_km: result.distance_km,
        eta_minutes: result.eta_minutes,
        victim_location: sos.location,
        current_stage: result.assignment.stage,
      });

      // 📢 Broadcast to ADMIN
      if (result.stage_changed) {
        io.to("admin-dashboard").emit("stage_changed", {
          assignment_id,
          request_id: assignment.request_id,
          stage: result.assignment.stage,
          distance_km: result.distance_km,
          timestamp: new Date(),
        });
      } else {
        io.to("admin-dashboard").emit("location_update", {
          assignment_id,
          request_id: assignment.request_id,
          distance_km: result.distance_km,
          eta_minutes: result.eta_minutes,
          timestamp: new Date(),
        });
      }
    } catch (err) {
      console.error("❌ Error in location update:", err.message);
      socket.emit("error", { message: err.message });
    }
  });

  // === Responder stage change ===
  socket.on("responder_stage_change", async (data) => {
    try {
      const { assignment_id, new_stage, reason } = data;
      console.log("🔄 Stage change:", { assignment_id, new_stage });

      // Gọi tracking service
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

      // Load SOS để lấy victim_id
      const RescueAssignment = (
        await import("./models/rescueAssignmentModel.js")
      ).default;
      const SosRequest = (await import("./models/sosRequestModel.js")).default;
      const assignment = await RescueAssignment.findById(assignment_id);
      const sos = await SosRequest.findById(assignment.request_id);

      const stageChangeData = {
        assignment_id,
        request_id: assignment.request_id,
        prev_stage: result.prev_stage,
        new_stage: result.new_stage,
        timestamp: new Date(),
      };

      // 📢 Broadcast to VICTIM
      io.to(`victim-${sos.victim_id}`).emit("victim_tracking_update", {
        stage: result.new_stage,
        stage_changed: true,
        timestamp: new Date(),
      });

      // 📢 Broadcast to RESCUE
      socket.emit("mission_stage_update", {
        stage: result.new_stage,
        stage_changed: true,
        message: `Stage: ${result.prev_stage} → ${result.new_stage}`,
      });

      // 📢 Broadcast to ADMIN
      io.to("admin-dashboard").emit("stage_changed", stageChangeData);
    } catch (err) {
      console.error("❌ Error in stage change:", err.message);
      socket.emit("error", { message: err.message });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`📡 Socket.IO: ws://localhost:${PORT}`);
});

export { io, app };