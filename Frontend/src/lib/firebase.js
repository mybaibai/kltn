import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

function setAppVerificationDisabledForTesting() {
  try {
    auth.settings.appVerificationDisabledForTesting = true;
  } catch {
    /* ignore */
  }
}

// --- Chế độ dev / không billing ---
// 1) Auth Emulator (khuyên dùng): Frontend/.env
//    VITE_FIREBASE_AUTH_EMULATOR_HOST=http://127.0.0.1:9099
//    (chạy: firebase emulators:start --only auth)
const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost) {
  connectAuthEmulator(auth, emulatorHost, { disableWarnings: true });
  setAppVerificationDisabledForTesting();
}

// 2) Chỉ test trên project thật, không bật billing SMS: thêm số test trong
//    Firebase Console → Authentication → Phone → Phone numbers for testing,
//    rồi bật MỘT trong các dòng sau trong Frontend/.env:
//    VITE_FIREBASE_DEV_TESTING=true
//    hoặc VITE_FIREBASE_APP_VERIFICATION_DISABLED_FOR_TESTING=true
const devTesting =
  String(import.meta.env.VITE_FIREBASE_DEV_TESTING || "").toLowerCase() === "true";
const disableForTesting =
  String(import.meta.env.VITE_FIREBASE_APP_VERIFICATION_DISABLED_FOR_TESTING || "").toLowerCase() ===
  "true";
if (devTesting || disableForTesting) {
  setAppVerificationDisabledForTesting();
}
