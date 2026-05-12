import { X, Lock, Unlock } from "lucide-react";
import { getUserAvatarSrc } from "@/lib/userAvatar";

const UserDetail = ({ user, open, onClose, onToggleStatus }) => {
  if (!open || !user) return null;

  const isActive = String(user?.status || "").toLowerCase() === "active";
  const roleKey = String(user?.role || "").trim().toLowerCase();
  const canLockAccount = roleKey === "victim" || roleKey === "rescue";

  const formatDate = (date) => {
    if (!date) return "--";
    return new Date(date).toLocaleDateString("vi-VN");
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      
      {/* OVERLAY */}
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
      />

      {/* DRAWER */}
      <div className="w-[420px] bg-white h-full shadow-xl flex flex-col">

        {/* HEADER */}
        <div className="p-6 border-b relative">
          <X
            className="absolute right-4 top-4 w-5 h-5 text-gray-400 cursor-pointer"
            onClick={onClose}
          />

          <div className="flex flex-col items-start gap-3">
            <img
              src={getUserAvatarSrc(user)}
              className="w-20 h-20 rounded-full object-cover border"
              alt=""
            />

            <div>
              <p className="text-lg font-semibold">
                {user?.full_name || "--"}
              </p>

              <span className="inline-block mt-1 px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-600">
                {user?.role || "--"}
              </span>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* THÔNG TIN LIÊN HỆ */}
          <div>
            <p className="text-xs text-gray-400 mb-3 uppercase">
              Thông tin liên hệ
            </p>

            <div className="space-y-3">
              <Field label="Email" value={user?.auth?.email} />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Số điện thoại"
                  value={user?.auth?.phone}
                />
                <Field
                  label="Địa chỉ"
                  value={user?.profile?.address}
                />
              </div>
            </div>
          </div>

          {/* THÔNG TIN KHẨN CẤP */}
          <div>
            <p className="text-xs text-gray-400 mb-3 uppercase">
              Thông tin khẩn cấp
            </p>

            <Field
              label="Liên hệ khẩn cấp"
              value={user?.profile?.emergency_contact}
            />
          </div>

          {/* THÔNG TIN HỆ THỐNG */}
          <div>
            <p className="text-xs text-gray-400 mb-3 uppercase">
              Thông tin hệ thống
            </p>

            <div className="space-y-2 text-sm">
              <Row
                label="Mã người dùng"
                value={user?._id || "--"}
              />
              <Row
                label="Ngày tạo"
                value={formatDate(user?.created_at)}
              />
              <Row
                label="Cập nhật lần cuối"
                value={formatDate(user?.updated_at)}
              />
            </div>
          </div>

        </div>

        {/* ACTION */}
        <div className="p-4 border-t flex gap-3">
          {canLockAccount ? (
          <button
            onClick={() => onToggleStatus?.(user)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border
              ${
                isActive
                  ? "border-red-500 text-red-600"
                  : "border-green-500 text-green-600"
              }`}
          >
            {isActive ? (
              <>
                <Lock className="w-4 h-4" />
                Khóa
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                Mở khóa
              </>
            )}
          </button>
          ) : null}

          <button
            onClick={onClose}
            className={`${canLockAccount ? "flex-1" : "w-full"} bg-gray-100 py-2 rounded-lg`}
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};

/* ================= COMPONENT CON ================= */

const Field = ({ label, value }) => (
  <div className="border rounded-lg p-3 bg-gray-50">
    <p className="text-xs text-gray-400 mb-1">{label}</p>
    <p className="text-sm">
      {value || "Chưa cập nhật"}
    </p>
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex justify-between border-b py-2 last:border-none">
    <span className="text-gray-500">{label}</span>
    <span>{value || "--"}</span>
  </div>
);

export default UserDetail;