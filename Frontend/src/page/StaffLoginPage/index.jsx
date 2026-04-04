import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StaffLoginPanel from "@/components/auth/StaffLoginPanel";
import { loginWithEmailPassword } from "@/services/auth/staffAuth";
import { getRoleHomePath, saveStaffSession } from "@/services/auth/session";

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit({ email, password }) {
    setErr("");
    setLoading(true);
    try {
      const data = await loginWithEmailPassword({ email, password });
      saveStaffSession(data.token, data.user);
      navigate(getRoleHomePath(data.user?.role), { replace: true });
    } catch (error) {
      setErr(error?.message || "Dang nhap that bai");
    } finally {
      setLoading(false);
    }
  }

  return <StaffLoginPanel onSubmit={submit} loading={loading} errorMessage={err} />;
}
