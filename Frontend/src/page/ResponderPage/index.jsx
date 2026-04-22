// Frontend/src/page/ResponderPage/index.jsx
import ResponderMissionBoard from "@/components/responder/ResponderMissionBoard";
import { getAuthUser } from "@/services/auth/session";

export default function ResponderPage() {
  const user = getAuthUser();

  return <ResponderMissionBoard user={user} />;
}

