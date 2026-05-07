import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SosPage from '@/page/Requester';
import TrackingPage from '@/page/TrackingPage';
import AdminLayout from '@/layouts/AdminLayout';
import IncidentManagement from '@/page/AdminPage/IncidentManagement';
import AdminTrackingPage from '@/page/AdminPage/AdminTrackingPage';
import DashboardPage from '@/page/AdminPage/DashboardPage';
import AdminPlaceholder from '@/page/AdminPage/AdminPlaceholder';
import StaffLoginPage from '@/page/StaffLoginPage';
import ResponderPage from '@/page/ResponderPage';
import ResponderTeamInfoPage from '@/page/ResponderTeamInfoPage';
import ResponderTeamEditPage from '@/page/ResponderTeamEditPage';
import RequesterProfile from '@/components/requester/RequesterProfile';
import {
  StaffLoginGate,
  StaffRoleGuard,
  StaffHomeRedirect,
} from '@/components/auth/AuthGuards';
import { STAFF_ROLE_ADMIN, STAFF_ROLE_RESCUE } from '@/services/auth/session';
import UsersPage from '@/page/AdminPage/UsersPage';
import HistoryPage from '@/page/AdminPage/HistoryPage';
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
        <Route path="/profile" element={<RequesterProfile />} />
        <Route path="/sospage" element={<Navigate to="/sos" replace />} />
        <Route path="/tracking/:sosId" element={<TrackingPage />} />
        <Route path="/profile" element={<Navigate to="/profile" replace />} />
        <Route
          path="/staff-login"
          element={
            <StaffLoginGate>
              <StaffLoginPage />
            </StaffLoginGate>
          }
        />
        <Route
          path="/admin"
          element={
            <StaffRoleGuard allowRoles={[STAFF_ROLE_ADMIN]}>
              <AdminLayout />
            </StaffRoleGuard>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="incidents" element={<IncidentManagement />} />
          <Route path="tracking/:sosId" element={<AdminTrackingPage />} />
          <Route path="users" element={<UsersPage title="Quản lý người dùng" />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<AdminPlaceholder title="Cài đặt" />} />
        </Route>
        <Route
          path="/responder"
          element={
            <StaffRoleGuard allowRoles={[STAFF_ROLE_RESCUE]}>
              <ResponderPage />
            </StaffRoleGuard>
          }
        />
        <Route
          path="/responder/tracking/:sosId"
          element={
            <StaffRoleGuard allowRoles={[STAFF_ROLE_RESCUE]}>
              <TrackingPage />
            </StaffRoleGuard>
          }
        />
        <Route
          path="/responder/team-info"
          element={
            <StaffRoleGuard allowRoles={[STAFF_ROLE_RESCUE]}>
              <ResponderTeamInfoPage />
            </StaffRoleGuard>
          }
        />
        <Route
          path="/responder/team-info/edit"
          element={
            <StaffRoleGuard allowRoles={[STAFF_ROLE_RESCUE]}>
              <ResponderTeamEditPage />
            </StaffRoleGuard>
          }
        />
        <Route path="/staff" element={<StaffHomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
