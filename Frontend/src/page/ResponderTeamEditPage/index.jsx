import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Clock3,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  UploadCloud,
} from "lucide-react";
import ResponderSidebar from "@/components/responder/ResponderSidebar";
import { getAllTeams, getTeamDetail, updateTeam } from "@/services/api/apiTeam";
import { getAuthUser } from "@/services/auth/session";
import "./team-edit-page.css";
import { getUserAvatarSrc } from "@/lib/userAvatar";


function readApiMessage(error) {
  const message = error?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (error?.code === "ECONNABORTED") return "Kết nối tới server bị timeout";
  return error?.message || "Không thể tải thông tin đội";
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatLastUpdated(value) {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Chưa có dữ liệu";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function ResponderTeamEditPage() {
  const navigate = useNavigate();
  const authUser = useMemo(() => getAuthUser(), []);
  const [team, setTeam] = useState(authUser || null);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toastAlerts, setToastAlerts] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const fileInputRef = useRef(null);
  const toastTimersRef = useRef(new Map());

  const [form, setForm] = useState({
    name: "",
    code: "",
    phone: "",
    email: "",
    address: "",
    emergencyContact: "",
    avatarUrl: "",
  });

  const [notifications, setNotifications] = useState([
    {
      id: "te-1",
      title: "Có nhiệm vụ mới",
      description: "Hệ thống vừa ghi nhận một yêu cầu SOS ưu tiên cao gần bạn.",
      time: "Vừa xong",
      unread: true,
    },
    {
      id: "te-2",
      title: "Chỉnh sửa hồ sơ",
      description: "Bạn có thể cập nhật số điện thoại và khu vực hoạt động ngay tại đây.",
      time: "5 phút trước",
      unread: true,
    },
    {
      id: "te-3",
      title: "Đồng bộ dữ liệu",
      description: "Thông tin đội đã được đồng bộ với bảng nhiệm vụ responder.",
      time: "18 phút trước",
      unread: false,
    },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamProfile() {
      setLoadingTeam(true);
      setTeamError("");

      try {
        const userId = authUser?._id;
        const userEmail = String(authUser?.auth?.email || "").trim().toLowerCase();
        const userPhone = normalizePhone(authUser?.phone || authUser?.auth?.phone);

        let resolvedTeam = null;

        if (userId) {
          try {
            const detailRes = await getTeamDetail(userId);
            resolvedTeam = detailRes?.data?.data || null;
          } catch {
            // Fallback to list API below when direct detail lookup is unavailable.
            resolvedTeam = null;
          }
        }

        if (!resolvedTeam) {
          const listRes = await getAllTeams();
          const teams = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];

          resolvedTeam = teams.find((item) => {
            const itemEmail = String(item?.auth?.email || "").trim().toLowerCase();
            const itemPhone = normalizePhone(item?.phone || item?.auth?.phone);
            return (
              (userId && String(item?._id) === String(userId)) ||
              (userEmail && itemEmail === userEmail) ||
              (userPhone && itemPhone && userPhone === itemPhone)
            );
          }) || null;
        }

        if (!resolvedTeam) {
          throw new Error("Không tìm thấy dữ liệu đội cứu trợ cho tài khoản hiện tại");
        }

        if (!cancelled) {
          setTeam(resolvedTeam);
          setForm({
            name: resolvedTeam?.full_name || "",
            code: resolvedTeam?._id ? `#RS-${String(resolvedTeam._id).slice(-4).toUpperCase()}` : "#RS-—",
            phone: resolvedTeam?.phone || resolvedTeam?.auth?.phone || "",
            email: resolvedTeam?.auth?.email || "",
            address: resolvedTeam?.profile?.address || resolvedTeam?.address || "",
            emergencyContact: resolvedTeam?.profile?.emergency_contact || "",
            avatarUrl: resolvedTeam?.profile?.avatar_url || "",
          });
        }
      } catch (error) {
        if (!cancelled) {
          setTeamError(readApiMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoadingTeam(false);
        }
      }
    }

    loadTeamProfile();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    function handleOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);
  function dismissToast(toastId) {
    setToastAlerts((prev) => prev.filter((item) => item.toastId !== toastId));
    const activeTimer = toastTimersRef.current.get(toastId);
    if (activeTimer) {
      window.clearTimeout(activeTimer);
      toastTimersRef.current.delete(toastId);
    }
  }

  function pushToast(message, type = "error") {
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const alert = {
      toastId,
      message,
      type,
    };
    setToastAlerts((prev) => [alert, ...prev].slice(0, 3));
    const timer = window.setTimeout(() => {
      dismissToast(toastId);
    }, 4500);
    toastTimersRef.current.set(toastId, timer);
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAvatarSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      pushToast("Ảnh quá lớn. Vui lòng chọn file dưới 3MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setForm((prev) => ({ ...prev, avatarUrl: url }));
    };
    reader.readAsDataURL(file);
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (!team?._id || saving) return;

    const teamNameValue = String(form.name || "").trim();
    if (!teamNameValue) {
      pushToast("Vui lòng nhập tên đội.", "error");
      return;
    }

    if (teamNameValue.length > 100) {
      pushToast("Tên đội không được vượt quá 100 ký tự.", "error");
      return;
    }

    const teamNamePattern = /^[\p{L}\d\s]+$/u;
    if (!teamNamePattern.test(teamNameValue)) {
      pushToast("Tên đội không được chứa ký tự đặc biệt.", "error");
      return;
    }

    setSaving(true);
    try {
      const nextProfile = {
        ...(team?.profile || {}),
        address: form.address,
        emergency_contact: form.emergencyContact,
        avatar_url: form.avatarUrl,
      };

      const payload = {
        full_name: form.name,
        phone: form.phone,
        profile: nextProfile,
      };

      const res = await updateTeam(team._id, payload);
      const updatedTeam = res?.data?.data;
      if (updatedTeam) {
        setTeam(updatedTeam);
        try {
          localStorage.setItem("auth_user", JSON.stringify(updatedTeam));
        } catch {
          /* ignore */
        }
      }
      pushToast("Đã lưu thay đổi thông tin đội.", "success");
      setTimeout(() => {
        navigate("/responder/team-info");
      }, 500);
    } catch (error) {
      pushToast(readApiMessage(error), "error");
    } finally {
      setSaving(false);
    }
  }

  const avatarUrl = form.avatarUrl || team?.profile?.avatar_url || "";
  const avatarDisplaySrc = getUserAvatarSrc({
    profile: { avatar_url: avatarUrl },
  });
  const teamName = team?.full_name || "Đội cứu hộ";
  const normalizedStatus = String(team?.status || "").trim().toLowerCase();
  const statusSummary =
    normalizedStatus === "active" || normalizedStatus === "online"
      ? "Đang hoạt động"
      : normalizedStatus
        ? "Đang tạm ngưng"
        : "Chưa có dữ liệu";
  const updatedSummary = formatLastUpdated(team?.updated_at || team?.updatedAt);
  const securitySummary = team?.auth?.email || authUser?.auth?.email || "Mã hóa chuẩn quốc tế";
  const unreadCount = notifications.filter((item) => item.unread).length;

  function handleToggleNotifications() {
    setShowNotifications((prev) => {
      const next = !prev;
      if (next) {
        setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
      }
      return next;
    });
  }

  return (
    <div className="team-edit-page">
      <ResponderSidebar active="team" />

      <div className="team-edit-shell">
        <header className="team-edit-topbar team-edit-topbar--simple">
          <div className="team-edit-title-group">
            <h1>Cài đặt Đội cứu hộ</h1>
            <Link to="/responder/team-info" className="team-edit-back-btn" aria-label="Quay lại thông tin đội">
              <ArrowLeft size={16} />
            </Link>
          </div>

          <div className="team-edit-topbar-user">
            <div className="team-edit-notification-wrap" ref={notificationRef}>
              <button
                type="button"
                className="team-edit-bell-btn"
                aria-label="Thông báo"
                onClick={handleToggleNotifications}
                aria-expanded={showNotifications}
                aria-haspopup="menu"
              >
                <Bell size={14} />
                {unreadCount > 0 ? <span className="team-edit-bell-dot">{unreadCount}</span> : null}
              </button>

              {showNotifications ? (
                <ul className="team-edit-notification-menu" role="menu" aria-label="Thông báo đội cứu trợ">
                  {notifications.map((item) => (
                    <li key={item.id} className={`team-edit-notification-item ${item.unread ? "is-unread" : ""}`}>
                      <div className="team-edit-notification-head">
                        <strong>{item.title}</strong>
                        <span>{item.time}</span>
                      </div>
                      <p>{item.description}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="team-edit-user-meta">
              <p>{team?.auth?.email || authUser?.auth?.email || "Sentinel Admin"}</p>
              <span>Đang trực</span>
            </div>
            <div className="team-edit-avatar">
              <img src={avatarDisplaySrc} alt={teamName} className="team-edit-avatar-img" />
            </div>
          </div>
        </header>

        <main className="team-edit-content">
          <p className="team-edit-subtitle">Cập nhật hồ sơ công khai và các thông tin liên hệ khẩn cấp.</p>

          {loadingTeam ? <p className="team-edit-loading">Đang tải dữ liệu đội...</p> : null}
          {teamError ? <p className="team-edit-error">{teamError}</p> : null}

          <div className="team-edit-toasts-container">
            {toastAlerts.map((alert) => (
              <div key={alert.toastId} className={`team-edit-toast team-edit-toast--${alert.type}`}>
                <span>{alert.message}</span>
                <button
                  type="button"
                  className="team-edit-toast-close"
                  onClick={() => dismissToast(alert.toastId)}
                  aria-label="Đóng thông báo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <section className="team-edit-card">
            <div className="team-edit-card-banner" />

            <div className="team-edit-card-head">
              <div className="team-badge-avatar-wrap">
                <div className="team-badge-avatar">
                  <img src={avatarDisplaySrc} alt={teamName} className="team-badge-avatar-img" />
                </div>
                <button
                  type="button"
                  className="team-avatar-edit"
                  aria-label="Đổi ảnh đại diện"
                  onClick={handleAvatarClick}
                >
                  <Pencil size={12} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarSelect}
                />
              </div>

              <div className="team-head-meta">
                <h2>{teamName}</h2>
                <span>{form.code || "#RS-—"}</span>
              </div>
            </div>

            <form className="team-edit-form" onSubmit={handleSubmit}>
              <div className="team-field-grid">
                <label className="team-field">
                  <span>Tên đội cứu trợ</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="Nhập tên đội cứu trợ"
                  />
                </label>

                <label className="team-field">
                  <span>Mã định danh (ID)</span>
                  <div className="field-with-icon is-readonly">
                    <input type="text" value={form.code} readOnly />
                    <Lock size={13} />
                  </div>
                </label>

                <label className="team-field">
                  <span>Email liên hệ</span>
                  <div className="field-with-icon is-readonly">
                    <Mail size={13} />
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      inputMode="email"
                      required
                      readOnly
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="email@team.com"
                    />
                  </div>
                </label>

                <label className="team-field">
                  <span>Số điện thoại</span>
                  <div className="field-with-icon">
                    <Phone size={13} />
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      placeholder="090 123 4567"
                    />
                  </div>
                </label>

                <label className="team-field">
                  <span>Khu vực hoạt động</span>
                  <div className="field-with-icon">
                    <MapPin size={13} />
                    <input
                      type="text"
                      value={form.address}
                      onChange={(event) => updateField("address", event.target.value)}
                      placeholder="Quận 1, TP. Hồ Chí Minh"
                    />
                  </div>
                </label>

                <div className="team-field">
                  <span>Ảnh đại diện mới</span>
                  <button type="button" className="upload-box-btn" onClick={handleAvatarClick}>
                    <UploadCloud size={16} />
                    <div>
                      <strong>Tải lên ảnh mới</strong>
                      <p>{avatarUrl ? "Ảnh đã chọn sẵn sàng lưu" : "PNG, JPG tối đa 5MB"}</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="team-form-actions">
                <button type="button" className="btn-cancel" onClick={() => navigate("/responder/team-info")}>
                  Hủy
                </button>
                <button type="submit" className="btn-save" disabled={saving || loadingTeam || !team?._id}>
                  <Save size={14} /> {saving ? "Đang lưu" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </section>

          <section className="team-edit-footnotes">
            <article>
              <h3>Trạng thái xác thực</h3>
              <p>{statusSummary}</p>
            </article>
            <article>
              <h3>Lần cuối cập nhật</h3>
              <p>{updatedSummary}</p>
            </article>
            <article>
              <h3>Bảo mật dữ liệu</h3>
              <p>{securitySummary}</p>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
