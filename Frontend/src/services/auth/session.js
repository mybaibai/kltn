import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { resetOtpSession } from "./phoneAuth";

export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback({ user: null, idToken: null });
      return;
    }
    const idToken = await user.getIdToken();
    callback({ user, idToken });
  });
}

export async function logout() {
  // Reset state OTP để lần đăng nhập sau không bị "kẹt" reCAPTCHA/verification.
  try {
    resetOtpSession();
  } catch {
    // ignore
  }
  await signOut(auth);
}

/** Xóa JWT web + auth_user + phiên Firebase (dùng khi đăng xuất toàn phần hoặc chuyển vai). */
export async function clearAllAuth() {
  try {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  } catch {
    /* ignore */
  }
  try {
    resetOtpSession();
  } catch {
    /* ignore */
  }
  try {
    await signOut(auth);
  } catch {
    /* ignore */
  }
}
