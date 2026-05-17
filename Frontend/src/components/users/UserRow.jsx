import { MapPin, Info, Lock, Unlock } from "lucide-react";
import { ROLE_CONFIG, STATUS_CONFIG } from "@/utils/userUI";
import { getUserAvatarSrc } from "@/lib/userAvatar";

const UserRow = ({ user = {}, onView, onToggleStatus }) => {
  const role = ROLE_CONFIG?.[user?.role];
  const status = STATUS_CONFIG?.[user?.status];

  const RoleIcon = role?.icon;
  const StatusIcon = status?.icon;

  // ✅ chỉ giữ 1 isActive
  const isActive =
    String(user?.status || "").toLowerCase() === "active";

  // ✅ chỉ cho khóa Victim & Rescue
  const roleKey = String(user?.role || "")
    .trim()
    .toLowerCase();

  const canLockAccount =
    roleKey === "victim" || roleKey === "rescue";

  return (
    <tr className="border-t hover:bg-gray-50">

      {/* USER */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={getUserAvatarSrc(user)}
            className="h-11 w-11 rounded-full object-cover"
            alt=""
          />
        <div>
          <p className="font-semibold text-base">
            {user?.full_name || user?.name || 'Chưa có tên'}
          </p>
          <p className="text-xs text-gray-400">
            {user?.auth?.email || 'Không có email'}
          </p>
          <p className="text-xs text-gray-400">
            UID: {user?._id || user?.id || '--'}
          </p>
        </div>
      </div>
    </td>

      {/* ROLE */}
      <td className="px-4 py-3">
        <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${role?.className || ''}`}>
          {RoleIcon ? <RoleIcon className="size-4 shrink-0" aria-hidden /> : null}
          {user?.role || '--'}
        </div>
      </td>

      {/* STATUS */}
      <td className="px-4 py-3">
        <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${status?.className || ''}`}>
          {StatusIcon ? <StatusIcon className="size-4 shrink-0" aria-hidden /> : null}
          {user?.status || '--'}
        </div>
      </td>

      {/* PHONE */}
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-gray-800">
          {user?.auth?.phone || '--'}
        </span>
      </td>

      {/* LOCATION */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <MapPin className="size-5 shrink-0 text-blue-500" aria-hidden />
          {user?.profile?.address || user?.location || 'Chưa rõ'}
        </div>
      </td>

      {/* ACTION */}
      <td className="px-4 py-3">
      <div className="flex gap-4">
      <button
        type="button"
        className="inline-flex text-gray-400 hover:text-blue-600 transition-colors"
        onClick={() => onView?.(user)}
        title="Xem chi tiết"
      >
        <Info className="size-6" />
      </button>

      {canLockAccount && (
      <button
        type="button"
        className={`inline-flex transition-colors ${
          isActive
            ? "text-gray-400 hover:text-red-500"
            : "text-gray-400 hover:text-green-600"
        }`}
        onClick={() => onToggleStatus?.(user)}
        title={isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
      >
        {isActive ? <Lock className="size-6" /> : <Unlock className="size-6" />}
      </button>
    )}
  </div>
</td>

    </tr>
  );
};

export default UserRow;