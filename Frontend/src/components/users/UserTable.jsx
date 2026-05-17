import UserRow from "./UserRow";

const UserTable = ({ users = [], loading, onView, onToggleStatus }) => {  
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        
        <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Họ tên & ID</th>
            <th className="px-4 py-3 text-left">Vai trò</th>
            <th className="px-4 py-3 text-left">Trạng thái</th>
            <th className="px-4 py-3 text-left">SĐT</th>
            <th className="px-4 py-3 text-left">Vị trí hiện tại</th>
            <th className="px-4 py-3 text-left">Hành động</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan="6" className="text-center py-6 text-gray-400">
                Đang tải dữ liệu...
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center py-6 text-gray-400">
                Không có dữ liệu
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <UserRow
                key={user._id || user.id}
                user={user}
                onView={onView}
                onToggleStatus={onToggleStatus}
            />
            ))
          )}
        </tbody>

      </table>
    </div>
  );
};

export default UserTable;