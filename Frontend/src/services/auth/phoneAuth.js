import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "@/lib/firebase";

let confirmationResult = null;
let recaptchaVerifier = null;

function getOrCreateRecaptcha() {
  if (recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "invisible",
  });
  return recaptchaVerifier;
}

export async function sendOtp(phoneE164) {
  const verifier = getOrCreateRecaptcha();
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
}
