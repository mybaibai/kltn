// Backend/scripts/seedRescueTestData.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/userModel.js";
import UserLocation from "../src/models/userLocationModel.js";

dotenv.config();

const RESCUE_TEST_ACCOUNTS = [
  {
    email: "smoke.responder.check@example.com",
    password: "SmokeTest@123",
    full_name: "Smoke Responder Check",
    address: "12 Gò Vấp, Hồ Chí Minh",
    location: [106.6867, 10.8415],
  },
  {
    email: "rescue@example.com",
    password: "RescueTest@123",
    full_name: "Rescue Team",
    address: "15 Ngô Thì Nhậm, Đà Nẵng",
    location: [108.2172, 16.0591],
  },
  {
    email: "huy13@gmail.com",
    password: "Huydepz@i",
    full_name: "Huy13 Rescue",
    address: "15 Ngô Thì Nhậm, Đà Nẵng",
    location: [108.2172, 16.0591],
  },
];

async function upsertRescueAccount(account) {
  const email = String(account.email).trim().toLowerCase();
  const password = String(account.password);
  const hash = await bcrypt.hash(password, 10);

  const user = await User.findOneAndUpdate(
    { "auth.email": email },
    {
      $set: {
        full_name: account.full_name,
        role: "Rescue",
        status: "Active",
        auth: {
          type: "Password",
          email,
          password: hash,
          firebase_uid: "",
        },
        profile: {
          avatar_url: "",
          address: account.address,
          emergency_contact: "",
        },
      },
    },
    { upsert: true, new: true }
  );

  await UserLocation.findOneAndUpdate(
    { user_id: user._id },
    {
      user_id: user._id,
      location: {
        type: "Point",
        coordinates: account.location,
      },
      updated_at: new Date(),
    },
    { upsert: true, new: true }
  );

  return user;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("Thiếu MONGO_URI trong .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  for (const account of RESCUE_TEST_ACCOUNTS) {
    const user = await upsertRescueAccount(account);
    console.log(`OK: seed rescue ${user.full_name} <${user.auth.email}> _id=${user._id}`);
    console.log(`  address: ${account.address}`);
    console.log(`  location: [lng=${account.location[0]}, lat=${account.location[1]}]`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

