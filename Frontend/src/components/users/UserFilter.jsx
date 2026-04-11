import { useState } from "react";

import { DA_NANG_WARDS } from "@/constants/wards";

export default function UserFilter({ onFilter }) {
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState("");
  const [ward, setWard] = useState(""); 
  const handleFilter = () => {
    if (onFilter) {
      onFilter({ keyword, role, ward });
    } // gửi ra ngoài
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
        <option value="Người dân">Người dân</option>
        <option value="Đội cứu trợ">Đội cứu trợ</option>
      </select>

      {/* 🔥 WARD FILTER */}
      <select
        value={ward}
        onChange={(e) => setWard(e.target.value)}
        className="border px-3 py-2 rounded"
      >
        <option value="">Tất cả Phường</option>

        {(DA_NANG_WARDS || []).map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
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