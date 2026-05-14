import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64?.trim();
  if (b64) {
    try {
      const json = Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json);
    } catch (e) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_B64 decode/parse failed: ${e.message}`);
    }
  }

  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch (e) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${e.message}. Tip: minify to one line or use FIREBASE_SERVICE_ACCOUNT_B64.`,
      );
    }
  }

  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const defaultPath = path.join(process.cwd(), "serviceAccountKey.json");
  const serviceAccountPath = configuredPath || defaultPath;
  const resolvedServiceAccountPath = fs.existsSync(serviceAccountPath)
    ? serviceAccountPath
    : defaultPath;

  if (!fs.existsSync(resolvedServiceAccountPath)) {
    throw new Error(
      "Firebase Admin: thiếu credential. Thêm vào .env: FIREBASE_SERVICE_ACCOUNT_B64 (khuyến nghị) hoặc FIREBASE_SERVICE_ACCOUNT_JSON, " +
        "hoặc đặt file serviceAccountKey.json trong thư mục Backend (gitignore). Trên Render: dán cùng biến B64 vào Environment.",
    );
  }

  const raw = fs.readFileSync(resolvedServiceAccountPath, "utf8").trim();
  if (!raw) {
    throw new Error(
      "Firebase service account file is empty — download JSON from Firebase Console → Project settings → Service accounts.",
    );
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${resolvedServiceAccountPath}: ${e.message}`);
    }
    throw e;
  }
}

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const firebaseAdminAuth = admin.auth();

const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost) {
  try {
    firebaseAdminAuth.useEmulator(emulatorHost);
  } catch {
    // ignore (SDK version / host format)
  }
}
