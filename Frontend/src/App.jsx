import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SosPage from '@/page/SosPage';
import TrackingPage from '@/page/TrackingPage';
import TrackingMissionPage from '@/page/TrackingMissionPage';
import ResponderTeamPage from '@/page/ResponderTeamPage';
import ResponderTeamEditPage from '@/page/ResponderTeamEditPage';
import StaffLoginPage from '@/page/StaffLoginPage';
import AdminPage from '@/page/AdminPage';
import ResponderPage from '@/page/ResponderPage';
import { StaffHomeRedirect, StaffLoginGate, StaffRoleGuard } from '@/components/auth/AuthGuards';
import { STAFF_ROLE_ADMIN, STAFF_ROLE_RESCUE } from '@/services/auth/session';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/staff-login" replace />} />
        <Route path="/sos" element={<SosPage />} />
        <Route path="/SosPage" element={<Navigate to="/sos" replace />} />
        
        <Route path="/tracking/:sosId" element={<TrackingPage />} />
        <Route path="/tracking-mission/:sosId" element={<TrackingMissionPage />} />
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
              <AdminPage />
            </StaffRoleGuard>
          )}
        />
        <Route
          path="/responder"
          element={(
            <StaffRoleGuard allowRoles={[STAFF_ROLE_RESCUE]}>
              <ResponderPage />
            </StaffRoleGuard>
          )}
        />
        <Route
          path="/responder/team"
          element={(
            <StaffRoleGuard allowRoles={[STAFF_ROLE_RESCUE]}>
              <ResponderTeamPage />
            </StaffRoleGuard>
          )}
        />
        <Route
          path="/responder/team/edit"
          element={(
            <StaffRoleGuard allowRoles={[STAFF_ROLE_RESCUE]}>
              <ResponderTeamEditPage />
            </StaffRoleGuard>
          )}
        />
        <Route path="/staff" element={<StaffHomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}