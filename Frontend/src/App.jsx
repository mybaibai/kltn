import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SosPage from '@/page/SosPage';
import TrackingPage from '@/page/TrackingPage';
import AdminLayout from '@/layouts/AdminLayout';
import IncidentManagement from '@/page/AdminPage/IncidentManagement';
import AdminPlaceholder from '@/page/AdminPage/AdminPlaceholder';
import StaffLoginPage from '@/page/StaffLoginPage';
import StaffHomePage from '@/page/StaffHomePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SosPage />} />
        <Route path="/tracking/:sosId" element={<TrackingPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<IncidentManagement />} />
          <Route path="dashboard" element={<AdminPlaceholder title="Dashboard" />} />
          <Route path="users" element={<AdminPlaceholder title="Quản lý người dùng" />} />
          <Route path="ai" element={<AdminPlaceholder title="Hoạt động AI" />} />
          <Route path="history" element={<AdminPlaceholder title="Lịch sử" />} />
          <Route path="settings" element={<AdminPlaceholder title="Cài đặt" />} />
        </Route>
        <Route path="/staff-login" element={<StaffLoginPage />} />
        <Route path="/staff" element={<StaffHomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
