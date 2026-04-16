import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Mail, LockKeyhole, Eye, EyeOff, ArrowRight } from "lucide-react";
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
            <div className="staff-brand-icon">
              <ShieldCheck size={24} strokeWidth={2.2} />
            </div>
            <h1>He thong cuu tro</h1>
          </div>

          <h2 className="staff-auth-title">Dang nhap he thong</h2>
          <p className="staff-auth-subtitle">Bang dieu khien danh cho Quan tri vien - Doi cuu tro -</p>

          <form onSubmit={handleSubmit}>
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

            <label className="staff-auth-label" htmlFor="staff-login-password">Mat khau</label>
            <div className="staff-auth-field">
              <LockKeyhole size={18} />
              <input
                id="staff-login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhap mat khau"
              />
              <button
                className="staff-toggle-password"
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "An mat khau" : "Hien thi mat khau"}
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
                Ghi nho mat khau
              </label>
              <button className="staff-forgot-link" type="button">
                Quen mat khau?
              </button>
            </div>

            {errorMessage ? <p className="staff-auth-error">{errorMessage}</p> : null}

            <button className="staff-auth-submit" type="submit" disabled={loading}>
              {loading ? "Dang xu ly..." : (
                <span className="staff-submit-inner">
                  Dang nhap <ArrowRight size={24} style={{ verticalAlign: "-3px" }} />
                </span>
              )}
            </button>
          </form>

          <div className="staff-auth-divider" />
          <p style={{ margin: "0 0 12px", fontSize: 13, textAlign: "center" }}>
            <Link to="/sos" style={{ color: "#2563eb", fontWeight: 600 }}>
              ← Trang SOS (nạn nhân)
            </Link>
          </p>
          <div className="staff-auth-footer">
            <div>Ban gap van de khi truy cap?</div>
            <button type="button">Lien he ky thuat he thong</button>
          </div>
        </section>
      </div>
    </div>
  );
}
