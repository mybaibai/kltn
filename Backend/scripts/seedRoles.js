import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/userModel.js";

dotenv.config();

async function upsertStaff({ email, password, role, fullName }) {
  const em = String(email || "")
    .trim()
    .toLowerCase();
  if (!em || !password) throw new Error(`Invalid email/password for ${role}`);

  const hash = await bcrypt.hash(String(password), 10);

  return User.findOneAndUpdate(
    { "auth.email": em },
    {
      $set: {
        role,
        status: "Active",
        full_name: fullName,
        auth: {
          type: "Password",
          email: em,
          password: hash,
        },
      },
      $setOnInsert: {
        profile: { avatar_url: "", address: "", emergency_contact: "" },
      },
    },
    { new: true, upsert: true }
  );
}

async function main() {
  const adminEmail = process.argv[2];
  const adminPass = process.argv[3];
  const rescueEmail = process.argv[4];
  const rescuePass = process.argv[5];

  if (!adminEmail || !adminPass || !rescueEmail || !rescuePass) {
    console.log(
      "Usage: npm run seed:roles -- <admin_email> <admin_password> <rescue_email> <rescue_password>"
    );
    console.log(
      "Example: npm run seed:roles -- admin@x.com secret123 rescue@y.com secret456"
    );
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const admin = await upsertStaff({
    email: adminEmail,
    password: adminPass,
    role: "Admin",
    fullName: "Admin",
  });
  const rescue = await upsertStaff({
    email: rescueEmail,
    password: rescuePass,
    role: "Rescue",
    fullName: "Rescue Team",
  });

  console.log("OK — tài khoản email + mật khẩu:");
  console.log(`  Admin:  ${admin.auth?.email}  _id=${admin._id}`);
  console.log(`  Rescue: ${rescue.auth?.email} _id=${rescue._id}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
