import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, LockKeyhole, Eye, EyeOff, ArrowRight } from "lucide-react";
import staffLogo from "@/assets/logorescue.svg";
import "./staff-login.css";

export default function StaffLoginPanel({ onSubmit, loading, errorMessage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit({ email, password, remember });
  }

  return (
    <div className="staff-auth-page">
      <div className="staff-auth-top-pattern" aria-hidden="true" />
      <div className="staff-auth-shell">
        <section className="staff-auth-card">
          <div className="staff-brand">
            <img className="staff-brand-logo" src={staffLogo} alt="Logo hệ thống cứu trợ" />
          </div>

          <h2 className="staff-auth-title">Đăng nhập hệ thống</h2>
          <p className="staff-auth-subtitle">Bảng điều khiển dành cho Quản trị viên và Đội cứu trợ.</p>

          <form onSubmit={handleSubmit} className="staff-auth-form">
            <label className="staff-auth-label" htmlFor="staff-login-email">Email</label>
            <div className="staff-auth-field">
              <Mail size={18} />
              <input
                id="staff-login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email@example.com"
              />
            </div>

            <label className="staff-auth-label" htmlFor="staff-login-password">Mật khẩu</label>
            <div className="staff-auth-field">
              <LockKeyhole size={18} />
              <input
                id="staff-login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
              />
              <button
                className="staff-toggle-password"
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            <div className="staff-auth-row">
              <label className="staff-checkbox" htmlFor="staff-login-remember">
                <input
                  id="staff-login-remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Ghi nhớ mật khẩu
              </label>
              <button className="staff-forgot-link" type="button">
                Quên mật khẩu?
              </button>
            </div>

            {errorMessage ? <p className="staff-auth-error">{errorMessage}</p> : null}

            <button className="staff-auth-submit" type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : (
                <span className="staff-submit-inner">
                  Đăng nhập <ArrowRight size={20} />
                </span>
              )}
            </button>
          </form>

          <div className="staff-auth-divider" />
          <p className="staff-auth-sos-link">
            <Link to="/sos">
              ← Trang SOS (nạn nhân)
            </Link>
          </p>
          <div className="staff-auth-footer">
            <div>Bạn gặp vấn đề khi truy cập?</div>
            <button type="button">Liên hệ kỹ thuật hệ thống</button>
          </div>
        </section>
      </div>
    </div>
  );
}
