import LocationIcon from "@/assets/icons/Icon-10.svg?react";
import EditIcon from "@/assets/icons/Icon-2.svg?react";
import DeleteIcon from "@/assets/icons/Icon-3.svg?react";



const UserRow = ({ user = {}, onEdit, onDelete }) => {
  const role = ROLE_CONFIG?.[user?.role];
  const status = STATUS_CONFIG?.[user?.status];

  const RoleIcon = role?.icon;
  const StatusIcon = status?.icon; 

  return (
    <tr className="border-t hover:bg-gray-50">
      
      {/* USER */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={user?.avatar || "/default-avatar.png"}
            className="w-10 h-10 rounded-full object-cover"
          />

          <div>
            <p className="font-medium">{user?.name || "Chưa có tên"}</p>
            <p className="text-xs text-gray-400">
              UID: {user?._id || user?.id || "--"}
            </p>
          </div>
        </div>
      </td>

      {/* ROLE */}
      <td>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium w-fit ${role?.className || ""}`}>
          {RoleIcon && <RoleIcon className="w-3 h-3" />}
          {user?.role || "--"}
        </div>
      </td>

      {/* STATUS */}
      <td>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium w-fit ${status?.className || ""}`}>
          {StatusIcon && <StatusIcon className="w-3 h-3" />}
          {user?.status || "--"}
        </div>
      </td>

      {/* LOCATION */}
      <td>
        <div className="flex items-center gap-2 text-gray-600 text-sm">
          <LocationIcon className="w-4 h-4 text-blue-500" />
          {user?.location || "Chưa rõ"}
        </div>
      </td>

      {/* ACTION */}
      <td>
        <div className="flex gap-3">
          <EditIcon
            className="w-4 h-4 cursor-pointer hover:text-blue-600"
            onClick={() => onEdit?.(user)}
          />
          <DeleteIcon
            className="w-4 h-4 cursor-pointer hover:text-red-500"
            onClick={() => onDelete?.(user)}
          />
        </div>
      </td>

    </tr>
  );
};

export default UserRow;