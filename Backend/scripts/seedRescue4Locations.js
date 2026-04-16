import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/userModel.js";
import UserLocation from "../src/models/userLocationModel.js";

dotenv.config();

const RESCUE_ACCOUNTS = [
  {
    email: "rescue.hoang.van.thu@example.com",
    password: "Rescue@123",
    full_name: "Rescue Hoàng Văn Thụ",
    address: "120 Hoàng Văn Thụ, Hải Châu, Đà Nẵng",
    location: [108.218, 16.078],
  },
  {
    email: "rescue.ngo.thi.huong@example.com",
    password: "Rescue@123",
    full_name: "Rescue Ngô Thị Hương",
    address: "15 Ngô Thị Hương, Hải Châu, Đà Nẵng",
    location: [108.217, 16.059],
  },
  {
    email: "rescue.ton.dan@example.com",
    password: "Rescue@123",
    full_name: "Rescue Tôn Đản",
    address: "15 Tôn Đản, Thanh Khê, Đà Nẵng",
    location: [108.232, 16.072],
  },
  {
    email: "rescue.da.son@example.com",
    password: "Rescue@123",
    full_name: "Rescue Đà Sơn",
    address: "72 Đà Sơn, Hải Châu, Đà Nẵng",
    location: [108.225, 16.095],
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

  console.log("Seeding 4 rescue accounts with fixed locations in Đà Nẵng...\n");
  
  for (const account of RESCUE_ACCOUNTS) {
    const user = await upsertRescueAccount(account);
    console.log(`✅ ${user.full_name}`);
    console.log(`   Email: ${user.auth.email}`);
    console.log(`   Địa chỉ: ${account.address}`);
    console.log(`   Vị trí: [lng=${account.location[0]}, lat=${account.location[1]}]`);
    console.log(`   ID: ${user._id}\n`);
  }

  await mongoose.disconnect();
  console.log("Done!");
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
