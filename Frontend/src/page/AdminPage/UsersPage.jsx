import { useEffect, useState } from "react";
import api from "@/services/api/apiSos";

import StatsCards from "@/components/users/StatsCards";
import UserFilter from "@/components/users/UserFilter";
import UserTable from "@/components/users/UserTable";
import UserPagination from "@/components/users/UserPagination";
import CreateUserDrawer from "@/components/users/CreateUserDrawer";
import UserDetail from "@/components/users/UserDetail";

/** API GET /api/users trả { success, data: User[] } */
function extractUserList(res) {
  const body = res?.data;
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
}

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState({
      keyword: "",
      role: "",
      status: "",
    });
  
    const [loading, setLoading] = useState(true);
  
    // pagination 
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    //drawer
    const [openDrawer, setOpenDrawer] = useState(false);

    //dùng 1 state
    const [selectedUser, setSelectedUser] = useState(null);

    const handleView = (user) => {
    setSelectedUser(user);
    setOpenDetail(true);
    };
  
    useEffect(() => {
      setLoading(true);
  
      api
        .get("/users")
        .then((res) => setUsers(extractUserList(res)))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }, []);
  
    // FILTER
    const filteredUsers = (Array.isArray(users) ? users : []).filter((user) => {
      const name = user?.name || user?.full_name || "";
      const phone = user?.auth?.phone || "";
      const keyword = filters.keyword.toLowerCase();
    
      const matchKeyword =
        !keyword ||
        name.toLowerCase().includes(keyword) ||
        phone.includes(keyword) ||
        phone.replace("+84", "0").includes(keyword) ||
        phone.replace("0", "+84").includes(keyword);
    
      const matchRole =
        !filters.role || user?.role === filters.role;
    
      const matchStatus =
        !filters.status ||
        user?.status === filters.status;
    
      return matchKeyword && matchRole && matchStatus;
    });
  
    // PAGINATION LOGIC
    const totalPages = Math.ceil(filteredUsers.length / pageSize);

  
    const paginatedUsers = filteredUsers.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

    const statsData = [
      {
        title: "TỔNG CỘNG (DN)",
        value: users.length,
      },
      {
        title: "LỰC LƯỢNG",
        value: users.filter((u) => u.role === "Rescue").length,
      },
      {
        title: "ĐANG HOẠT ĐỘNG",
        value: users.filter((u) => String(u.status || "").toLowerCase() === "active").length,
      },
      {
        title: "NGƯNG HOẠT ĐỘNG",
        value: users.filter((u) => String(u.status || "").toLowerCase() !== "active").length,
      },
    ];

    const handleToggleStatus = async (user) => {
      if (user.role === "Admin") return; // double guard
    
      const isActive = user.status === "Active";
      const confirmed = window.confirm(
        isActive ? "Xác nhận KHÓA tài khoản này?" : "Xác nhận MỞ KHÓA tài khoản này?"
      );
      if (!confirmed) return;
    
      try {
        const res = await api.patch(`/users/${user._id}/toggle-active`);
    
        // ✅ Dùng data từ server, không tự tính newStatus
        const updatedUser = res.data?.user ?? res.data?.data;
        if (!updatedUser) throw new Error("Response không có user");
    
        setUsers((prev) =>
          prev.map((u) => (u._id === user._id ? updatedUser : u))
        );
    
        // ✅ Chỉ sync nếu đúng user đang mở
        setSelectedUser((prev) =>
          prev?._id === user._id ? updatedUser : prev
        );
      } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra, vui lòng thử lại.");
      }
    };

    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Quản lý Người dùng Đà Nẵng
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Giám sát lực lượng tham gia cứu hộ và tại địa bàn thành phố.
            </p>
          </div>
  
          <div className="flex gap-3">
          
            <button
              onClick={() => setOpenDrawer(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
              >
              + Thêm người dùng
            </button>
          </div>
        </div>
  
        <StatsCards stats={statsData} />
  
        <UserFilter
          onFilter={(data) => {
          setFilters(data);
          setCurrentPage(1); // reset page khi filter
        }}
      />
  
        <UserTable
          users={paginatedUsers}
          loading={loading}
          onView={(user) => setSelectedUser(user)}
          onToggleStatus={handleToggleStatus}
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

              const res = await api.get("/users");
              
              setUsers(extractUserList(res));
              
              setOpenDrawer(false);
            } catch (err) {
              console.error(err);
            } finally {
              setLoading(false);
            }
          }}
        />

        <UserDetail
          user={selectedUser}
          open={!!selectedUser}
          onClose={() =>  setSelectedUser(null)}
          onToggleStatus={handleToggleStatus}
        />
      </div>
    );
  };
  
  export default UsersPage;