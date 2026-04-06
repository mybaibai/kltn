import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const defaultPath = path.join(process.cwd(), "serviceAccountKey.json");
const serviceAccountPath = configuredPath || defaultPath;

const resolvedServiceAccountPath = fs.existsSync(serviceAccountPath)
  ? serviceAccountPath
  : defaultPath;

if (!fs.existsSync(resolvedServiceAccountPath)) {
  throw new Error(
    `Firebase service account file not found. Tried: ${serviceAccountPath} and ${defaultPath}. ` +
      "Set FIREBASE_SERVICE_ACCOUNT_PATH in .env or place serviceAccountKey.json in Backend/."
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(resolvedServiceAccountPath, "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const firebaseAdminAuth = admin.auth();

// Nếu bật Firebase Auth Emulator, cấu hình để verify token chạy đúng trong môi trường dev.
// Ví dụ thêm vào Backend/.env:
// FIREBASE_AUTH_EMULATOR_HOST=http://localhost:9099
const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost) {
  try {
    firebaseAdminAuth.useEmulator(emulatorHost);
  } catch {
    // ignore (tùy version SDK / cách host format)
  }
}
