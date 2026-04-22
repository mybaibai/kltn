// Frontend/src/services/auth/phoneAuth.js
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "@/lib/firebase";

let confirmationResult = null;
let recaptchaVerifier = null;

function destroyRecaptcha() {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      /* ignore */
    }
    recaptchaVerifier = null;
  }
}

function getOrCreateRecaptcha() {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("recaptcha-container");
  if (!el) return null;

  destroyRecaptcha();
  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "invisible",
  });
  return recaptchaVerifier;
}

/**
 * Firebase yêu cầu luôn có ApplicationVerifier (RecaptchaVerifier).
 * Gọi signInWithPhoneNumber(auth, phone, verifier) — thiếu tham số thứ 3 → auth/argument-error.
 */
export async function sendOtp(phoneE164) {
  const e164 = String(phoneE164 || "").trim();
  if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
    throw new Error("Số điện thoại không đúng định dạng quốc tế (E.164), ví dụ +84901234567.");
  }

  confirmationResult = null;
  destroyRecaptcha();

  const verifier = getOrCreateRecaptcha();
  if (!verifier) {
    throw new Error("reCAPTCHA container chưa sẵn sàng. Vui lòng thử lại.");
  }

  await verifier.render();
  confirmationResult = await signInWithPhoneNumber(auth, e164, verifier);
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
  destroyRecaptcha();
}

