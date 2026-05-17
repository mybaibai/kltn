import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import api from "@/services/api/apiSos";
import toast from "react-hot-toast";

const CreateUserDrawer = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    address: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ================= VALIDATION =================

  const isValidEmail = (email) => {
    return email.includes("@") && email.includes(".");
  };

  const isStrongPassword = (password) => {
    return password.length >= 6;
  };

  if (!open) return null;

  // ================= HANDLE CHANGE =================

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // ================= VALIDATE =================

  const validate = () => {
    const full_name = form.full_name?.trim();
    const email = form.email?.trim();
    const password = form.password;
    const confirm = form.confirm;

    // TÊN ĐỘI
    if (!full_name || full_name.length < 3) {
      toast.error("Tên đội cứu trợ phải có ít nhất 3 ký tự");
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
      toast.error("Mật khẩu phải từ 6 ký tự trở lên");
      return false;
    }

    // CONFIRM PASSWORD
    if (!confirm) {
      toast.error("Vui lòng nhập lại mật khẩu");
      return false;
    }

    if (password !== confirm) {
      toast.error("Mật khẩu nhập lại không khớp");
      return false;
    }

    return true;
  };

  // ================= SUBMIT =================

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "Rescue",

        // backend user schema
        profile: {
          address: form.address?.trim() || "",
        },
      };

      await api.post("/users", payload);

      toast.success("Tạo đội cứu trợ thành công");

      onSubmit?.(payload);

      // reset form
      setForm({
        full_name: "",
        email: "",
        password: "",
        confirm: "",
        address: "",
      });

      onClose();
    } catch (err) {
      console.error(err);

      const message =
        err?.response?.data?.message ||
        "Tạo đội cứu trợ thất bại";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">

      {/* OVERLAY */}
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
      />

      {/* DRAWER */}
      <div className="w-[430px] bg-white h-full shadow-xl p-6 flex flex-col">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">
              Thêm đội cứu trợ
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Tạo tài khoản lực lượng cứu hộ mới
            </p>
          </div>

          <X
            className="w-5 h-5 cursor-pointer text-gray-400 hover:text-red-500 transition"
            onClick={onClose}
          />
        </div>

        {/* FORM */}
        <div className="flex-1 overflow-y-auto space-y-5">

          <Input
            name="full_name"
            label="Tên đội cứu trợ *"
            placeholder="Ví dụ: Đội Cứu Hộ Đà Nẵng"
            value={form.full_name}
            onChange={handleChange}
          />

          <Input
            name="email"
            label="Email *"
            placeholder="nhapemail@email.com"
            value={form.email}
            onChange={handleChange}
          />

          <PasswordInput
            name="password"
            label="Mật khẩu *"
            type={showPassword ? "text" : "password"}
            onChange={handleChange}
            show={showPassword}
            onToggle={() => setShowPassword(!showPassword)}
          />

          <PasswordInput
            name="confirm"
            label="Nhập lại mật khẩu *"
            type={showConfirm ? "text" : "password"}
            onChange={handleChange}
            show={showConfirm}
            onToggle={() => setShowConfirm(!showConfirm)}
          />
          
        

          <Input
            name="address"
            label="Vị trí"
            placeholder="Ví dụ: Lê Duẩn, Hải Châu, Đà Nẵng"
            value={form.address}
            onChange={handleChange}
          />
        </div>

        {/* ACTION */}
        <div className="flex gap-3 mt-6">

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 transition text-white font-medium py-3 rounded-xl"
          >
            {loading ? "Đang tạo..." : "Tạo đội cứu trợ"}
          </button>

          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 transition font-medium py-3 rounded-xl"
          >
            Hủy
          </button>

        </div>
      </div>
    </div>
  );
};

/* ================= COMPONENT INPUT ================= */

const Input = ({ label, ...props }) => (
  <div>
    <p className="text-sm font-medium mb-2 text-gray-600">
      {label}
    </p>

    <input
      {...props}
      className="w-full border rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const PasswordInput = ({
  label,
  show,
  onToggle,
  ...props
}) => (
  <div>
    <p className="text-base mb-2 text-gray-600 font-medium">
      {label}
    </p>

    <div className="relative">
      <input
        {...props}
        className="w-full border rounded-xl px-4 py-3 bg-gray-50 text-base pr-12"
      />

      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
      >
        {show ? (
          <EyeOff className="w-5 h-5" />
        ) : (
          <Eye className="w-5 h-5" />
        )}
      </button>
    </div>
  </div>
);

export default CreateUserDrawer;