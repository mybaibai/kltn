import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MapView from '@/components/Map';
import { getSosDetail } from '@/services/api/apiSos';
import {
  CheckCircle2, Clock, Loader2, ShieldCheck,
  MapPin, User, Phone, AlertTriangle,
  Ambulance, Search, X, RefreshCw
} from 'lucide-react';

const STEPS = [
  { key: 'SENT',        label: 'Đã gửi yêu cầu' },
  { key: 'PENDING',     label: 'Đang chờ tiếp nhận' },
  { key: 'IN_PROGRESS', label: 'Đang hỗ trợ' },
  { key: 'RESOLVED',    label: 'Hoàn thành' },
];

const STATUS_TO_STEP = {
  PENDING:     1,
  ASSIGNED:    1,
  IN_PROGRESS: 2,
  RESOLVED:    3,
  CANCELLED:   1,
};

const PRIORITY_CONFIG = {
  HIGH:   { label: 'Cao / Khẩn cấp', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  MEDIUM: { label: 'Trung bình',      color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  LOW:    { label: 'Thấp',            color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
};

const INCIDENT_LABEL = {
  vehicle: 'Sự cố phương tiện',
  fire:    'Cháy nổ',
  medical: 'Sức khỏe khẩn cấp',
  natural: 'Thiên tai',
  lost:    'Lạc đường',
  other:   'Khác',
};

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function StepIcon({ state }) {
  if (state === 'done') return (
    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center ring-4 ring-green-100">
      <CheckCircle2 size={20} className="text-white" />
    </div>
  );
  if (state === 'active') return (
    <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center ring-4 ring-amber-100 animate-pulse">
      <Loader2 size={20} className="text-white animate-spin" />
    </div>
  );
  return (
    <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
      <Clock size={18} className="text-gray-300" />
    </div>
  );
}

function ProgressTracker({ currentStep }) {
  return (
    <div className="px-8 pt-6 pb-4">
      <div className="relative flex justify-between items-start">
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200" />
        <div
          className="absolute top-5 left-5 h-0.5 bg-green-500 transition-all duration-700"
          style={{
            width: currentStep === 0 ? '0%'
                 : currentStep === 1 ? '33.3%'
                 : currentStep === 2 ? '66.6%'
                 : '100%'
          }}
        />
        {STEPS.map((step, idx) => {
          const state = idx < currentStep ? 'done' : idx === currentStep ? 'active' : 'inactive';
          return (
            <div key={step.key} className="flex flex-col items-center gap-2 z-10">
              <StepIcon state={state} />
              <span className={`text-[11px] font-semibold text-center leading-tight max-w-[72px]
                ${idx < currentStep ? 'text-green-600' : idx === currentStep ? 'text-amber-500' : 'text-gray-300'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const { sosId } = useParams();
  const navigate = useNavigate();
  const [sos, setSos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!sosId) return;
    const fetchSos = async () => {
      try {
        const res = await getSosDetail(sosId);
        setSos(res.data.data);
      } catch {
        setSos(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSos();
    const interval = setInterval(fetchSos, 10000);
    return () => clearInterval(interval);
  }, [sosId]);
  useEffect(() => {
    if (sos) console.log('SOS data:', JSON.stringify(sos, null, 2));
  }, [sos]);
  const handleCancel = () => {
    setCancelled(true);
    setTimeout(() => navigate('/'), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-gray-400" size={32} />
    </div>
  );

  if (!sos) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <AlertTriangle className="text-red-400" size={36} />
      <p className="text-gray-500 text-sm">Không tìm thấy yêu cầu</p>
    </div>
  );

  const currentStep = STATUS_TO_STEP[sos.status] ?? 1;
  const isCancelled = sos.status === 'CANCELLED';
  const isResolved = sos.status === 'RESOLVED';

  const coords = sos.location?.coordinates;
  const userPos = coords?.length === 2
    ? { lat: coords[1], lng: coords[0], label: '📍 Vị trí sự cố' }
    : null;

  const priority = sos.priority || 'HIGH';
  const pConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.HIGH;
  const requestCode = sos._id ? `#SOS-${String(sos._id).slice(-4).toUpperCase()}` : '#SOS-????';
  const incidentLabel = INCIDENT_LABEL[sos.incident_type] || sos.incident_type || '—';

  const userName = sos.victim_id?.full_name || '—';
  const userPhone = sos.victim_id?.phone || '—';
  const userAddress = sos.address || '—';

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-6">

      {/* Toast huỷ */}
      {cancelled && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          ✅ Đã huỷ yêu cầu cứu trợ
        </div>
      )}

      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden">

        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-base leading-tight">
                  Yêu cầu cứu trợ đã được gửi
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isCancelled ? 'bg-gray-400'
                    : isResolved ? 'bg-green-500'
                    : 'bg-amber-400 animate-pulse'
                  }`} />
                  <span className="text-xs text-gray-500">
                    {isCancelled ? 'Yêu cầu đã bị huỷ'
                     : isResolved ? 'Đã hoàn thành'
                     : 'Đang chờ đội cứu trợ nhận'}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full flex-shrink-0">
              {requestCode}
            </span>
          </div>
        </div>

        {/* PROGRESS */}
        <ProgressTracker currentStep={currentStep} />

        <div className="h-px bg-gray-100 mx-6" />

        {/* INFO */}
        <div className="px-6 py-4 space-y-3">

          {/* Loại sự cố + mức độ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Loại sự cố</p>
              <p className="text-sm font-semibold text-gray-800">{incidentLabel}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Mức độ</p>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${pConfig.bg} ${pConfig.color} ${pConfig.border}`}>
                {pConfig.label}
              </span>
            </div>
          </div>

          {/* Mô tả */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Mô tả</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {sos.description || <span className="italic text-gray-400">Không có mô tả</span>}
            </p>
          </div>

          {/* Người gửi + vị trí */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Người gửi</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{userName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Phone size={10} className="text-gray-400" />
                    <p className="text-xs text-gray-500">{userPhone}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Thời gian gửi</p>
              <p className="text-xs text-gray-700">{formatTime(sos.createdAt || sos.created_at)}</p>
            </div>
          </div>

          {/* Vị trí */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Vị trí</p>
            <div className="flex items-start gap-2">
              <MapPin size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 leading-relaxed">{userAddress}</p>
            </div>
          </div>

          {/* Đội cứu trợ nếu có */}
          {sos.assigned_rescue_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Ambulance size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-0.5">Đội đang hỗ trợ</p>
                  <p className="text-sm font-semibold text-blue-800">{sos.assigned_rescue_id.full_name}</p>
                  {sos.assigned_rescue_id.phone && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone size={10} className="text-blue-400" />
                      <p className="text-xs text-blue-500">{sos.assigned_rescue_id.phone}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Đang tìm đội */}
          {!isCancelled && currentStep < 2 && (
            <div className="flex items-center gap-2">
              <Search size={13} className="text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-500 italic">Hệ thống đang tìm đội cứu trợ gần nhất...</p>
            </div>
          )}

          {/* Map */}
          {userPos && (
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <MapView userPosition={userPos} teamPosition={null} height="160px" />
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={14} />
            Cập nhật
          </button>

          {!isCancelled && !isResolved && (
            <button
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-400 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
              onClick={handleCancel}
            >
              <X size={14} />
              Huỷ yêu cầu
            </button>
          )}

          {isResolved && (
            <button
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 text-sm font-bold text-white hover:bg-green-600 transition-colors"
              onClick={() => navigate('/')}
            >
              <ShieldCheck size={14} />
              Về trang chủ
            </button>
          )}
        </div>

      </div>
    </div>
  );
}