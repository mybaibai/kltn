import { MapPin, Info, Lock, Unlock } from "lucide-react";
import { ROLE_CONFIG, STATUS_CONFIG } from "@/utils/userUI";

const UserRow = ({ user = {}, onView, onToggleStatus }) => {
  const role = ROLE_CONFIG?.[user?.role];
  const status = STATUS_CONFIG?.[user?.status];

  const RoleIcon = role?.icon;
  const StatusIcon = status?.icon;
  
  const isAdmin = user?.role === "Admin";
  const isActive = user?.status === "Active";

  return (
    <tr className="border-t hover:bg-gray-50">

      {/* USER */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={user?.profile?.avatar_url || user?.avatar || '/avatar.svg'}
            className="h-10 w-10 rounded-full object-cover"
            alt=""
          />

          <div>
            <p className="font-medium">
              {user?.full_name || user?.name || 'Chưa có tên'}
            </p>

            {/* EMAIL */}
            <p className="text-xs text-gray-400">
              {user?.auth?.email || 'Không có email'}
            </p>

            {/* UID */}
            <p className="text-xs text-gray-400">
              UID: {user?._id || user?.id || '--'}
            </p>
          </div>
        </div>
      </td>

      {/* ROLE */}
      <td>
        <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${role?.className || ''}`}>
          {RoleIcon ? <RoleIcon className="size-3 shrink-0" aria-hidden /> : null}
          {user?.role || '--'}
        </div>
      </td>

      {/* STATUS */}
      <td>
        <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${status?.className || ''}`}>
          {StatusIcon ? <StatusIcon className="size-3 shrink-0" aria-hidden /> : null}
          {user?.status || '--'}
        </div>
      </td>

      {/* PHONE */}
      <td>
        <span className="text-sm text-gray-600">
          {user?.auth?.phone || '--'}
        </span>
      </td>

      {/* LOCATION */}
      <td>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="size-4 shrink-0 text-blue-500" aria-hidden />
          {user?.profile?.address || user?.location || 'Chưa rõ'}
        </div>
      </td>

      {/* ACTION */}
      <td>
        <div className="flex gap-3">

          {/* XEM CHI TIẾT */}
          <button
            type="button"
            className="inline-flex text-gray-500 hover:text-blue-600"
            onClick={() => onView?.(user)}
            title="Xem chi tiết"
          >
            <Info className="size-4" />
          </button>

          {/* KHÓA / MỞ KHÓA */}
          {!isAdmin && (
            <button
            type="button"
            className={`inline-flex ${
              isActive
                ? "text-gray-500 hover:text-red-500"
                : "text-gray-500 hover:text-green-600"
            }`} 
            onClick={() => onToggleStatus?.(user)}
            title={isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
          >
            {isActive ? (
              <Lock className="size-4" />
            ) : (
              <Unlock className="size-4" />
              )}
          </button>
)}

        </div>
      </td>

    </tr>
  );
};

export default UserRow;