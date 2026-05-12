import { useState } from "react";
import { X } from "lucide-react";
import api from "@/services/api/apiSos";
import toast from "react-hot-toast";

const CreateUserDrawer = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  // ✅ VALIDATION UTILS (KHÔNG LỖI ĐỎ)
  const isValidEmail = (email) => {
    return email.includes("@") && email.includes(".");
  };

  const isStrongPassword = (password) => {
    return password.length >= 6;
  };

  if (!open) return null;

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // ✅ VALIDATION
  const validate = () => {
    const team = form.team?.trim();
    const email = form.email?.trim();
    const password = form.password;
    const confirm = form.confirm;

    // TEAM
    if (!team || team.length < 3) {
      toast.error("Tên đội phải có ít nhất 3 ký tự");
      return false;
    }

    // EMAIL
    if (!email) {
      toast.error("Vui lòng nhập email");
      return false;
    }

    if (!isValidEmail(email)) {
      toast.error("Email không hợp lệ");
      return false;
    }

    // PASSWORD
    if (!password) {
      toast.error("Vui lòng nhập mật khẩu");
      return false;
    }

    if (!isStrongPassword(password)) {
      toast.error("Mật khẩu phải ≥ 6 ký tự");
      return false;
    }

    // CONFIRM
    if (!confirm) {
      toast.error("Vui lòng nhập lại mật khẩu");
      return false;
    }

    if (password !== confirm) {
      toast.error("Mật khẩu không khớp");
      return false;
    }

    return true;
  };

  // ✅ SUBMIT
  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const payload = {
        full_name: form.team.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "Rescue",
        area: form.area || "",
      };

      await api.post("/users", payload);

      toast.success("Tạo đội cứu trợ thành công");

      onSubmit?.(payload);

      setForm({});
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Tạo người dùng thất bại");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex">
      
      {/* OVERLAY */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* DRAWER */}
      <div className="w-[420px] bg-white h-full shadow-xl p-6 flex flex-col">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            Thêm đội cứu trợ
          </h2>

          <X
            className="w-5 h-5 cursor-pointer text-gray-400"
            onClick={onClose}
          />
        </div>


        {/* FORM */}
        <div className="flex-1 overflow-y-auto space-y-4">
          
          <Input name="team" label="Tên Đội cứu trợ *" onChange={handleChange} />
          <Input name="email" label="Gmail *" onChange={handleChange} />
          <Input name="password" label="Mật khẩu *" type="password" onChange={handleChange} />
          <Input name="confirm" label="Nhập lại mật khẩu *" type="password" onChange={handleChange} />
          
          <Select
            label="Khu vực hoạt động"
            onChange={(e) =>
              setForm({ ...form, area: e.target.value })
            }
          />

          {/* <StatusBadge text="ĐÃ XÁC MINH" color="blue" /> */}
        </div>

        {/* ACTION */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg"
          >
            {loading ? "Đang tạo..." : "Tạo người dùng"}
          </button>

          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 py-2 rounded-lg"
          >
            Hủy
          </button>
        </div>

      </div>
    </div>
  );
};

/* ================= COMPONENT CON ================= */

const Input = ({ label, ...props }) => (
  <div>
    <p className="text-sm mb-1 text-gray-500">{label}</p>
    <input
      {...props}
      className="w-full border rounded-lg px-3 py-2 bg-gray-50"
    />
  </div>
);

const Select = ({ label, onChange }) => (
  <div>
    <p className="text-sm mb-1 text-gray-500">{label}</p>
    <select
      onChange={onChange}
      className="w-full border rounded-lg px-3 py-2 bg-gray-50"
    >
      <option value="">Chọn khu vực</option>
      <option>Hải Châu</option>
      <option>Thanh Khê</option>
    </select>
  </div>
);

const StatusBadge = ({ text, color }) => {
  const colorMap = {
    red: "bg-red-100 text-red-500",
    blue: "bg-blue-100 text-blue-600",
  };

  return (
    <div className={`inline-block px-3 py-1 rounded-full text-xs ${colorMap[color]}`}>
      {text}
    </div>
  );
};

export default CreateUserDrawer;