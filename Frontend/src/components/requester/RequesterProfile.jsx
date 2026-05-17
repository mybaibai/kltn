import { useState, useEffect, useRef  } from "react";
import { auth } from "@/lib/firebase";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getVictimProfile,
  updateVictimProfile,
  addEmergencyContact,
  deleteEmergencyContact,
} from "@/services/api/apiSos";
import contactList from "@/assets/contact_list.svg";
import call from "@/assets/call.svg";
import contactIcon from "@/assets/contact.svg";
import medicalIcon from "@/assets/medical.svg";
import historyIcon from "@/assets/history.svg";
import homeIcon from "@/assets/home.svg";
import Header from "./Header";
import { getUserAvatarSrc } from "@/lib/userAvatar";
import {
  logoutVictimFirebase,
  clearVictimProfile,
} from '@/services/auth/session';

const HomeIcon = () => (
  <img src={homeIcon} alt="home" className="w-4 h-4" />
);
const HistoryIcon = () => (
  <img src={historyIcon} alt="history" className="w-4 h-4" />
);
const IconProfile = () => (
  <svg
    className="w-4.5 h-4.5 text-[#475569]"  
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
  { label: "Trang chủ", icon: <HomeIcon />, path: "/" },
  { label: "Thông tin cá nhân", icon: <IconProfile />, path: "/profile" },
  { label: "Lịch sử", icon: <HistoryIcon />, path: "/history" },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [open, setOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const location = useLocation();
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
      const res = await updateVictimProfile({
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

  const [diseaseInput, setDiseaseInput] = useState("");

  const handleAddDisease = () => {
    const value = diseaseInput.trim();
    if (!value) return;
  
    if (editForm.medical_history.includes(value)) {
      setDiseaseInput("");
      return;
    }
  
    setEditForm({
      ...editForm,
      medical_history: [...editForm.medical_history, value]
    });
  
    setDiseaseInput("");
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
        const res = await getVictimProfile();
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
          console.log("medical history:", d.profile?.medical_history);
        }
      } catch (err) {
        console.error("Fetch user error:", err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const [contactForm, setContactForm] = useState({ name: "", phone: "", relation: "" });
  const [contactLoading, setContactLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);

  const handleAddContact = async () => {
    if (!contactForm.name || !contactForm.phone) return;
    setContactLoading(true);
    try {
      const res = await addEmergencyContact(contactForm);
      if (res.data.success) {
        setUser(res.data.data);                     
        setContactForm({ name: "", phone: "", relation: "" });
        setOpen(false);
      }
    } catch (err) {
      console.error("Add contact error:", err.response?.data || err.message);
    } finally {
      setContactLoading(false);
    }
  };

  const fileInputRef = useRef(null);
  const [avatar, setAvatar] = useState(() => localStorage.getItem('userAvatar') || null);

  const handleSetAvatar = (url) => {
    if (url) {
      localStorage.setItem('userAvatar', url);
    } else {
      localStorage.removeItem('userAvatar');
    }
    setAvatar(url);
  };

  const [selectedContact, setSelectedContact] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutVictim = async () => {
    try {
      await logoutVictimFirebase();
    } finally {
      clearVictimProfile();
      setUser(null);
      navigate('/', { state: { toast: 'Đã đăng xuất' } });
    }
  };  

  return (
  <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>

    {/* HEADER */}
    <header className="bg-white border-b border-gray-100 w-full sticky top-0 z-30">
      <Header />
    </header>

    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* SIDEBAR */}
      <aside className="w-52 bg-white border-r border-gray-100 hidden md:flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="px-5 py-5">
            <div className="text-emerald-700 font-bold text-base leading-tight">RescuePortal</div>
            <div className="text-[10px] text-emerald-500 font-semibold tracking-widest uppercase">Emergency Support</div>
          </div>
          <nav className="px-3 flex flex-col gap-0.5">
            {sidebarItems.map(({ label, icon, path }) => {
              const isActive = location.pathname === path;
              return (
                <div key={label} onClick={() => navigate(path)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold border-l-2 border-emerald-500"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}>
                  <span className={isActive ? "text-emerald-600" : "text-gray-400"}>{icon}</span>
                  {label}
                </div>
              );
            })}
          </nav>
        </div>
        <div className="px-3 pb-5 flex flex-col gap-0.5">

          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 
              cursor-pointer hover:text-red-500 hover:bg-red-50 transition"
            onClick={async () => {
              setOpen(false);
              await handleLogoutVictim();
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Đăng xuất
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 overflow-y-auto" style={{ background: "rgb(244,251,244)" }}>
        <div className="max-w-5xl mx-auto px-8 py-7">

          <h1 className="text-lg font-bold text-gray-700 mb-6">Hồ sơ cá nhân</h1>

          {/* Avatar card */}
          <div className="bg-white rounded-2xl px-6 py-5 flex items-center gap-5 shadow-sm mb-6">
            <div className="relative flex-shrink-0">
              <img
                src={getUserAvatarSrc({ profile: { avatar_url: avatar } })}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-emerald-100"
                alt=""
              />
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      handleSetAvatar(ev.target.result); 
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }
                }}/>
              {avatar ? (
                <button className="absolute bottom-0 right-0 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow transition"
                  onClick={() => setAvatar(null)}>
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              ) : (
                <button className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center shadow transition"
                  onClick={() => fileInputRef.current?.click()}>
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{user?.full_name || "—"}</h2>
              <div className="flex items-center gap-1.5 mt-1.5 text-gray-500 text-sm">
                <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.25 12 19.79 19.79 0 011.15 3.42 2 2 0 013.12 1.25h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 8.5a16 16 0 006.29 6.29l1.42-1.26a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0121.5 16z"/>
                </svg>
                {user?.phone || "—"}
              </div>
            </div>
            <button onClick={handleOpenEdit}
              className="flex-shrink-0 border border-emerald-400 text-emerald-600 bg-[#ECFDF5] hover:bg-emerald-100 text-sm font-semibold px-4 py-1 rounded-sm transition flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Chỉnh sửa
            </button>
          </div>

          {/* Grid 5 cột cho phần còn lại */}
          <div className="grid grid-cols-5 gap-6">

            {/* LEFT (3/5) */}
            <div className="col-span-3 flex flex-col gap-5">

              {/* Thông tin cá nhân */}
              <div className="px-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-green-100 text-[#047857] rounded-lg p-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-600">Thông tin cá nhân</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "HỌ TÊN", value: user?.full_name },
                    { label: "SỐ ĐIỆN THOẠI", value: user?.phone },
                    {
                      label: "NGÀY SINH",
                      value: user?.profile?.date_of_birth
                        ? new Date(user.profile.date_of_birth).toLocaleDateString("vi-VN") : "—"
                    },
                    { label: "GIỚI TÍNH", value: user?.profile?.gender || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-xl px-4 py-3 shadow-sm">
                      <p className="text-[9px] font-bold text-gray-400 tracking-widest mb-1">{label}</p>
                      <p className="text-sm font-semibold text-gray-800">{value || "—"}</p>
                    </div>
                  ))}
                  <div className="col-span-2 bg-white rounded-xl px-4 py-3 shadow-sm">
                    <p className="text-[9px] font-bold text-gray-400 tracking-widest mb-1">ĐỊA CHỈ</p>
                    <p className="text-sm font-semibold text-gray-800">{user?.profile?.address || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Thông tin y tế */}
              <div className="rounded-2xl border border-red-100 px-6 py-5 shadow-sm" style={{ background: "#fff5f5" }}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
                    <img src={medicalIcon} alt="medical" className="w-4 h-4"/>
                  </div>
                  <h3 className="text-sm font-semibold text-red-500">Thông tin y tế</h3>
                </div>
                <div className="flex gap-3 mb-5">
                  <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-red-50 flex-1">
                    <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-gray-400 tracking-widest">NHÓM MÁU</p>
                      <p className="text-lg font-bold text-red-600 leading-tight">{user?.profile?.blood_type || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-red-50 flex-1">
                    <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 8v8M9 11l3-3 3 3"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-gray-400 tracking-widest">CHIỀU CAO</p>
                      <p className="text-lg font-bold text-gray-800 leading-tight">{user?.profile?.height ? `${user.profile.height} cm` : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-red-50 flex-1">
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-gray-400 tracking-widest">CÂN NẶNG</p>
                      <p className="text-lg font-bold text-gray-800 leading-tight">{user?.profile?.weight ? `${user.profile.weight} kg` : "—"}</p>
                    </div>
                  </div>
                </div>
                {(() => {
                  const list = user?.profile?.allergies
                    ? user.profile.allergies.split(",").map(s => s.trim()).filter(Boolean)
                    : [];
                  return list.length > 0 ? (
                    <div className="mb-4">
                      <p className="text-[9px] font-bold text-gray-400 tracking-widest mb-2">DỊ ỨNG</p>
                      <div className="flex flex-wrap gap-2">
                        {list.map((a) => (
                          <span key={a} className="text-xs px-3 py-1 bg-white border border-gray-200 rounded-full text-gray-600 font-medium">{a}</span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
                {(user?.profile?.medical_history || []).length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-red-400 tracking-widest mb-2">BỆNH NỀN QUAN TRỌNG</p>
                    <div className="flex flex-wrap gap-2">
                      {(user?.profile?.medical_history || []).map((b) => (
                        <span key={b} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-600 text-white rounded-full font-semibold">
                          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT*/}
            <div className="col-span-2 flex flex-col gap-5">

              {/* Liên hệ khẩn cấp */}
              <div className="px-1">
                <div className="flex items-center gap-2 mb-4">
                  <img src={contactList} alt="contact" className="w-4 h-4"/>
                  <h3 className="text-sm font-semibold text-gray-600">Liên hệ khẩn cấp</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {user?.profile?.emergency_contacts?.map((contact, i) => (
                    <div key={i}
                      onClick={() => setSelectedContact({ ...contact, index: i })}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm hover:shadow-md hover:border-emerald-100 border border-transparent transition cursor-pointer">
                      <img src={contactIcon} alt="contact" className="w-12 h-12 rounded-full object-cover flex-shrink-0"/>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 leading-tight">{contact.name}</p>
                          <span className="text-xs font-medium text-emerald-600 border border-emerald-400 rounded-full ml-25 px-2 py-0.5 leading-tight">
                            {contact.relation}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{contact.phone}</p>
                      </div>
                    </div>
                  ))}

                  <button onClick={() => setOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-400 hover:text-emerald-600 border border-dashed border-gray-300 hover:border-emerald-300 rounded-xl bg-white/60 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
                    </svg>
                    Thêm liên hệ mới
                  </button>
                </div>
              </div>

              {/* Security card */}
              <div className="rounded-2xl px-5 py-5" style={{ background: "#162118" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Dữ liệu y tế của bạn được mã hoá đầu cuối và chỉ chia sẻ với đội cứu hộ trong tình huống khẩn cấp.
                </p>
                <button className="mt-3 text-xs text-emerald-400 font-semibold hover:text-emerald-300 transition">
                  Tìm hiểu thêm →
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── POPUP XEM CHI TIẾT LIÊN HỆ ── */}
    {selectedContact && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
        onClick={() => setSelectedContact(null)}>
        <div className="w-[340px] bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="bg-gradient-to-r from-[#275F13] to-[#1C6E1B] px-5 py-5 flex items-center gap-4">
            <img src={contactIcon} alt="contact" className="w-14 h-14 rounded-full object-cover border-2 border-white/40"/>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base leading-tight">{selectedContact.name}</p>
              <p className="text-emerald-100 text-xs font-medium mt-0.5">{selectedContact.relation}</p>
            </div>
            <button onClick={() => setSelectedContact(null)} className="text-white/70 hover:text-white transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Info */}
          <div className="px-5 py-5">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-3">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.25 12 19.79 19.79 0 011.15 3.42 2 2 0 013.12 1.25h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 8.5a16 16 0 006.29 6.29l1.42-1.26a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0121.5 16z"/>
                </svg>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-400 tracking-widest">SỐ ĐIỆN THOẠI</p>
                <p className="text-sm font-semibold text-gray-800">{selectedContact.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-400 tracking-widest">MỐI QUAN HỆ</p>
                <p className="text-sm font-semibold text-gray-800">{selectedContact.relation || "—"}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={() => {
                setContactToDelete(selectedContact);
                setShowConfirm(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold text-sm transition border border-red-100"
            >
              Xoá liên hệ
            </button>
          </div>
        </div>
      </div>
    )}

    {/* CONFIRM XOÁ LIÊN HỆ */}
    {showConfirm && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">Xác nhận xoá</h3>
          <p className="text-sm text-gray-600 mb-5">
            Bạn có chắc muốn xoá liên hệ{" "}
            <span className="font-semibold text-red-500">"{contactToDelete?.name}"</span>?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 rounded-xl border text-gray-600 hover:bg-gray-100">
              Huỷ
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await deleteEmergencyContact(contactToDelete.index);
                  if (res.data.success) {
                    setUser(res.data.data);
                    setSelectedContact(null);
                    setShowConfirm(false);
                  }
                } catch (err) {
                  console.error("Delete contact error:", err.response?.data || err.message);
                }
              }}
              className="flex-1 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600">
              Xoá
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal thêm liên hệ */}
    {open && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="w-[360px] bg-white rounded-2xl shadow-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="px-4 py-1.5 bg-[#B7141B] text-white rounded-full text-sm font-semibold">
              Thêm liên hệ khẩn cấp
            </span>
            <button onClick={() => { setOpen(false); setContactForm({ name: "", phone: "", relation: "" }); }}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>
          <hr className="mb-4"/>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Họ và tên</label>
              <input type="text" placeholder="Nhập tên người liên hệ"
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-red-200 text-sm"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}/>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Số điện thoại</label>
              <input type="text" placeholder="Nhập số điện thoại"
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-red-200 text-sm"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}/>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Mối quan hệ</label>
              <select className="w-full mt-1 p-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-red-200 text-sm"
                value={contactForm.relation}
                onChange={(e) => setContactForm({ ...contactForm, relation: e.target.value })}>
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
            <button onClick={handleAddContact}
              disabled={contactLoading || !contactForm.name || !contactForm.phone}
              className="flex-1 py-3 bg-[#B7141B] hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition text-sm">
              {contactLoading ? "Đang lưu..." : "Thêm liên hệ"}
            </button>
            <button onClick={() => { setOpen(false); setContactForm({ name: "", phone: "", relation: "" }); }}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold text-sm transition">
              Hủy
            </button>
          </div>
        </div>
      </div>
    )}

    {/* EDIT MODAL */}
    {showEdit && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={() => setShowEdit(false)}>
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
            <h3 className="font-bold text-gray-900 text-lg">Chỉnh sửa hồ sơ</h3>
            <button onClick={() => setShowEdit(false)} className="p-1.5 rounded-full hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Thông tin cá nhân</span>
              <div className="flex-1 h-px bg-emerald-100"/>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Họ và tên</label>
              <input className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 bg-gray-50"
                value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ngày sinh</label>
                <input type="date" className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 bg-gray-50"
                  value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}/>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giới tính</label>
                <select className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 bg-gray-50"
                  value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                  <option value="">Chọn...</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Địa chỉ</label>
              <textarea rows={2} className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 bg-gray-50 resize-none"
                value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}/>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Thông tin y tế</span>
              <div className="flex-1 h-px bg-red-100"/>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Nhóm máu</label>
              <div className="flex gap-2">
                {["A", "B", "AB", "O"].map((bt) => (
                  <button key={bt} onClick={() => setEditForm({ ...editForm, blood_type: bt })}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition ${
                      editForm.blood_type === bt ? "bg-red-500 text-white border-red-500" : "bg-white text-gray-600 border-gray-200 hover:border-red-300"
                    }`}>{bt}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Chiều cao (cm)</label>
                <input type="number" className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400 bg-gray-50"
                  value={editForm.height} onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}/>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cân nặng (kg)</label>
                <input type="number" className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400 bg-gray-50"
                  value={editForm.weight} onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}/>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dị ứng</label>
              <input className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400 bg-gray-50"
                placeholder="VD: Tôm, Cá biển... (phân cách bằng dấu phẩy)"
                value={editForm.allergies} onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })}/>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Bệnh nền</label>
              <div className="mt-1 flex flex-wrap gap-1.5 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 min-h-[44px] cursor-text"
                onClick={() => document.getElementById("tagInputEl").focus()}>
                {editForm.medical_history.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-700">
                    {tag}
                    <button className="text-red-400 hover:text-red-600 leading-none ml-0.5" onClick={() => removeTag(tag)}>×</button>
                  </span>
                ))}
                <input id="tagInputEl" type="text" placeholder="Nhập bệnh và nhấn Enter"
                  value={diseaseInput} onChange={(e) => setDiseaseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddDisease(); } }}
                  className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"/>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
            <button onClick={handleSave}
              className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 rounded-xl transition text-sm">
              Lưu thay đổi
            </button>
            <button onClick={() => setShowEdit(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl transition text-sm">
              Hủy
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}