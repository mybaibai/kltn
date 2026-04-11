import { useState } from "react";
import { X } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

const CreateUserDrawer = ({ open, onClose, onSubmit }) => {
  const [type, setType] = useState("citizen");
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // 🔥 VALIDATION
  const validate = () => {
    if (type === "citizen") {
      if (!form.phone) {
        toast.error("Vui lòng nhập số điện thoại");
        return false;
      }
    }

    if (type === "rescue") {
      if (!form.team) {
        toast.error("Vui lòng nhập tên đội");
        return false;
      }
      if (!form.email) {
        toast.error("Vui lòng nhập email");
        return false;
      }
      if (!form.password) {
        toast.error("Vui lòng nhập mật khẩu");
        return false;
      }
      if (form.password !== form.confirm) {
        toast.error("Mật khẩu không khớp");
        return false;
      }
    }

    return true;
  };

  // 🔥 SUBMIT
  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const payload =
        type === "citizen"
          ? {
              phone: form.phone,
              name: form.name,
              location: form.location,
              note: form.note,
              role: "Người dân",
            }
          : {
              team: form.team,
              email: form.email,
              password: form.password,
              role: "Đội cứu trợ",
              area: form.area,
            };

      // 🔥 CALL API
      await axios.post("http://localhost:3001/api/users", payload);

      toast.success("Tạo người dùng thành công");

      onSubmit?.(payload);

      // reset form
      setForm({});
      setType("citizen");

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
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
      />

      {/* DRAWER */}
      <div className="w-[420px] bg-white h-full shadow-xl p-6 flex flex-col">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            Thêm người dùng
          </h2>

          <X
            className="w-5 h-5 cursor-pointer text-gray-400"
            onClick={onClose}
          />
        </div>

        {/* TYPE SWITCH */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-2">
            LOẠI NGƯỜI DÙNG
          </p>

          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setType("citizen")}
              className={`flex-1 py-2 rounded-lg text-sm ${
                type === "citizen"
                  ? "bg-white shadow font-medium text-blue-600"
                  : "text-gray-500"
              }`}
            >
              Người cần cứu trợ
            </button>

            <button
              onClick={() => setType("rescue")}
              className={`flex-1 py-2 rounded-lg text-sm ${
                type === "rescue"
                  ? "bg-white shadow font-medium text-blue-600"
                  : "text-gray-500"
              }`}
            >
              Đội cứu trợ
            </button>
          </div>
        </div>

        {/* FORM */}
        <div className="flex-1 overflow-y-auto space-y-4">

          {type === "citizen" && (
            <>
              <Input name="phone" label="Số điện thoại *" onChange={handleChange} />
              <Input name="name" label="Họ và tên" onChange={handleChange} />
              <Input name="location" label="Vị trí hiện tại" onChange={handleChange} />
              <Textarea name="note" label="Mô tả tình trạng" onChange={handleChange} />

              <StatusBadge text="CHƯA XÁC MINH" color="red" />
            </>
          )}

          {type === "rescue" && (
            <>
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

              <StatusBadge text="ĐÃ XÁC MINH" color="blue" />
            </>
          )}

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

const Textarea = ({ label, ...props }) => (
  <div>
    <p className="text-sm mb-1 text-gray-500">{label}</p>
    <textarea
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