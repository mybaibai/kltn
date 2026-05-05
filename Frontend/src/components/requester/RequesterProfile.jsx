import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import api from "@/services/api/apiSos";
import contactList from "@/assets/contact_list.svg";
import call from "@/assets/call.svg";
import contactIcon from "@/assets/contact.svg";
import medicalIcon from "@/assets/medical.svg";
import Header from "./Header";

// ── Icons ────────────────────────────────────────────────────────────────────
const IconSOS = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
const IconMap = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
  </svg>
);
const IconContacts = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a4 4 0 00-3-3.87" />
  </svg>
);
const IconProfile = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const sidebarItems = [
  { label: "SOS", icon: <IconSOS /> },
  { label: "Map", icon: <IconMap /> },
  { label: "Contacts", icon: <IconContacts /> },
  { label: "Profile", icon: <IconProfile /> },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [open, setOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const [editForm, setEditForm] = useState({
    full_name: "",
    date_of_birth: "",
    gender: "",
    address: "",
    blood_type: "",
    height: "",
    weight: "",
    allergies: "",
    medical_history: [],
  });

  const handleOpenEdit = () => {
    setEditForm({
      full_name: user?.full_name || "",
      date_of_birth: user?.profile?.date_of_birth
        ? new Date(user.profile.date_of_birth).toISOString().split("T")[0]
        : "",
      gender: user?.profile?.gender || "",
      address: user?.profile?.address || "",
      blood_type: user?.profile?.blood_type || "",
      height: user?.profile?.height || "",
      weight: user?.profile?.weight || "",
      allergies: user?.profile?.allergies || "",
      medical_history: user?.profile?.medical_history || [],
    });
    setShowEdit(true);
  };

  const handleSave = async () => {
    try {
      const res = await api.put("/api/user/profile", {
        full_name: editForm.full_name,
        profile: {
          date_of_birth: editForm.date_of_birth || null,
          gender: editForm.gender || "",
          address: editForm.address || "",
          blood_type: editForm.blood_type || undefined,
          height: editForm.height ? Number(editForm.height) : null,
          weight: editForm.weight ? Number(editForm.weight) : null,
          allergies: editForm.allergies || "",
          medical_history: editForm.medical_history || [],
        },
      });
      if (res.data.success) {
        setUser(res.data.data);
        setShowEdit(false);
      }
    } catch (err) {
      console.error("Update error:", err.response?.data || err.message);
    }
  };

  const addTag = (val) => {
    const v = val.trim();
    if (v && !editForm.medical_history.includes(v))
      setEditForm((f) => ({
        ...f,
        medical_history: [...f.medical_history, v],
      }));
    setTagInput("");
  };
  const removeTag = (tag) =>
    setEditForm((f) => ({
      ...f,
      medical_history: f.medical_history.filter((t) => t !== tag),
    }));

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      if (!fbUser) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get("/api/user/me");
        if (res.data.success) {
          const d = res.data.data;
          setUser(d);
          setEditForm({
            full_name: d.full_name || "",
            date_of_birth: d.profile?.date_of_birth
              ? new Date(d.profile.date_of_birth).toISOString().split("T")[0]
              : "",
            gender: d.profile?.gender || "",
            address: d.profile?.address || "",
            blood_type: d.profile?.blood_type || "",
            height: d.profile?.height || "",
            weight: d.profile?.weight || "",
            allergies: d.profile?.allergies || "",
            medical_history: d.profile?.medical_history || [],
          });
        }
      } catch (err) {
        console.error("Fetch user error:", err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);
  // Thêm state cho form liên hệ
  const [contactForm, setContactForm] = useState({ name: "", phone: "", relation: "" });
  const [contactLoading, setContactLoading] = useState(false);

  const handleAddContact = async () => {
    if (!contactForm.name || !contactForm.phone) return;
    setContactLoading(true);
    try {
      const res = await api.post("/api/users/profile/emergency-contact", contactForm);
      if (res.data.success) {
        setUser(res.data.data);                     
        setContactForm({ name: "", phone: "", relation: "" }); // reset form
        setOpen(false);
      }
    } catch (err) {
      console.error("Add contact error:", err.response?.data || err.message);
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#f0f4ff] flex flex-col"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* ── HEADER ── */}
      <header className="bg-white border-b border-gray-200 w-full sticky top-0 z-30">
        {<Header/>}
      </header>
      {/* ── BODY ── */}
      <div className="flex flex-1">
  {/* ── SIDEBAR ── */}
  <aside className="w-56 bg-white border-r border-gray-200 hidden md:flex flex-col justify-between shadow-sm">
    <div>
      <nav className="p-3 flex flex-col gap-0.5">
        {sidebarItems.map(({ label, icon }) => (
          <div
            key={label}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition ${
              label === "Profile"
                ? "bg-blue-50 text-[#047857] font-semibold"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            }`}
          >
            <span className={label === "Profile" ? "text-[#047857]" : "text-gray-400"}>
              {icon}
            </span>
            {label}
          </div>
        ))}
      </nav>
    </div>
    <div className="p-4">
      <button className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        Trigger SOS
      </button>
    </div>
  </aside>

  {/* ── MAIN ── */}
  <div className="flex-1 flex justify-center">
    <div className="w-full max-w-5xl px-6 py-6">

      {/*Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
        <p className="text-sm text-gray-400 mt-0.5">Quản lý thông tin an toàn và y tế của bạn</p>
      </div>

      {/* ── GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── CỘT TRÁI (3/5) ── */}
        <div className="lg:col-span-3 flex flex-col gap-5">

          {/* Avatar card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <img
                  src={user?.profile?.avatar_url || "/default-avatar.png"}
                  alt="avatar"
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow"
                />
                <button className="absolute bottom-0 right-0 w-7 h-7 hover:bg-[#1B6D24] rounded-full flex items-center justify-center shadow bg-green-900 transition">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900">{user?.full_name || "—"}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-gray-500">{user?.phone}</span>
                  {user?.verified && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                      style={{ background: "#e6f9f0", color: "#16a34a", border: "1px solid #bbf7d0" }}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
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
                  onClick={handleOpenEdit}
                  className="mt-3 flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-sm text-[#047277] font-semibold px-3 py-1 rounded transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Chỉnh sửa
                </button>
              </div>
            </div>
          </div>

          {/* Thông tin cá nhân */}
          <div className="bg-green-50 rounded-2xl border border-green-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-green-100 text-[#047857] rounded-lg p-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800">Thông tin cá nhân</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Họ tên", value: user?.full_name },
                { label: "Số điện thoại", value: user?.phone },
                {
                  label: "Ngày sinh",
                  value: user?.profile?.date_of_birth
                    ? new Date(user.profile.date_of_birth).toLocaleDateString("vi-VN")
                    : "—",
                },
                { label: "Giới tính", value: user?.profile?.gender || "—" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="px-3 py-2.5 bg-white rounded-lg"
                  style={{ borderLeft: "3px solid #1B6D24" }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{value || "—"}</p>
                </div>
              ))}
              <div
                className="col-span-2 px-3 py-2.5 bg-white rounded-lg"
                style={{ borderLeft: "3px solid #1B6D24" }}
              >
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Địa chỉ</p>
                <p className="text-sm font-semibold text-gray-800">{user?.profile?.address || "—"}</p>
              </div>
            </div>
          </div>

          {/* Thông tin y tế */}
          <div className="bg-green-50 rounded-2xl border border-green-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-green-100 text-green-600 rounded-lg p-1.5">
                <img src={medicalIcon} alt="medical" className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-gray-800">Thông tin y tế</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Nhóm máu", value: user?.profile?.blood_type || "—", red: true },
                { label: "Chiều cao", value: user?.profile?.height ? `${user.profile.height} cm` : "—" },
                { label: "Cân nặng", value: user?.profile?.weight ? `${user.profile.weight} kg` : "—" },
                { label: "Dị ứng", value: user?.profile?.allergies || "—" },
              ].map(({ label, value, red }) => (
                <div
                  key={label}
                  className="px-3 py-2.5 bg-white rounded-lg"
                  style={{ borderLeft: "3px solid #22c55e" }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">{label}</p>
                  <p className={`text-sm font-bold ${red ? "text-red-600" : "text-gray-800"}`}>{value}</p>
                </div>
              ))}
              <div
                className="col-span-2 px-3 py-2.5 bg-white rounded-lg"
                style={{ borderLeft: "3px solid #22c55e" }}
              >
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Bệnh nền</p>
                <div className="flex flex-wrap gap-1.5">
                  {(user?.profile?.medical_history || []).length > 0
                    ? (user.profile.medical_history).map((b) => (
                        <span
                          key={b}
                          className="text-xs px-2 py-0.5 rounded-md font-semibold"
                          style={{ background: "#fef3c7", color: "#d97706" }}
                        >
                          {b}
                        </span>
                      ))
                    : <span className="text-sm font-bold text-gray-800">—</span>
                  }
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── CỘT PHẢI (2/5) ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Liên hệ khẩn cấp */}
          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-red-500 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src={contactList} alt="contact" className="w-5 h-5" />
                <h3 className="font-semibold text-gray-800">Liên hệ khẩn cấp</h3>
              </div>
              <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-semibold">
                {user?.profile?.emergency_contacts?.length || 0} người
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {user?.profile?.emergency_contacts?.map((contact, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#E9F6FD] hover:bg-red-50 transition cursor-pointer"
                > 
                  <div className="flex items-center gap-3">
                    <img src={contactIcon} alt="contact" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{contact.name}</p>
                      <p className="text-xs text-gray-400">{contact.relation} • {contact.phone}</p>
                    </div>
                  </div>
                  <button className="contact-list">
                    <img src={call} alt="call" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => setOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 mt-1 text-sm font-medium text-gray-500 hover:text-[#047857] hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-xl transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Thêm người liên hệ
              </button>
            </div>
          </div>

          {/* Modal thêm liên hệ */}
          {open && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="w-[360px] bg-white rounded-2xl shadow-xl p-5 relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-4 py-1.5 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
                    Thêm liên hệ khẩn cấp
                  </span>
                  <button onClick={() => { setOpen(false); setContactForm({ name: "", phone: "", relation: "" }); }}>✕</button>
                </div>
                <hr className="mb-4" />
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Họ và tên</label>
                    <input
                      type="text"
                      placeholder="Nhập tên người liên hệ"
                      className="w-full mt-1 p-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-red-200"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Số điện thoại</label>
                    <input
                      type="text"
                      placeholder="Nhập số điện thoại"
                      className="w-full mt-1 p-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-red-200"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Mối quan hệ</label>
                    <select
                      className="w-full mt-1 p-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-red-200"
                      value={contactForm.relation}
                      onChange={(e) => setContactForm({ ...contactForm, relation: e.target.value })}
                    >
                      <option value="">Chọn mối quan hệ</option>
                      <option value="Bố">Bố</option>
                      <option value="Mẹ">Mẹ</option>
                      <option value="Vợ/Chồng">Vợ/Chồng</option>
                      <option value="Anh/Chị/Em">Anh/Chị/Em</option>
                      <option value="Bạn bè">Bạn bè</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleAddContact}
                    disabled={contactLoading || !contactForm.name || !contactForm.phone}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition"
                  >
                    {contactLoading ? "Đang lưu..." : "Thêm liên hệ"}
                  </button>
                  <button
                    onClick={() => { setOpen(false); setContactForm({ name: "", phone: "", relation: "" }); }}
                    className="flex-1 py-3 bg-gray-200 text-gray-600 rounded-xl font-semibold"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>{/* end lg:col-span-2 */}

      </div>{/* end grid */}
    </div>
  </div>
</div>

      {/* ── EDIT MODAL */}
      {showEdit && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEdit(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-bold text-gray-900 text-lg">
                Chỉnh sửa hồ sơ
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

            <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#047857] uppercase tracking-wider">
                  Thông tin cá nhân
                </span>
                <div className="flex-1 h-px bg-blue-100" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Họ và tên
                </label>
                <input
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-gray-50"
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, full_name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-gray-50"
                    value={editForm.date_of_birth}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        date_of_birth: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Giới tính
                  </label>
                  <select
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-gray-50"
                    value={editForm.gender}
                    onChange={(e) =>
                      setEditForm({ ...editForm, gender: e.target.value })
                    }
                  >
                    <option value="">Chọn...</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Địa chỉ
                </label>
                <textarea
                  rows={2}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-gray-50 resize-none"
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm({ ...editForm, address: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
                  Thông tin y tế
                </span>
                <div className="flex-1 h-px bg-red-100" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                  Nhóm máu
                </label>
                <div className="flex gap-2">
                  {["A", "B", "AB", "O"].map((bt) => (
                    <button
                      key={bt}
                      onClick={() =>
                        setEditForm({ ...editForm, blood_type: bt })
                      }
                      className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition ${
                        editForm.blood_type === bt
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-white text-gray-600 border-gray-200 hover:border-red-300"
                      }`}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Chiều cao (cm)
                  </label>
                  <input
                    type="number"
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400 bg-gray-50"
                    value={editForm.height}
                    onChange={(e) =>
                      setEditForm({ ...editForm, height: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Cân nặng (kg)
                  </label>
                  <input
                    type="number"
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400 bg-gray-50"
                    value={editForm.weight}
                    onChange={(e) =>
                      setEditForm({ ...editForm, weight: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Dị ứng
                </label>
                <input
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400 bg-gray-50"
                  placeholder="VD: Penicillin, hải sản..."
                  value={editForm.allergies}
                  onChange={(e) =>
                    setEditForm({ ...editForm, allergies: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Bệnh nền
                </label>
                <div
                  className="mt-1 flex flex-wrap gap-1.5 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 min-h-[44px] cursor-text"
                  onClick={() => document.getElementById("tagInputEl").focus()}
                >
                  {editForm.medical_history.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-semibold"
                      style={{ background: "#fef3c7", color: "#d97706" }}
                    >
                      {tag}
                      <button
                        className="text-amber-700 hover:text-amber-900 leading-none"
                        onClick={() => removeTag(tag)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    id="tagInputEl"
                    className="border-none outline-none bg-transparent text-sm min-w-[100px] text-gray-700"
                    placeholder={
                      editForm.medical_history.length === 0
                        ? "Nhập bệnh, nhấn Enter..."
                        : ""
                    }
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                      if (
                        e.key === "Backspace" &&
                        !tagInput &&
                        editForm.medical_history.length > 0
                      )
                        removeTag(
                          editForm.medical_history[
                            editForm.medical_history.length - 1
                          ]
                        );
                    }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Nhấn Enter để thêm, Backspace để xóa tag cuối
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1  hover:bg-[#047857] bg-green-900 text-white font-semibold py-2.5 rounded-xl transition text-sm"
              >
                Lưu thay đổi
              </button>
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl transition text-sm"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
