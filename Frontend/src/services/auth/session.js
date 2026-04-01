import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

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
  await signOut(auth);
}
