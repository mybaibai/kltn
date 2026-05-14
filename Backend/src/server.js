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

dotenv.config();

/** Origins allowed for REST + Socket.IO (must match browser address bar, including LAN IP). */
function getFrontendCorsOrigins() {
  const defaults =
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173";
  const raw = String(process.env.FRONTEND_ORIGINS || defaults);
  const list = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const single = process.env.FRONTEND_URL?.trim();
  if (single && !list.includes(single)) list.push(single);
  return list;
}

const frontendCorsOrigins = getFrontendCorsOrigins();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: frontendCorsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
  transports: ["websocket", "polling"],
});

function normalizeSocketRole(role) {
  const value = String(role || "").trim().toUpperCase();
  if (!value) return "";
  if (value === "ADMIN") return "ADMIN";
  if (value === "STAFF") return "STAFF";
  if (value === "RESCUE" || value === "RESPONDER") return "RESCUE";
  if (value === "VICTIM") return "VICTIM";
  return value;
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || frontendCorsOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
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

  if (!token) {
    console.log("⚠️ Socket connected without token");
    socket.userId = userId;
    socket.userRole = normalizeSocketRole(userRole);
    return next();
  }

  try {
    // 1. Thử verify bằng Firebase
    try {
      const decodedToken = await firebaseAdminAuth.verifyIdToken(token);
      // Ưu tiên dùng MongoDB _id từ handshake, fallback về Firebase UID
      socket.userId = userId || decodedToken.uid;
      socket.userRole = normalizeSocketRole(userRole || "VICTIM");
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
        return next();
      } catch (jwtErr) {
        // Token không hợp lệ
      }
    }

    // Fallback nếu verify thất bại nhưng vẫn cho kết nối (hoặc có thể block tùy security)
    socket.userId = userId;
    socket.userRole = normalizeSocketRole(userRole);
    next();
  } catch (err) {
    console.error("❌ Socket auth middleware error:", err.message);
    next();
  }
});

// ===== SOCKET.IO EVENTS =====

io.on("connection", (socket) => {
  console.log(`✅ Socket connected: ${socket.id} (User: ${socket.userId})`);

  // === Join rooms by role ===
  if (socket.userRole === "VICTIM") {
    socket.join(`victim-${socket.userId}`);
    console.log(`👤 Victim ${socket.userId} joined room victim-${socket.userId}`);
  }

  if (socket.userRole === "RESCUE" || socket.userRole === "RESPONDER") {
    socket.join(`rescue-${socket.userId}`);
    socket.join("rescue-all");
    console.log(`🚑 Rescue ${socket.userId} joined room rescue-${socket.userId} + rescue-all`);
  }

  if (socket.userRole === "ADMIN" || socket.userRole === "STAFF") {
    socket.join("admin-dashboard");
    console.log(`🛡️ Admin joined admin-dashboard`);
  }

  // ─── NEW: Join SOS-specific room ────────────────────────────────────────────
  // Cả victim và rescue đều emit event này sau khi load trang tracking
  // Room name: "sos-{sosId}" → dùng để broadcast realtime 2 chiều
  socket.on("join_sos_room", ({ sos_id }) => {
    if (!sos_id) return;
    socket.join(`sos-${sos_id}`);
    console.log(`📍 Socket ${socket.id} (${socket.userRole}) joined room sos-${sos_id}`);
  });

  socket.on("leave_sos_room", ({ sos_id }) => {
    if (!sos_id) return;
    socket.leave(`sos-${sos_id}`);
    console.log(`📍 Socket ${socket.id} left room sos-${sos_id}`);
  });

  // ─── Responder location update ───────────────────────────────────────────────
  socket.on("responder_location_update", async (data) => {
    try {
      const { assignment_id, latitude, longitude } = data;
      console.log("📍 Location update:", { assignment_id, latitude, longitude });

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

      const SosRequest = (await import("./models/sosRequestModel.js")).default;
      const RescueAssignment = (await import("./models/rescueAssignmentModel.js")).default;
      const assignment = await RescueAssignment.findById(assignment_id);
      const sos = await SosRequest.findById(assignment.request_id);

      // 📢 Broadcast to VICTIM: rescue location
      io.to(`victim-${sos.victim_id}`).emit("victim_tracking_update", {
        stage: result.assignment.stage,
        distance_km: result.distance_km,
        eta_minutes: result.eta_minutes,
        rescue_location: result.assignment.current_location,
        stage_changed: result.stage_changed,
        timestamp: new Date(),
      });

      // ─── NEW: Broadcast victim location về RESCUE ────────────────────────────
      // Rescue cần biết victim đứng ở đâu để hiển thị trên map
      io.to(`rescue-${socket.userId}`).emit("mission_location_confirmed", {
        distance_km: result.distance_km,
        eta_minutes: result.eta_minutes,
        victim_location: sos.location,   // GeoJSON {type, coordinates:[lng,lat]}
        current_stage: result.assignment.stage,
      });

      // ─── NEW: Broadcast qua sos-room để cả 2 cùng nhận 1 lúc ─────────────────
      io.to(`sos-${sos._id}`).emit("sos_room_update", {
        request_id: assignment.request_id,
        rescue_location: result.assignment.current_location,
        victim_location: sos.location,
        distance_km: result.distance_km,
        eta_minutes: result.eta_minutes,
        stage: result.assignment.stage,
        timestamp: new Date(),
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

  // ─── Responder stage change ──────────────────────────────────────────────────
  socket.on("responder_stage_change", async (data) => {
    try {
      const { assignment_id, new_stage, reason } = data;
      console.log("🔄 Stage change:", { assignment_id, new_stage });

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

      const RescueAssignment = (await import("./models/rescueAssignmentModel.js")).default;
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

      // ─── NEW: Broadcast qua sos-room ─────────────────────────────────────────
      io.to(`sos-${sos._id}`).emit("sos_room_update", {
        request_id: assignment.request_id,
        stage: result.new_stage,
        stage_changed: true,
        timestamp: new Date(),
      });

      // 📢 Broadcast to RESCUE (confirm)
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
