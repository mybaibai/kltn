/**
 * Đặt vị trí cố định cho tài khoản rescue (test) — ví dụ gần 15 Ngô Thì Hương, Đà Nẵng.
 * Usage: node scripts/seedRescueLocation.js [email]
 * Default email: rescue@ctkltn.local
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/userModel.js";
import UserLocation from "../src/models/userLocationModel.js";

dotenv.config();

// Tọa độ xấp xỉ: 15 Ngô Thì Hương, Hải Châu, Đà Nẵng (OSM)
const DEFAULT_LNG = 108.2172;
const DEFAULT_LAT = 16.0591;

async function main() {
  const email = (process.argv[2] || "rescue@ctkltn.local").trim().toLowerCase();
  if (!process.env.MONGO_URI) {
    console.error("Thiếu MONGO_URI trong .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ "auth.email": email });
  if (!user) {
    console.error(`Không tìm thấy user với email: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  await UserLocation.findOneAndUpdate(
    { user_id: user._id },
    {
      user_id: user._id,
      location: { type: "Point", coordinates: [DEFAULT_LNG, DEFAULT_LAT] },
      updated_at: new Date(),
    },
    { upsert: true, new: true }
  );
  console.log(`OK — đã đặt vị trí rescue ${email} tại [lng=${DEFAULT_LNG}, lat=${DEFAULT_LAT}] (15 Ngô Thì Hương, Đà Nẵng)`);
  console.log(`user_id=${user._id}`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
