import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Trash2,
  X,
} from "lucide-react";
import ResponderSidebar from "@/components/responder/ResponderSidebar";
import { getAllTeams, getTeamDetail } from "@/services/api/apiTeam";
import { getSosByTeam, updateSosStatus } from "@/services/api/apiSos";
import { getAuthUser } from "@/services/auth/session";
import "./activity-history.css";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function readApiMessage(error) {
  const message = error?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (error?.code === "ECONNABORTED") return "Kết nối tới server bị timeout";
  return error?.message || "Không thể tải lịch sử hoạt động";
}

async function resolveTeamFromUser(authUser) {
  const userId = authUser?._id;
  const userEmail = String(authUser?.auth?.email || "").trim().toLowerCase();
  const userPhone = normalizePhone(authUser?.phone || authUser?.auth?.phone);

  let resolved = null;

  if (userId) {
    try {
      const res = await getTeamDetail(userId);
      resolved = res?.data?.data ?? null;
    } catch {
      resolved = null;
    }
  }

  if (!resolved) {
    const listRes = await getAllTeams();
    const teams = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    resolved = teams.find((item) => {
      const itemEmail = String(item?.auth?.email || "").trim().toLowerCase();
      const itemPhone = normalizePhone(item?.phone || item?.auth?.phone);
      return (
        (userId && String(item?._id) === String(userId)) ||
        (userEmail && itemEmail === userEmail) ||
        (userPhone && itemPhone && userPhone === itemPhone)
      );
    }) ?? null;
  }

  return resolved;
}

function getStatusDisplay(status) {
  const value = normalizeStatus(status);
  if (value === "RESOLVED") return { label: "Đã hoàn thành", className: "status-resolved" };
  if (value === "INPROGRESS" || value === "IN_PROGRESS") return { label: "Đang xử lý", className: "status-inprogress" };
  if (value === "ASSIGNED") return { label: "Đã chấp nhận", className: "status-assigned" };
  if (value === "PENDING") return { label: "Chờ chấp nhận", className: "status-pending" };
  if (value === "CANCELLED") return { label: "Đã hủy", className: "status-cancelled" };
  return { label: value || "Không xác định", className: "status-unknown" };
}

function normalizeStatus(status) {
  const value = String(status || "").toUpperCase();
  if (value === "IN_PROGRESS") return "INPROGRESS";
  return value;
}

function getIncidentTypeBadge(type) {
  const mapping = {
    "Thiên tai": "🌊",
    "Cháy nổ": "🔥",
    "Tai nạn giao thông": "🚗",
    "Sức khỏe": "🏥",
    "Sức khỏe khẩn cấp": "🚑",
    "Lạc đường": "🗺️",
    "Sự cố phương tiện": "🔧",
    "Khác": "📋",
  };
  return mapping[type] || "📌";
}

export default function ResponderActivityHistoryPage() {
  const navigate = useNavigate();
  const authUser = useMemo(() => getAuthUser(), []);
  const userId = authUser?._id;
  const PAGE_SIZE = 5;

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("RESOLVED");
  const [currentPage, setCurrentPage] = useState(1);
  const [cancelLoading, setCancelLoading] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadActivities() {
      setLoading(true);
      setError("");
      try {
        const team = await resolveTeamFromUser(authUser);
        if (!team?._id) throw new Error("Không tìm thấy dữ liệu đội cứu trợ");

        const res = await getSosByTeam(team._id);
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];

        const scoped = list.filter((item) => {
          const assignedRescueId = item?.assigned_rescue_id?._id || item?.assigned_rescue_id;
          if (!userId) return true;
          return !assignedRescueId || String(assignedRescueId) === String(userId);
        });

        if (!cancelled) {
          setActivities(scoped.sort((a, b) => {
            const timeA = new Date(a?.updated_at || a?.created_at || 0).getTime();
            const timeB = new Date(b?.updated_at || b?.created_at || 0).getTime();
            return timeB - timeA;
          }));
        }
      } catch (err) {
        if (!cancelled) setError(readApiMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!authUser) {
      setError("Không thể xác định người dùng hiện tại");
      setLoading(false);
      return () => { cancelled = true; };
    }

    loadActivities();
    return () => { cancelled = true; };
  }, [authUser, userId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, activities.length]);

  async function handleCancelRequest(sosId) {
    if (!sosId) return;
    setCancelLoading(sosId);
    try {
      await updateSosStatus(sosId, "CANCELLED", { reason: "Cancelled by responder" });
      setActivities((prev) =>
        prev.map((item) =>
          String(item._id) === String(sosId) ? { ...item, status: "CANCELLED" } : item,
        ),
      );
    } catch (err) {
      console.error("Failed to cancel request:", err);
    } finally {
      setCancelLoading(null);
    }
  }

  const filteredActivities = useMemo(() => {
    const filterValue = normalizeStatus(filter);
    return activities.filter((item) => {
      const status = normalizeStatus(item?.status);
      return status === filterValue;
    });
  }, [activities, filter]);

  const stats = useMemo(() => {
    return {
      total: activities.length,
      completed: activities.filter((x) => normalizeStatus(x?.status) === "RESOLVED").length,
      cancelled: activities.filter((x) => normalizeStatus(x?.status) === "CANCELLED").length,
    };
  }, [activities]);

  const totalItems = filteredActivities.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedActivities = useMemo(
    () => filteredActivities.slice(startIndex, endIndex),
    [filteredActivities, startIndex, endIndex],
  );
  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages],
  );

  return (
    <div className="activity-history-page">
      <ResponderSidebar active="history" />

      <div className="activity-history-shell">
        <header className="activity-history-topbar">
          <div className="activity-history-title-group">
            <button
              type="button"
              className="activity-history-back-btn"
              onClick={() => navigate("/responder")}
              aria-label="Quay lại trang chủ"
            >
              <ArrowLeft size={16} />
            </button>
            <h1>Lịch sử hoạt động</h1>
          </div>

          <div className="activity-history-topbar-user">
            <button type="button" className="activity-history-bell-btn">
              <Bell size={14} />
            </button>
            <div className="activity-history-user-meta">
              <p>{authUser?.auth?.email || "Sentinel Admin"}</p>
              <span>Đang trực</span>
            </div>
          </div>
        </header>

        <main className="activity-history-content">
          <section className="activity-history-stats">
            <article>
              <div className="stat-icon success">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <strong>{stats.completed}</strong>
                <p>Hoàn thành</p>
              </div>
            </article>
            <article>
              <div className="stat-icon danger">
                <X size={20} />
              </div>
              <div>
                <strong>{stats.cancelled}</strong>
                <p>Đã hủy</p>
              </div>
            </article>
          </section>

          <section className="activity-history-filter">
            <button
              type="button"
              className={`filter-btn ${filter === "RESOLVED" ? "is-active" : ""}`}
              onClick={() => setFilter("RESOLVED")}
            >
              Hoàn thành
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === "CANCELLED" ? "is-active" : ""}`}
              onClick={() => setFilter("CANCELLED")}
            >
              Đã hủy
            </button>
          </section>

          {loading && <p className="activity-history-loading">Đang tải dữ liệu hoạt động...</p>}
          {error && <p className="activity-history-error">{error}</p>}

          <div className="activity-history-list">
            {!loading && !error && totalItems === 0 && (
              <div className="activity-history-empty">
                <p>Chưa có hoạt động nào</p>
              </div>
            )}

            {paginatedActivities.map((item) => {
              const status = getStatusDisplay(item?.status);
              const incidentIcon = getIncidentTypeBadge(item?.incident_type_name);
              const victim = item?.victim_id;
              const victimName = typeof victim === "object" ? victim?.full_name : item?.victim_name || "Không xác định";
              const victimPhone = typeof victim === "object" ? victim?.phone : item?.victim_phone || "—";
              const createdAt = formatDateTime(item?.created_at || item?.createdAt);
              const updatedAt = formatDateTime(item?.updated_at || item?.updatedAt);

              return (
                <article key={item._id} className="activity-history-card">
                  <div className="activity-card-top">
                    <div className="activity-card-left">
                      <span className="activity-incident-icon">{incidentIcon}</span>
                      <div>
                        <h3>{victimName}</h3>
                        <p className="activity-meta">
                          <Phone size={13} /> {victimPhone}
                        </p>
                      </div>
                    </div>
                    <span className={`activity-status-badge ${status.className}`}>{status.label}</span>
                  </div>

                  <p className="activity-incident-type">Loại sự cố: {item?.incident_type_name || "Khác"}</p>
                  <p className="activity-address">
                    <MapPin size={13} /> {item?.address || "Chưa có địa chỉ"}
                  </p>
                  <p className="activity-description">{item?.description || "Không có mô tả"}</p>

                  <div className="activity-card-footer">
                    <div className="activity-times">
                      <span>Tạo: {createdAt}</span>
                      {updatedAt !== createdAt && <span>Cập nhật: {updatedAt}</span>}
                    </div>
                    {normalizeStatus(item?.status) !== "CANCELLED" && (
                      <button
                        type="button"
                        className="activity-cancel-btn"
                        onClick={() => handleCancelRequest(item._id)}
                        disabled={cancelLoading === item._id}
                        title="Hủy yêu cầu này"
                      >
                        {cancelLoading === item._id ? "Hủy..." : <X size={14} />}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {!loading && !error && totalItems > 0 && (
            <div className="activity-pagination">
              <button
                type="button"
                className="page-nav-btn"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage === 1}
              >
                Trước
              </button>

              <div className="activity-pagination-pages">
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`page-btn ${pageNumber === safePage ? "is-active" : ""}`}
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="page-nav-btn"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safePage === totalPages}
              >
                Sau
              </button>

              <span className="activity-pagination-info">
                Hiển thị {startIndex + 1}-{endIndex} / {totalItems}
              </span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
