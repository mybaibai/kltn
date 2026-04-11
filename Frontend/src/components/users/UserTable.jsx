import { useEffect, useState } from "react";
import axios from "axios";
import UserRow from "./UserRow";

const UserTable = ({ users = [], loading, onEdit, onDelete }) => {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Họ tên & ID</th>
            <th>Vai trò</th>
            <th>Xác minh</th>
            <th>Vị trí hiện tại</th>
            <th>Hành động</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan="5" className="text-center py-6 text-gray-400">
                Đang tải dữ liệu...
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan="5" className="text-center py-6 text-gray-400">
                Không có dữ liệu
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <UserRow
                key={user._id}
                user={user}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </tbody>

      </table>
    </div>
  );
};

export default UserTable; 