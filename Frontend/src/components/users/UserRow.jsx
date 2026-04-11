import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { ROLE_CONFIG, STATUS_CONFIG } from '@/utils/userUI';

const UserRow = ({ user = {}, onEdit, onDelete }) => {
  const role = ROLE_CONFIG?.[user?.role];
  const status = STATUS_CONFIG?.[user?.status];

  const RoleIcon = role?.icon;
  const StatusIcon = status?.icon;

  return (
    <tr className="border-t hover:bg-gray-50">

      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={user?.profile?.avatar_url || user?.avatar || '/default-avatar.png'}
            className="h-10 w-10 rounded-full object-cover"
            alt=""
          />

          <div>
            <p className="font-medium">{user?.full_name || user?.name || 'Chưa có tên'}</p>
            <p className="text-xs text-gray-400">
              UID: {user?._id || user?.id || '--'}
            </p>
          </div>
        </div>
      </td>

      <td>
        <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${role?.className || ''}`}>
          {RoleIcon ? <RoleIcon className="size-3 shrink-0" aria-hidden /> : null}
          {user?.role || '--'}
        </div>
      </td>

      <td>
        <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${status?.className || ''}`}>
          {StatusIcon ? <StatusIcon className="size-3 shrink-0" aria-hidden /> : null}
          {user?.status || '--'}
        </div>
      </td>

      <td>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="size-4 shrink-0 text-blue-500" aria-hidden />
          {user?.profile?.address || user?.location || 'Chưa rõ'}
        </div>
      </td>

      <td>
        <div className="flex gap-3">
          <button
            type="button"
            className="inline-flex text-gray-500 hover:text-blue-600"
            onClick={() => onEdit?.(user)}
            aria-label="Sửa"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            className="inline-flex text-gray-500 hover:text-red-500"
            onClick={() => onDelete?.(user)}
            aria-label="Xóa"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>

    </tr>
  );
};

export default UserRow;
