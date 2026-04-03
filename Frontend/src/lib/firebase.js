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

// Nếu bạn chạy Firebase Auth Emulator (không cần Blaze), bật chế độ connect emulator.
// Thêm vào `Frontend/.env` (ví dụ):
// VITE_FIREBASE_AUTH_EMULATOR_HOST=http://localhost:9099
const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost) {
  connectAuthEmulator(auth, emulatorHost);
  // Khi emulator bật, có thể tắt verification để dev không bị yêu cầu billing/SMS.
  // Lưu ý: chỉ áp dụng cho môi trường dev/testing.
  try {
    auth.settings.appVerificationDisabledForTesting = true;
  } catch {
    // ignore
  }
}

// Tùy chọn: khi bạn dùng "test phone number" thì có thể tắt app verification để bớt phụ thuộc reCAPTCHA.
// Thêm vào `Frontend/.env`:
// VITE_FIREBASE_APP_VERIFICATION_DISABLED_FOR_TESTING=true
const disableForTesting = import.meta.env.VITE_FIREBASE_APP_VERIFICATION_DISABLED_FOR_TESTING;
if (String(disableForTesting).toLowerCase() === "true") {
  try {
    auth.settings.appVerificationDisabledForTesting = true;
  } catch {
    // ignore
  }
}
