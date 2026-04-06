import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ResponderTeamEditForm from "@/components/responderTeam/ResponderTeamEditForm";
import "@/components/responderTeam/responder-team-edit.css";
import { getAuthUser } from "@/services/auth/session";
import { getTeamDetail, updateTeam } from "@/services/api/apiTeam";

function readErrorMessage(error, fallback) {
  const message = error?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}

function normalizeOnlineLabel(status) {
  return String(status || "").toLowerCase() === "active" ? "ĐANG TRỰC" : "TẠM DỪNG";
}

export default function ResponderTeamEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useMemo(() => getAuthUser(), []);
  const userId = user?._id || user?.id || "";
  const initialProfile = location?.state?.profile || null;
  const initialActive = Boolean(location?.state?.active);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [teamCode, setTeamCode] = useState(initialProfile?.code || "#RS-0000");
  const [onlineLabel, setOnlineLabel] = useState(
    initialProfile?.onlineLabel
      ? String(initialProfile.onlineLabel).toUpperCase()
      : (initialActive ? "ĐANG TRỰC" : "TẠM DỪNG")
  );
  const [form, setForm] = useState({
    name: initialProfile?.name || user?.full_name || "",
    phone: initialProfile?.phone || user?.phone || "",
    membersScale: "5 Nhân viên chuyên nghiệp",
    address: initialProfile?.address || "",
    description: initialProfile?.description || "",
    avatarFileName: "",
  });

  const loadTeam = useCallback(async () => {
    if (!userId) {
      setErrorMessage("Không tìm thấy tài khoản đội cứu trợ trong phiên đăng nhập");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await getTeamDetail(userId);
      const team = response?.data?.data || {};

      setForm((prev) => ({
        ...prev,
        name: team?.full_name || user?.full_name || "",
        phone: team?.phone || team?.auth?.phone || user?.phone || "",
        address: team?.profile?.address || "",
        description: team?.profile?.emergency_contact || "",
      }));
      setTeamCode(`#RS-${String(team?._id || userId).slice(-4).toUpperCase()}`);
      setOnlineLabel(normalizeOnlineLabel(team?.status));
    } catch (error) {
      setErrorMessage(readErrorMessage(error, "Không tải được dữ liệu đội để chỉnh sửa"));
    } finally {
      setLoading(false);
    }
  }, [user?.full_name, user?.phone, userId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const onChangeField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onSelectAvatar = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((prev) => ({ ...prev, avatarFileName: file.name }));
  }, []);

  const onSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!userId || saving) return;

    setSaving(true);
    setErrorMessage("");

    try {
      await updateTeam(userId, {
        full_name: form.name,
        phone: form.phone,
        profile: {
          address: form.address,
          emergency_contact: form.description,
          avatar_url: form.avatarFileName || undefined,
        },
      });
      navigate("/responder/team", { replace: true });
    } catch (error) {
      setErrorMessage(readErrorMessage(error, "Lưu thay đổi thất bại"));
    } finally {
      setSaving(false);
    }
  }, [form.address, form.avatarFileName, form.description, form.name, form.phone, navigate, saving, userId]);

  return (
    <ResponderTeamEditForm
      user={user}
      loading={loading}
      saving={saving}
      errorMessage={errorMessage}
      teamCode={teamCode}
      onlineLabel={onlineLabel}
      form={form}
      onBack={() => navigate(-1)}
      onCancel={() => navigate("/responder/team")}
      onRetry={loadTeam}
      onChangeField={onChangeField}
      onSelectAvatar={onSelectAvatar}
      onSubmit={onSubmit}
    />
  );
}
