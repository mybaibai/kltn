import { ArrowLeft, Bell, Clock3, MapPin, Phone, Save, ShieldCheck, ShieldPlus, UploadCloud, Users } from "lucide-react";

function initialsFromName(name) {
  const chunks = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) return "RT";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0] || ""}${chunks[chunks.length - 1][0] || ""}`.toUpperCase();
}

export default function ResponderTeamEditForm({
  user,
  loading,
  saving,
  errorMessage,
  teamCode,
  onlineLabel,
  form,
  onBack,
  onCancel,
  onRetry,
  onChangeField,
  onSelectAvatar,
  onSubmit,
}) {
  return (
    <div className="team-edit-page">
      <div className="team-edit-shell">
        <header className="team-edit-topbar">
          <button type="button" className="team-edit-back-btn" onClick={onBack} aria-label="Quay lại">
            <ArrowLeft size={16} /> Quay lại
          </button>

          <p className="team-edit-brand">SENTINEL.RESCUE</p>

          <div className="team-edit-profile">
            <button type="button" className="team-edit-bell-btn" aria-label="Thông báo">
              <Bell size={14} />
            </button>
            <div className="team-edit-profile-meta">
              <strong>Sentinel Admin</strong>
              <span>{onlineLabel}</span>
            </div>
            <div className="team-edit-avatar">{initialsFromName(user?.full_name)}</div>
          </div>
        </header>

        <main className="team-edit-content">
          {errorMessage ? (
            <div className="team-edit-inline-error">
              <span>{errorMessage}</span>
              {typeof onRetry === "function" ? (
                <button type="button" onClick={onRetry}>Thử lại</button>
              ) : null}
            </div>
          ) : null}

          <p className="team-edit-breadcrumb">Cấu hình  ›  Chỉnh sửa thông tin đội</p>
          <h1>Cài đặt Đội cứu hộ</h1>
          <p className="team-edit-subtitle">Cập nhật hồ sơ công khai và các thông tin liên hệ khẩn cấp.</p>

          <form className="team-edit-card" onSubmit={onSubmit}>
            <div className="team-edit-banner" />

            <div className="team-edit-head-row">
              <div className="team-edit-logo-wrap">
                <div className="team-edit-logo">
                  <ShieldPlus size={30} />
                </div>
                <label className="team-edit-mini-edit" title="Đổi ảnh đại diện">
                  <input type="file" accept="image/*" onChange={onSelectAvatar} />
                  ✎
                </label>
              </div>

              <div className="team-edit-head-text">
                <h2>{form.name || "Đội cứu hộ"}</h2>
                <span>{teamCode}</span>
              </div>
            </div>

            <div className="team-edit-grid">
              <label>
                <span>Tên đội cứu trợ</span>
                <input
                  value={form.name}
                  onChange={(event) => onChangeField("name", event.target.value)}
                  placeholder="Nhập tên đội"
                  required
                />
              </label>

              <label>
                <span>Mã định danh (ID)</span>
                <input value={teamCode} readOnly />
              </label>

              <label>
                <span>Số điện thoại khẩn cấp</span>
                <div className="team-edit-input-icon">
                  <Phone size={14} />
                  <input
                    value={form.phone}
                    onChange={(event) => onChangeField("phone", event.target.value)}
                    placeholder="Nhập số điện thoại"
                  />
                </div>
              </label>

              <label>
                <span>Quy mô thành viên</span>
                <div className="team-edit-input-icon">
                  <Users size={14} />
                  <select
                    value={form.membersScale}
                    onChange={(event) => onChangeField("membersScale", event.target.value)}
                  >
                    <option value="3 Nhân viên chuyên nghiệp">3 Nhân viên chuyên nghiệp</option>
                    <option value="5 Nhân viên chuyên nghiệp">5 Nhân viên chuyên nghiệp</option>
                    <option value="8 Nhân viên chuyên nghiệp">8 Nhân viên chuyên nghiệp</option>
                    <option value="12 Nhân viên chuyên nghiệp">12 Nhân viên chuyên nghiệp</option>
                  </select>
                </div>
              </label>

              <label>
                <span>Khu vực hoạt động</span>
                <div className="team-edit-input-icon">
                  <MapPin size={14} />
                  <input
                    value={form.address}
                    onChange={(event) => onChangeField("address", event.target.value)}
                    placeholder="Nhập khu vực hoạt động"
                  />
                </div>
              </label>

              <label>
                <span>Ảnh đại diện mới</span>
                <label className="team-edit-upload-box">
                  <input type="file" accept="image/*" onChange={onSelectAvatar} />
                  <UploadCloud size={16} />
                  <div>
                    <strong>{form.avatarFileName || "Tải lên ảnh mới"}</strong>
                    <p>PNG, JPG tối đa 5MB</p>
                  </div>
                </label>
              </label>
            </div>

            <label className="team-edit-desc-wrap">
              <span>Mô tả hoạt động</span>
              <textarea
                value={form.description}
                onChange={(event) => onChangeField("description", event.target.value)}
                rows={4}
                placeholder="Mô tả hoạt động của đội"
              />
            </label>

            <div className="team-edit-actions">
              <button type="button" className="team-edit-cancel" onClick={onCancel}>Hủy</button>
              <button type="submit" className="team-edit-save" disabled={Boolean(saving) || Boolean(loading)}>
                <Save size={14} /> {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>

          <div className="team-edit-footer-cards">
            <article>
              <ShieldCheck size={16} />
              <div>
                <strong>Trạng thái xác thực</strong>
                <p>Đã được kiểm duyệt</p>
              </div>
            </article>
            <article>
              <Clock3 size={16} />
              <div>
                <strong>Lần cuối cập nhật</strong>
                <p>Hôm nay, lúc 08:45 AM</p>
              </div>
            </article>
            <article>
              <ShieldPlus size={16} />
              <div>
                <strong>Bảo mật dữ liệu</strong>
                <p>Mã hóa chuẩn quốc tế</p>
              </div>
            </article>
          </div>
        </main>
      </div>
    </div>
  );
}
