import { useState } from "react";

export default function UserFilter({ onFilter }) {
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  const handleFilter = () => {
    if (onFilter) {
      onFilter({ keyword, role, status });
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-4 flex flex-wrap gap-3">
      
      {/* SEARCH */}
      <input
        type="text"
        placeholder="Tìm kiếm theo tên hoặc số điện thoại"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        className="border px-3 py-2 rounded w-64"
      />

      {/* ROLE */}
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="border px-3 py-2 rounded"
      >
        <option value="">Tất cả vai trò</option>
        <option value="Admin">Admin</option>
        <option value="Rescue">Rescue</option>
        <option value="Victim">Victim</option>
      </select>

      {/* STATUS */}
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="border px-3 py-2 rounded"
      >
        <option value="">Tất cả trạng thái</option>
        <option value="Active">Đang hoạt động</option>
        <option value="Blocked">Đã khóa</option>
      </select>

      {/* BUTTON */}
      <button
        onClick={handleFilter}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Lọc
      </button>
    </div>
  );
}