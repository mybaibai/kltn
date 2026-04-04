import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "@/lib/firebase";

let confirmationResult = null;
let recaptchaVerifier = null;

function getOrCreateRecaptcha() {
  if (recaptchaVerifier) return recaptchaVerifier;
  // Nếu popup đã unmount/remount, DOM `recaptcha-container` có thể thay đổi.
  // Bắt buộc tạo lại verifier khi container không tồn tại.
  if (typeof document !== "undefined") {
    const el = document.getElementById("recaptcha-container");
    if (!el) return null;
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "invisible",
  });
  return recaptchaVerifier;
}

export async function sendOtp(phoneE164) {
  // OTP session có thể bị "kẹt" giữa các lần đăng nhập (đặc biệt sau logout/popup remount).
  // Tạo verifier mới mỗi lần gửi OTP để tránh lỗi DOM/reCAPTCHA stale.
  recaptchaVerifier = null;

  // Khi bật Firebase Auth Emulator + `appVerificationDisabledForTesting`,
  // có thể gửi OTP mà không cần reCAPTCHA/billing thật.
  const verificationDisabled = Boolean(auth?.settings?.appVerificationDisabledForTesting);
  if (verificationDisabled) {
    confirmationResult = await signInWithPhoneNumber(auth, phoneE164);
    return true;
  }

  const verifier = getOrCreateRecaptcha();
  if (!verifier) {
    throw new Error("reCAPTCHA container chưa sẵn sàng. Vui lòng thử lại.");
  }
  await verifier.render();
  confirmationResult = await signInWithPhoneNumber(auth, phoneE164, verifier);
  return true;
}

export async function confirmOtp(code) {
  if (!confirmationResult) {
    throw new Error("OTP session not initialized. Call sendOtp first.");
  }
  const cred = await confirmationResult.confirm(code);
  const idToken = await cred.user.getIdToken();
  return { idToken, user: cred.user };
}

export function resetOtpSession() {
  confirmationResult = null;
  recaptchaVerifier = null;
}
