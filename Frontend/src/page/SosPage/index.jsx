// Frontend/src/page/SosPage/index.jsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import { sendSos } from "@/services/api/apiSos";
import LoginRequester from "./LoginRequester";
import SOSForm from "./SOSform";
import { subscribeAuthState, logout } from "@/services/auth/session";

const API = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");

// ── Fix Leaflet icon ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: markerShadowUrl,
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -40],
});

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 16);
  }, [lat, lng, map]);
  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SosPage() {
  const navigate = useNavigate();

  // ── Auth state — chỉ dùng React state, không localStorage ────────────────
  const [user, setUser] = useState(null);         // user từ MongoDB
  const [authReady, setAuthReady] = useState(false); // đã check session xong chưa
  const [showLogin, setShowLogin] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [position, setPosition] = useState(null);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const DEFAULT_CENTER = [16.0544, 108.2022];

  // ── 1. Khi reload trang: check session từ backend (đọc httpOnly cookie) ──
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          setShowLogin(false);
        } else {
          setShowLogin(true);
        }
      })
      .catch(() => setShowLogin(true))
      .finally(() => setAuthReady(true));
  }, []);

  // ── 2. Firebase OTP thành công → verify với backend → backend set cookie ─
  useEffect(() => {
    const unsub = subscribeAuthState(async ({ user: fbUser, idToken }) => {
      if (!fbUser || !idToken) return;
      try {
        const res = await fetch(`${API}/auth/firebase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // backend sẽ set httpOnly cookie ở đây
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) return;
        const data = await res.json();
        // Chỉ lưu user info vào React state, không localStorage
        setUser(data.user || { phone: data.phoneNumber });
        setShowLogin(false);
      } catch {
        // ignore
      }
    });
    return () => unsub?.();
  }, []);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (msg, type = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Đóng user menu khi click ngoài ───────────────────────────────────────
  useEffect(() => {
    const onDocClick = (e) => {
      if (!showUserMenu) return;
      if (e.target?.closest?.("[data-user-menu]")) return;
      setShowUserMenu(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showUserMenu]);

  // ── Lấy GPS ───────────────────────────────────────────────────────────────
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showToast("Trình duyệt không hỗ trợ GPS");
      return;
    }
    setLoadingGPS(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "vi" } }
          );
          const data = await res.json();
          if (data.display_name) address = data.display_name;
        } catch {
          /* giữ tọa độ */
        }
        setPosition({ lat, lng, address });
        setLoadingGPS(false);
      },
      () => {
        setGpsError("Không lấy được vị trí. Hãy cho phép GPS.");
        setLoadingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Mở modal SOS ─────────────────────────────────────────────────────────
  const handleSosClick = () => {
    if (!position) {
      showToast("⚠️ Vui lòng lấy vị trí của bạn trước", "warning");
      return;
    }
    if (!user) {
      setShowLogin(true);
      showToast("Vui lòng đăng nhập để tiếp tục", "warning");
      return;
    }
    setShowModal(true);
  };

  // ── Login thành công từ LoginRequester ────────────────────────────────────
  const handleLoginSuccess = ({ phone, backendUser }) => {
    // backendUser đến từ backend sau khi verify Firebase OTP
    // backend đã set httpOnly cookie, ta chỉ cần lưu user info vào state
    const nextUser = {
      phone,
      ...(backendUser?.user || backendUser || {}),
    };
    setUser(nextUser);
    setShowLogin(false);
    showToast("Xác nhận người dùng thành công", "success");
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await logout(); // Firebase signOut
    } catch {
      // ignore
    }
    // Xóa cookie phía backend
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setUser(null);
    setShowUserMenu(false);
    setShowLogin(true);
    showToast("Đã đăng xuất", "warning");
  };

  // ── Gửi SOS ───────────────────────────────────────────────────────────────
  const handleConfirmSos = async (description) => {
    setSending(true);
    try {
      const res = await sendSos({
        requester_id: user?._id,
        latitude: position.lat,
        longitude: position.lng,
        address: position.address,
        description,
      });
      const sosId = res.data.data._id;
      setShowModal(false);
      navigate(`/tracking/${sosId}`);
    } catch (err) {
      showToast(`Gửi thất bại: ${err?.response?.data?.message || err?.message}`);
      setSending(false);
    }
  };

  // ── Chờ check session xong mới render ────────────────────────────────────
  if (!authReady) return null;

  return (
    <>
      {/* ── Bản đồ full màn hình ─────────────────────────────────────────── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <MapContainer
          center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
          zoom={14}
          scrollWheelZoom
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {position && <RecenterMap lat={position.lat} lng={position.lng} />}
          {position && (
            <Marker position={[position.lat, position.lng]} icon={redIcon}>
              <Popup>📍 Vị trí của bạn</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div id="recaptcha-container" />

      {/* ── Login modal ───────────────────────────────────────────────────── */}
      {showLogin && (
        <LoginRequester
          onConfirm={handleLoginSuccess}
          onClose={() => setShowLogin(false)}
          onCancel={() => setShowLogin(false)}
        />
      )}

      {/* ── SOS Form modal ───────────────────────────────────────────────── */}
      {showModal && (
        <SOSForm
          position={position}
          onConfirm={handleConfirmSos}
          onCancel={() => setShowModal(false)}
          sending={sending}
        />
      )}

      {/* ── Header nổi ───────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: "-0.3px",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          🚨 Hỗ trợ khẩn cấp
        </div>

        {/* ── Avatar / User menu ───────────────────────────────────────── */}
        <div data-user-menu style={{ position: "relative" }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowUserMenu((v) => !v)}
            onKeyDown={(e) => e.key === "Enter" && setShowUserMenu((v) => !v)}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: user
                ? "rgba(220,38,38,0.85)"
                : "rgba(255,255,255,0.2)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              userSelect: "none",
              outline: "none",
              transition: "background 0.2s",
            }}
          >
            👤
          </div>

          {showUserMenu && (
            <div className="absolute right-0 top-[46px] w-64 z-[9999]">
              <div className="bg-white/95 backdrop-blur-xl border border-black/[0.06] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.16)] overflow-hidden">
                <div className="px-4 pt-3 pb-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Tài khoản
                  </span>
                </div>

                {user ? (
                  <>
                    <div className="mx-3 mb-3 rounded-xl bg-gray-50 border border-black/[0.05] px-3 py-3 flex flex-col gap-1">
                      {user.full_name?.trim() && (
                        <span className="text-sm font-black text-gray-900 truncate">
                          {user.full_name}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {user.phone || user.phoneNumber || "—"}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400">Vai trò:</span>
                        <span className="text-[10px] font-black text-gray-900 bg-white border border-black/[0.08] rounded-md px-1.5 py-0.5 uppercase tracking-wide">
                          {user.role || "VICTIM"}
                        </span>
                      </div>
                    </div>
                    <div className="px-3 pb-3">
                      <button
                        onClick={handleLogout}
                        className="w-full rounded-xl px-3 py-2.5 text-sm font-black text-red-800 bg-red-50 hover:bg-red-100 active:scale-[0.98] transition-all duration-150 cursor-pointer border-0"
                      >
                        Đăng xuất
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => { setShowLogin(true); setShowUserMenu(false); }}
                      className="w-full rounded-xl px-3 py-2.5 text-sm font-black text-white bg-red-600 hover:bg-red-700 active:scale-[0.98] transition-all duration-150 cursor-pointer border-0 shadow-sm shadow-red-200"
                    >
                      Đăng nhập
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Panel địa chỉ ────────────────────────────────────────────────── */}
      {position && (
        <div
          style={{
            position: "fixed",
            top: 68,
            left: 12,
            right: 12,
            zIndex: 100,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(12px)",
            borderRadius: 14,
            padding: "10px 14px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            animation: "fadeIn 0.3s ease",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📌</span>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#dc2626",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 2,
              }}
            >
              Vị trí của bạn
            </div>
            <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
              {position.address}
            </div>
          </div>
        </div>
      )}

      {/* ── Nút GPS + Zoom ───────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          right: 14,
          bottom: 140,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <button
          onClick={handleGetLocation}
          disabled={loadingGPS}
          className="top-btn"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: loadingGPS ? "#93c5fd" : "#fff",
            border: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            cursor: loadingGPS ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
          title="Lấy vị trí của tôi"
        >
          {loadingGPS ? (
            <span
              style={{
                width: 20,
                height: 20,
                border: "2.5px solid #93c5fd",
                borderTopColor: "#2563eb",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.8s linear infinite",
              }}
            />
          ) : (
            "📍"
          )}
        </button>

        <button
          className="top-btn"
          style={{
            width: 48, height: 48, borderRadius: "50%", background: "#fff",
            border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            cursor: "pointer", fontSize: 22, fontWeight: 700, color: "#374151",
          }}
          onClick={() => document.querySelector(".leaflet-control-zoom-in")?.click()}
        >
          +
        </button>

        <button
          className="top-btn"
          style={{
            width: 48, height: 48, borderRadius: "50%", background: "#fff",
            border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            cursor: "pointer", fontSize: 22, fontWeight: 700, color: "#374151",
          }}
          onClick={() => document.querySelector(".leaflet-control-zoom-out")?.click()}
        >
          −
        </button>
      </div>

      {/* ── Lỗi GPS ──────────────────────────────────────────────────────── */}
      {gpsError && (
        <div
          style={{
            position: "fixed",
            top: position ? 130 : 68,
            left: 12,
            right: 12,
            zIndex: 100,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            color: "#dc2626",
            animation: "fadeIn 0.3s ease",
          }}
        >
          ⚠️ {gpsError}
        </div>
      )}

      {/* ── Footer SOS button ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 100,
          background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 16,
        }}
      >
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {[0, 0.6, 1.2].map((delay) => (
            <div
              key={delay}
              style={{
                position: "absolute",
                width: 84,
                height: 84,
                borderRadius: "50%",
                border: `2px solid rgba(220,38,38,${0.5 - delay * 0.1})`,
                animation: `pulse-ring 1.8s ease-out infinite ${delay}s`,
              }}
            />
          ))}
          <button
            onClick={handleSosClick}
            className="sos-btn"
            style={{
              position: "relative",
              zIndex: 10,
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(145deg, #ef4444, #b91c1c)",
              border: "3px solid rgba(255,255,255,0.4)",
              boxShadow: "0 6px 30px rgba(220,38,38,0.7), inset 0 1px 0 rgba(255,255,255,0.25)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              transition: "transform 0.15s ease",
            }}
          >
            <span style={{ fontSize: 22 }}>🆘</span>
            <span style={{ color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.5px", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
              SOS
            </span>
          </button>
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9998,
            maxWidth: 320,
            width: "90%",
            background:
              toast.type === "success" ? "#ecfdf5"
              : toast.type === "warning" ? "#fffbeb"
              : "#fef2f2",
            border: `1px solid ${
              toast.type === "success" ? "#6ee7b7"
              : toast.type === "warning" ? "#fcd34d"
              : "#fca5a5"
            }`,
            color:
              toast.type === "success" ? "#065f46"
              : toast.type === "warning" ? "#92400e"
              : "#991b1b",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            animation: "fadeIn 0.3s ease",
            textAlign: "center",
          }}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}