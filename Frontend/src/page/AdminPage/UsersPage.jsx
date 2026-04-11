import { useEffect, useState } from "react";
import axios from "axios";

import StatsCards from "@/components/users/StatsCards";
import UserFilter from "@/components/users/UserFilter";
import UserTable from "@/components/users/UserTable";
import UserPagination from "@/components/users/UserPagination";
import CreateUserDrawer from "@/components/users/CreateUserDrawer";

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState({
      keyword: "",
      role: "",
      ward: "",
    });
  
    const [loading, setLoading] = useState(true);
  
    // 🔥 pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const [openDrawer, setOpenDrawer] = useState(false);
  
    useEffect(() => {
      setLoading(true);
  
      axios
        .get("http://localhost:3001/api/users")
        .then((res) => setUsers(res.data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }, []);
  
    // 🔥 FILTER
    const filteredUsers = (users || []).filter((user) => {
      const name = user?.name || "";
  
      const matchKeyword =
        name.toLowerCase().includes(filters.keyword.toLowerCase());
  
      const matchRole =
        !filters.role || user?.role === filters.role;
  
      const matchWard =
        !filters.ward || user?.location?.includes(filters.ward);
  
      return matchKeyword && matchRole && matchWard;
    });
  
    // 🔥 PAGINATION LOGIC
    const totalPages = Math.ceil(filteredUsers.length / pageSize);
  
    const paginatedUsers = filteredUsers.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Quản lý Người dùng Đà Nẵng
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Giám sát và phân quyền lực lượng tham gia cứu hộ tại địa bàn thành phố.
            </p>
          </div>
  
          <div className="flex gap-3">
            <button className="px-4 py-2 border rounded-lg text-sm">
              Xuất báo cáo
            </button>
  
            <button
              onClick={() => setOpenDrawer(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
              >
              + Thêm người dùng
            </button>
          </div>
        </div>
  
        <StatsCards />
  
        <UserFilter
          onFilter={(data) => {
          setFilters(data);
          setCurrentPage(1); // 🔥 reset page khi filter
        }}
      />
  
        <UserTable
          users={paginatedUsers}
          loading={loading}
          onEdit={(user) => console.log("Edit:", user)}
          onDelete={(user) => console.log("Delete:", user)}
      />
  
        <UserPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            if (page < 1 || page > totalPages) return;
            setCurrentPage(page);
          }}
        />

        <CreateUserDrawer
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
          onSubmit={async () => {
            setCurrentPage(1);
            try {
              setLoading(true);

              const res = await axios.get("http://localhost:3001/api/users");
              setUsers(res.data);
              
              
              setOpenDrawer(false);
            } catch (err) {
              console.error(err);
            } finally {
              setLoading(false);
            }
          }}
        />
      </div>
    );
  };
  
  export default UsersPage;