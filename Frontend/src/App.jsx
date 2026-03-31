import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SosPage from '@/page/SosPage';
import TrackingPage from '@/page/TrackingPage';
import ResponderPage from '@/page/ResponderPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SosPage />} />
        <Route path="/tracking/:sosId" element={<TrackingPage />} />
        <Route path="/responder" element={<ResponderPage />} />
        <Route path="/responder/:teamId" element={<ResponderPage />} />
      </Routes>
    </BrowserRouter>
  );
}