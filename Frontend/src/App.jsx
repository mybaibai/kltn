import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SosPage from '@/page/SosPage';
import TrackingPage from '@/page/TrackingPage';
import AdminLayout from '@/layouts/AdminLayout';
import IncidentManagement from '@/page/AdminPage/IncidentManagement';
import AdminTrackingPage from '@/page/AdminPage/AdminTrackingPage';
import AdminPlaceholder from '@/page/AdminPage/AdminPlaceholder';
import StaffLoginPage from '@/page/StaffLoginPage';
import ResponderPage from '@/page/ResponderPage';
import { StaffLoginGate, StaffRoleGuard, StaffHomeRedirect } from '@/components/auth/AuthGuards';
import { STAFF_ROLE_ADMIN, STAFF_ROLE_RESCUE } from '@/services/auth/session';
import { User, Users } from 'lucide-react';
import UsersPage from '@/page/AdminPage/UsersPage';
import { Toaster } from 'react-hot-toast';



export default function App() {
  return (
    <BrowserRouter>

    <Toaster
      position="top-right"
      toastOptions={{
      duration: 3000,
      style: {
      fontSize: "14px",
      },
    }}
  />

      <Routes>
        <Route path="/" element={<SosPage />} />
        <Route path="/sos" element={<SosPage />} />
        <Route path="/SosPage" element={<Navigate to="/sos" replace />} />
        <Route path="/sospage" element={<Navigate to="/sos" replace />} />
        <Route path="/tracking/:sosId" element={<TrackingPage />} />
        
        <Route
          path="/staff-login"
          element={(
            <StaffLoginGate>
              <StaffLoginPage />
            </StaffLoginGate>
          )}
        />
        <Route
          path="/admin"
          element={(
            <StaffRoleGuard allowRoles={[STAFF_ROLE_ADMIN]}>
              <AdminLayout />
            </StaffRoleGuard>
          )}
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminPlaceholder title="Dashboard" />} />
          <Route path="incidents" element={<IncidentManagement />} />
          <Route path="tracking/:sosId" element={<AdminTrackingPage />} />
          <Route path="users" element={<UsersPage title="Quản lý người dùng" />} />
          <Route path="history" element={<AdminPlaceholder title="Lịch sử" />} />
          <Route path="settings" element={<AdminPlaceholder title="Cài đặt" />} />
        </Route>
        <Route
          path="/responder"
          element={(
            <StaffRoleGuard allowRoles={[STAFF_ROLE_RESCUE]}>
              <ResponderPage />
            </StaffRoleGuard>
          )}
        />
        <Route path="/staff" element={<StaffHomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
