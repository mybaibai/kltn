import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { getVictimProfile } from "@/services/auth/session";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getVictimProfile());
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    address: "",
  });
  const firebaseUser = auth.currentUser;
  const phone =
    firebaseUser?.phoneNumber ||
    firebaseUser?.providerData?.[0]?.phoneNumber ||
    "";
    
  useEffect(() => {
    const firebaseUser = auth.currentUser;
  
    if (firebaseUser) {
      const phone =
        firebaseUser.phoneNumber ||
        firebaseUser.providerData?.[0]?.phoneNumber ||
        "";
  
      setUser((prev) => ({
        ...prev,
        phone: phone,
        profile: prev?.profile || {},
      }));
  
      setEditForm((prev) => ({
        ...prev,
        phone: phone,
      }));
    }
  }, []);

  console.log("Firebase user:", auth.currentUser);

  const [shareLocation, setShareLocation] = useState(true);
  const handleSave = async () => {
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          full_name: editForm.full_name,
          phone_secondary: editForm.phone,
          address: editForm.address,
        }),
      });
  
      const data = await res.json();
  
      if (data.success) {
        setUser(data.data);
        setShowEdit(false);
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };
  useEffect(() => {
    const profile = getVictimProfile();
    if (profile) {
      setUser(profile);
      setEditForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        address: profile.profile?.address || "",
      });
    }
  }, []);
  // console.log("User profile:", user);
  
  const toggleShareLocation = async () => {
    const newValue = !shareLocation;
    setShareLocation(newValue);
  
    await fetch("/api/user/profile/location", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ share_location: newValue }),
    });
  };
  const [open, setOpen] = useState(false);
  return (
    <div
      className="min-h-screen bg-[#f3f6fb] flex flex-col"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* ================= HEADER (FULL WIDTH) ================= */}
      <header className="bg-white border-b border-gray-200 w-full sticky top-0 z-30">
        <div className="px-6 h-16 flex items-center justify-between">
          {/* LEFT */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">SOSGo</span>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-full hover:bg-gray-100">
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            <img src={user?.profile?.avatar_url || "/default-avatar.png"} />
          </div>
        </div>
      </header>

      {/* ================= BODY ================= */}
      <div className="flex flex-1">
        {/* SIDEBAR */}
        <div className="w-64 bg-white border-r hidden md:flex flex-col justify-between">
          <div>
            <div className="p-4 flex items-center gap-3 border-b">
              <img
                src={user?.profile?.avatar_url}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="text-sm font-semibold">Guardian User</p>
                <p className="text-xs text-gray-400">Verified Resident</p>
              </div>
            </div>

            <div className="p-3 flex flex-col gap-1">
              {["SOS", "Map", "Contacts", "Profile"].map((item) => (
                <div
                  key={item}
                  className={`px-3 py-2 rounded-lg text-sm cursor-pointer ${
                    item === "Profile"
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4">
            <button className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold">
              ⚠ Trigger SOS
            </button>
          </div>
        </div>

        {/* ================= MAIN (GIỮ FORM NHỎ) ================= */}
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-5xl px-4 py-6">
            <div className="mb-5">
              <button onClick={() => navigate("/") }
                      className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 mb-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                Trở về Trang chủ
              </button>

              <h1 className="text-2xl font-bold text-gray-900">
                Hồ sơ cá nhân
              </h1>

              <p className="text-sm text-gray-400">
                Quản lý thông tin an toàn và y tế của bạn
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* ===== LEFT COLUMN ===== */}
              <div className="lg:col-span-3 flex flex-col gap-5">
                {/* Avatar + Name */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <img
                        src={user?.profile?.avatar_url || "/default-avatar.png"}
                        alt="avatar"
                        className="w-20 h-20 rounded-full object-cover"
                        style={{
                          boxShadow: "0 0 0 3px #fff, 0 0 0 5px #ef4444",
                        }}
                      />
                      <button className="absolute bottom-0 right-0 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition">
                        <svg
                          className="w-3.5 h-3.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-gray-900 truncate">
                        {user?.full_name}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-sm text-gray-500">
                          {user?.phone}
                        </span>
                        {user?.verified && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                            style={{
                              background: "#e6f9f0",
                              color: "#16a34a",
                              border: "1px solid #bbf7d0",
                            }}
                          >
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Đã xác minh
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowEdit(true)}
                        className="mt-2 flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium transition"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Chỉnh sửa
                      </button>
                    </div>
                  </div>
                </div>

                {/* Personal Info */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-red-50 text-red-500 rounded-lg p-1.5">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-800">
                      Thông tin cá nhân
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Họ tên", value: user?.full_name },
                      { label: "Số điện thoại", value: user?.phone },
                      { label: "Ngày sinh", value: "01/01/1990" },
                      { label: "Giới tính", value: "Nam" },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="px-3 py-2.5 bg-gray-50 rounded-r-lg"
                        style={{ borderLeft: "3px solid #ef4444" }}
                      >
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">
                          {label}
                        </p>
                        <p className="text-sm font-semibold text-gray-800">
                          {value}
                        </p>
                      </div>
                    ))}
                    <div
                      className="col-span-2 px-3 py-2.5 bg-gray-50 rounded-r-lg"
                      style={{ borderLeft: "3px solid #ef4444" }}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">
                        Địa chỉ
                      </p>
                      <p className="text-sm font-semibold text-gray-800">
                        {user?.profile?.address || "Chưa cập nhật"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Share Location */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-red-50 text-red-500 rounded-lg p-1.5">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-sm">
                          Chia sẻ vị trí
                        </h3>
                        <p className="text-xs text-gray-400">
                          Cho phép cứu hộ định vị bạn
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareLocation}
                        onChange={() => setShareLocation(!shareLocation)}
                        className="sr-only peer"
                      />
                      <div
                        className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-green-500
                    after:content-[''] after:absolute after:top-0.5 after:left-0.5
                    after:bg-white after:rounded-full after:h-4 after:w-4
                    after:transition-all peer-checked:after:translate-x-full"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* ===== RIGHT COLUMN ===== */}
              <div className="lg:col-span-2 flex flex-col gap-5">
                {/* Emergency Contacts */}
                <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-red-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-red-50 text-red-500 rounded-lg p-1.5">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.25 12 19.79 19.79 0 0 1 1.15 3.42 2 2 0 0 1 3.12 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.5a16 16 0 0 0 6.29 6.29l1.42-1.26a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 16z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-gray-800">
                        Liên hệ khẩn cấp
                      </h3>
                    </div>
                    <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-semibold">
                    {user?.profile?.emergency_contacts?.length || 0} người
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {user?.profile?.emergency_contacts?.map((contact, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-red-50 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <svg
                              className="w-5 h-5 text-red-400"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {contact.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {contact.relation} • {contact.phone}
                            </p>
                          </div>
                        </div>
                        <button className="w-9 h-9 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.25 12 19.79 19.79 0 0 1 1.15 3.42 2 2 0 0 1 3.12 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.5a16 16 0 0 0 6.29 6.29l1.42-1.26a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 16z" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 py-2.5 mt-1 text-sm font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 border border-dashed border-gray-300 hover:border-red-400 rounded-xl transition">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                      Thêm người liên hệ
                    </button>
                    {open && (
                      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                        <div className="w-[360px] bg-white rounded-2xl shadow-xl p-5 relative">
                          
                          {/* Header */}
                          <div className="flex items-center justify-between mb-4">
                            <span className="px-4 py-1.5 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
                              Thêm liên hệ khẩn cấp
                            </span>

                            <button onClick={() => setOpen(false)}>
                              ✕
                            </button>
                          </div>

                          <hr className="mb-4" />

                          {/* Form */}
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700">
                                Họ và tên
                              </label>
                              <input
                                type="text"
                                placeholder="Nhập tên người liên hệ"
                                className="w-full mt-1 p-3 rounded-xl bg-gray-100 outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-sm font-medium text-gray-700">
                                Số điện thoại
                              </label>
                              <input
                                type="text"
                                placeholder="Nhập số điện thoại"
                                className="w-full mt-1 p-3 rounded-xl bg-gray-100 outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-sm font-medium text-gray-700">
                                Mối quan hệ
                              </label>
                              <select className="w-full mt-1 p-3 rounded-xl bg-gray-100 outline-none">
                                <option>Chọn mối quan hệ</option>
                                <option>Bố</option>
                                <option>Mẹ</option>
                                <option>Bạn bè</option>
                              </select>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-3 mt-6">
                            <button className="flex-1 py-3 bg-red-400 hover:bg-red-500 text-white rounded-xl font-semibold">
                              Thêm liên hệ
                            </button>
                            <button
                              onClick={() => setOpen(false)}
                              className="flex-1 py-3 bg-gray-200 text-gray-600 rounded-xl font-semibold"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Health Info */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-red-50 text-red-500 rounded-lg p-1.5">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-800">
                      Thông tin y tế
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Nhóm máu", value: "O+", red: true },
                      { label: "Chiều cao", value: "172 cm" },
                      { label: "Cân nặng", value: "65 kg" },
                      { label: "Dị ứng", value: "Penicillin" },
                    ].map(({ label, value, red }) => (
                      <div
                        key={label}
                        className="px-3 py-2.5 bg-gray-50 rounded-r-lg"
                        style={{ borderLeft: "3px solid #ef4444" }}
                      >
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">
                          {label}
                        </p>
                        <p
                          className={`text-sm font-bold ${
                            red ? "text-red-600" : "text-gray-800"
                          }`}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                    <div
                      className="col-span-2 px-3 py-2.5 bg-gray-50 rounded-r-lg"
                      style={{ borderLeft: "3px solid #ef4444" }}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                        Bệnh nền
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {["Tiểu đường", "Cao huyết áp"].map((b) => (
                          <span
                            key={b}
                            className="text-xs px-2 py-0.5 rounded-md font-semibold"
                            style={{ background: "#fef3c7", color: "#d97706" }}
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* EDIT MODAL */}
        {showEdit && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowEdit(false)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 text-lg">
                  Chỉnh sửa thông tin
                </h3>
                <button
                  onClick={() => setShowEdit(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100"
                >
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  { label: "Họ và tên", key: "full_name" },
                  { label: "Số điện thoại", key: "phone" },
                  { label: "Địa chỉ", key: "address" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {label}
                    </label>
                    <input
                      className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400"
                      value={editForm[key]}
                      onChange={(e) =>
                        setEditForm({ ...editForm, [key]: e.target.value })
                      }
                    />
                  </div>
                ))}
                <button
                  onClick={handleSave}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl transition text-sm mt-1"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
