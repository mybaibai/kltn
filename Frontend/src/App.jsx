import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SosPage from '@/page/SosPage';
import TrackingPage from '@/page/TrackingPage';
import StaffLoginPage from '@/page/StaffLoginPage';
import StaffHomePage from '@/page/StaffHomePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SosPage />} />
        <Route path="/tracking/:sosId" element={<TrackingPage />} />
        <Route path="/staff-login" element={<StaffLoginPage />} />
        <Route path="/staff" element={<StaffHomePage />} />
      </Routes>
    </BrowserRouter>
  );
}