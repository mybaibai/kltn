import { useMemo } from "react";
import { ArrowLeft, Bell, Clock3, Crosshair, MapPin, ShieldPlus, UserCheck, CheckCircle2 } from "lucide-react";

function initialsFromName(name) {
  const chunks = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) return "RT";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0] || ""}${chunks[chunks.length - 1][0] || ""}`.toUpperCase();
}

export default function ResponderTeamDashboard({
  user,
  onBack,
  onEditTeamInfo,
  loading,
  errorMessage,
  onRetry,
  profile,
  missionStats,
  active,
  statusSaving,
  onToggleActive,
}) {
  const safeProfile = useMemo(() => {
    return {
      name: profile?.name || user?.full_name || "Đội Cứu Hộ",
      phone: profile?.phone || user?.phone || "Chưa cập nhật",
      members: Number.isFinite(profile?.members) ? profile.members : 0,
      address: profile?.address || "Chưa cập nhật địa chỉ",
      code: profile?.code || "WRS-0000",
      updatedAtText: profile?.updatedAtText || "Vừa xong",
      onlineLabel: profile?.onlineLabel || (active ? "Online" : "Offline"),
    };
  }, [active, profile, user?.full_name, user?.phone]);

  const safeMission = useMemo(() => {
    return {
      missionDone: Number.isFinite(missionStats?.missionDone) ? missionStats.missionDone : 0,
      onlineToday: missionStats?.onlineToday || "0h 00m",
    };
  }, [missionStats]);

  return (
    <div className="team-mgmt-page">
      <div className="team-mgmt-shell">
        <header className="team-mgmt-topbar">
          <button type="button" className="team-mgmt-back-btn" onClick={onBack} aria-label="Quay lại">
            <ArrowLeft size={16} />
          </button>

          <p className="team-mgmt-brand">SENTINEL.RESCUE</p>

          <div className="team-mgmt-profile">
            <button type="button" className="team-mgmt-bell-btn" aria-label="Thông báo">
              <Bell size={14} />
            </button>
            <div className="team-mgmt-profile-meta">
              <strong>Sentinel Admin</strong>
              <span>ĐANG TRỰC</span>
            </div>
            <div className="team-mgmt-avatar">{initialsFromName(user?.full_name)}</div>
          </div>
        </header>

        <main className="team-mgmt-content">
          {errorMessage ? (
            <div className="team-mgmt-inline-error">
              <span>{errorMessage}</span>
              {typeof onRetry === "function" ? (
                <button type="button" onClick={onRetry}>Thử lại</button>
              ) : null}
            </div>
          ) : null}

          <section className="team-mgmt-title-wrap">
            <h1>Quản lý thông tin đội cứu trợ</h1>
            <p>Cập nhật hồ sơ và điều chỉnh trạng thái hoạt động của đội.</p>
          </section>

          <div className="team-mgmt-grid">
            <section className="team-mgmt-left-col">
              <article className="team-mgmt-card team-mgmt-main-card">
                <div className="team-mgmt-main-head">
                  <div className="team-mgmt-icon-box">
                    <ShieldPlus size={20} />
                  </div>

                  <div>
                    <h2>{safeProfile.name}</h2>
                    <p>
                      <MapPin size={12} /> {safeProfile.address}
                    </p>
                  </div>

                  <span className="team-mgmt-code">{safeProfile.code}</span>

                  <button
                    type="button"
                    className="team-mgmt-edit-btn"
                    onClick={onEditTeamInfo}
                  >
                    Chỉnh sửa thông tin
                  </button>
                </div>

                <div className="team-mgmt-main-stats">
                  <div>
                    <span>SỐ ĐIỆN THOẠI</span>
                    <strong>{safeProfile.phone}</strong>
                  </div>
                  <div>
                    <span>THÀNH VIÊN</span>
                    <strong>{safeProfile.members} Nhân viên chuyên nghiệp</strong>
                  </div>
                </div>
              </article>

              <div className="team-mgmt-kpi-row">
                <article className="team-mgmt-card team-mgmt-kpi-card">
                  <div className="team-mgmt-kpi-icon success">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <strong>{safeMission.missionDone}</strong>
                    <p>Tổng nhiệm vụ hoàn thành</p>
                  </div>
                </article>

                <article className="team-mgmt-card team-mgmt-kpi-card">
                  <div className="team-mgmt-kpi-icon info">
                    <Clock3 size={16} />
                  </div>
                  <div>
                    <strong>{safeMission.onlineToday}</strong>
                    <p>Thời gian online hôm nay</p>
                  </div>
                </article>
              </div>
            </section>

            <section className="team-mgmt-right-col">
              <article className="team-mgmt-card team-mgmt-state-card">
                <p className="team-mgmt-state-label">TRẠNG THÁI HOẠT ĐỘNG</p>
                <h3>{active ? "Đang sẵn sàng nhiệm vụ" : "Tạm ngưng nhiệm vụ"}</h3>

                <button
                  type="button"
                  className={`team-mgmt-toggle ${active ? "is-active" : ""}`}
                  onClick={onToggleActive}
                  disabled={Boolean(statusSaving) || Boolean(loading)}
                >
                  <span className="team-mgmt-toggle-knob">
                    <UserCheck size={14} />
                  </span>
                </button>

                <p className="team-mgmt-state-note">
                  Khi bật trạng thái này, vị trí của bạn sẽ được cập nhật thời gian thực cho hệ thống điều phối.
                </p>

                <div className="team-mgmt-state-meta">
                  <div>
                    <span>Trạng thái gần nhất:</span>
                    <strong>{safeProfile.onlineLabel}</strong>
                  </div>
                  <div>
                    <span>Cập nhật cuối:</span>
                    <strong>{safeProfile.updatedAtText}</strong>
                  </div>
                </div>
              </article>

              <article className="team-mgmt-card team-mgmt-map-card" aria-label="Vị trí hiện tại">
                <div className="team-mgmt-map-art" />
                <p>
                  <Crosshair size={12} /> VỊ TRÍ HIỆN TẠI
                </p>
              </article>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
