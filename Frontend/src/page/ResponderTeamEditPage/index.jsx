import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  Shield,
  UploadCloud,
} from "lucide-react";
import rescueLogo from "@/assets/logorescue.svg";
import { getAllTeams, getTeamDetail, updateTeam } from "@/services/api/apiTeam";
import { getAuthUser } from "@/services/auth/session";
import "./team-edit-page.css";

function initialsFromName(name) {
  if (!name) return "RT";
  const chunks = String(name).trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) return "RT";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0] || ""}${chunks[chunks.length - 1][0] || ""}`.toUpperCase();
}

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
  const [submitMessage, setSubmitMessage] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    phone: "",
    email: "",
    address: "",
    emergencyContact: "",
  });

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

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitMessage) setSubmitMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!team?._id || saving) return;

    setSaving(true);
    setSubmitMessage("");
    try {
      const nextProfile = {
        ...(team?.profile || {}),
        address: form.address,
        emergency_contact: form.emergencyContact,
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
      setSubmitMessage("Đã lưu thay đổi thông tin đội.");
      navigate("/responder/team-info", { replace: true });
    } catch (error) {
      setSubmitMessage(readApiMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const teamName = form.name || "Đội cứu hộ";
  const normalizedStatus = String(team?.status || "").trim().toLowerCase();
  const statusSummary =
    normalizedStatus === "active" || normalizedStatus === "online"
      ? "Đang hoạt động"
      : normalizedStatus
        ? "Đang tạm ngưng"
        : "Chưa có dữ liệu";
  const updatedSummary = formatLastUpdated(team?.updated_at || team?.updatedAt);
  const securitySummary = team?.auth?.email || authUser?.auth?.email || "Mã hóa chuẩn quốc tế";
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
      <div className="team-edit-shell">
        <p className="team-edit-mini-title">Chỉnh sửa thông tin</p>

        <header className="team-edit-topbar">
          <Link to="/responder/team-info" className="team-edit-back-btn" aria-label="Quay lại thông tin đội">
            <ArrowLeft size={16} />
          </Link>

          <div className="team-edit-brand">
            <img className="team-edit-brand-logo" src={rescueLogo} alt="Logo Sentinel Rescue" />
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
            <div className="team-edit-avatar">{initialsFromName(teamName)}</div>
          </div>
        </header>

        <main className="team-edit-content">
          <p className="team-edit-breadcrumb">Cấu hình &gt; <span>Chỉnh sửa thông tin đội</span></p>
          <h1>Cài đặt Đội cứu hộ</h1>
          <p className="team-edit-subtitle">Cập nhật hồ sơ công khai và các thông tin liên hệ khẩn cấp.</p>

          {loadingTeam ? <p className="team-edit-loading">Đang tải dữ liệu đội...</p> : null}
          {teamError ? <p className="team-edit-error">{teamError}</p> : null}
          {submitMessage ? <p className="team-edit-submit-msg">{submitMessage}</p> : null}

          <section className="team-edit-card">
            <div className="team-edit-card-banner" />

            <div className="team-edit-card-head">
              <div className="team-badge-avatar">
                <Shield size={38} />
              </div>

              <button type="button" className="team-avatar-edit" aria-label="Đổi ảnh đại diện">
                <Pencil size={12} />
              </button>

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
                    <input type="text" value={form.email} readOnly />
                    <Mail size={13} />
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
                  <span>Liên hệ khẩn cấp</span>
                  <div className="field-with-icon">
                    <Shield size={13} />
                    <input
                      type="text"
                      value={form.emergencyContact}
                      onChange={(event) => updateField("emergencyContact", event.target.value)}
                      placeholder="Người phụ trách / Hotline"
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
                  <button type="button" className="upload-box-btn">
                    <UploadCloud size={16} />
                    <div>
                      <strong>Tải lên ảnh mới</strong>
                      <p>PNG, JPG tối đa 5MB</p>
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
