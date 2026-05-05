import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Clock, MapPin, Radio } from 'lucide-react';
import MapView from '@/components/Map';
import { getSosDetail } from '@/services/api/apiSos';
import { getCurrentTrackingBySosId } from '@/services/api/apiTracking';
import { formatSosCode, getIncidentTypeDisplay } from '@/constants/incidentMeta';
import { getSocket, initSocketFromSession } from '@/services/socket';
import { getOSRMRoute } from '@/services/api/apiRouting';

function normalizeStatusKey(s) {
  const x = String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (x === 'pending') return 'PENDING';
  if (x === 'assigned') return 'ASSIGNED';
  if (x === 'in_progress' || x === 'inprogress') return 'IN_PROGRESS';
  if (x === 'resolved') return 'RESOLVED';
  if (x === 'cancelled' || x === 'canceled') return 'CANCELLED';
  return String(s ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

const STATUS_MAP = {
  PENDING: { text: 'Đang chờ', dot: 'bg-yellow-500' },
  ASSIGNED: { text: 'Đã phân công', dot: 'bg-blue-500' },
  IN_PROGRESS: { text: 'Đang xử lý', dot: 'bg-blue-500' },
  RESOLVED: { text: 'Hoàn thành', dot: 'bg-green-500' },
  CANCELLED: { text: 'Đã hủy', dot: 'bg-gray-400' },
};

const ASSIGNMENT_STAGE_LABEL = {
  ASSIGNED: 'Đã nhận nhiệm vụ',
  MOVING: 'Đang di chuyển',
  ARRIVED: 'Đã đến hiện trường',
  RESCUING: 'Đang cứu hộ',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

function formatKm(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} km`;
}

function formatEtaMinutes(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Math.max(0, Math.round(Number(value)))}`;
}

function extractCoords(loc) {
  if (!loc) return null;
  if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
    return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
  }
  if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    return { lat: loc.latitude, lng: loc.longitude };
  }
  return null;
}

export default function AdminTrackingPage() {
  const { sosId } = useParams();
  const navigate = useNavigate();
  const [sos, setSos] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  /** Lộ trình OSRM — admin hiển thị mặc định khi API đã có 2 đầu (không cần thao tác như rescue) */
  const [routeCoords, setRouteCoords] = useState([]);

  const fetchSos = useCallback(async (opts = {}) => {
    const { suppressLoadingState } = opts;
    try {
      const res = await getSosDetail(sosId);
      setSos(res.data.data);
    } catch {
      setSos(null);
    } finally {
      if (!suppressLoadingState) setLoading(false);
    }
  }, [sosId]);

  const fetchTracking = useCallback(async () => {
    if (!sosId) return;
    try {
      const res = await getCurrentTrackingBySosId(sosId);
      const data = res?.data?.data;
      if (data) setTracking(data);
    } catch {
      /* giữ state cũ khi refetch thất bại */
    }
  }, [sosId]);

  useEffect(() => {
    if (!sosId) return;
    fetchSos();
    const interval = setInterval(() => {
      fetchSos({ suppressLoadingState: true });
      fetchTracking();
    }, 45_000);
    return () => clearInterval(interval);
  }, [sosId, fetchSos, fetchTracking]);

  useEffect(() => {
    if (!sosId || !sos) return;
    fetchTracking();
  }, [sosId, sos, fetchTracking]);

  // Socket: cùng luồng realtime như rescue (phòng admin-dashboard + sos_room)
  useEffect(() => {
    if (!sosId) return;
    const socket = getSocket() || initSocketFromSession();
    if (!socket) return;

    const syncConnected = () => setSocketConnected(socket.connected);
    syncConnected();

    const matchesSos = (data) =>
      data?.request_id != null && String(data.request_id) === String(sosId);

    const onSosRoom = (data) => {
      if (data?.request_id != null && String(data.request_id) !== String(sosId)) return;
      setTracking((prev) => ({
        ...(prev || {}),
        rescue_location: data.rescue_location ?? prev?.rescue_location,
        victim_location: data.victim_location ?? prev?.victim_location,
        distance_km: data.distance_km ?? prev?.distance_km,
        eta_minutes: data.eta_minutes ?? prev?.eta_minutes,
        stage: data.stage ?? prev?.stage,
      }));
    };

    const onLocationUpdate = (data) => {
      if (!matchesSos(data)) return;
      setTracking((prev) => ({
        ...(prev || {}),
        assignment_id: data.assignment_id ?? prev?.assignment_id,
        distance_km: data.distance_km ?? prev?.distance_km,
        eta_minutes: data.eta_minutes ?? prev?.eta_minutes,
      }));
      fetchTracking();
    };

    const onStageChanged = (data) => {
      if (!matchesSos(data)) return;
      const nextStage = data.new_stage ?? data.stage;
      setTracking((prev) => ({
        ...(prev || {}),
        assignment_id: data.assignment_id ?? prev?.assignment_id,
        stage: nextStage ?? prev?.stage,
        distance_km: data.distance_km ?? prev?.distance_km,
      }));
      fetchTracking();
    };

    const joinRoom = () => {
      socket.emit('join_sos_room', { sos_id: sosId });
    };
    if (socket.connected) joinRoom();
    socket.on('connect', joinRoom);

    socket.on('connect', syncConnected);
    socket.on('disconnect', syncConnected);
    socket.on('sos_room_update', onSosRoom);
    socket.on('location_update', onLocationUpdate);
    socket.on('stage_changed', onStageChanged);

    return () => {
      socket.emit('leave_sos_room', { sos_id: sosId });
      socket.off('connect', joinRoom);
      socket.off('connect', syncConnected);
      socket.off('disconnect', syncConnected);
      socket.off('sos_room_update', onSosRoom);
      socket.off('location_update', onLocationUpdate);
      socket.off('stage_changed', onStageChanged);
    };
  }, [sosId, fetchTracking]);

  const victimPt = useMemo(() => {
    if (!sos) return null;
    const fromTrack = extractCoords(tracking?.victim_location);
    if (fromTrack) return fromTrack;
    return extractCoords(sos.location);
  }, [sos, tracking?.victim_location]);

  const rescuePt = useMemo(
    () => extractCoords(tracking?.rescue_location),
    [tracking?.rescue_location],
  );

  useEffect(() => {
    if (!victimPt || !rescuePt) {
      setRouteCoords([]);
      return;
    }
    const timerId = setTimeout(async () => {
      try {
        const res = await getOSRMRoute(
          rescuePt.lat,
          rescuePt.lng,
          victimPt.lat,
          victimPt.lng,
        );
        setRouteCoords(res.routeCoords || []);
      } catch {
        setRouteCoords([
          [rescuePt.lat, rescuePt.lng],
          [victimPt.lat, victimPt.lng],
        ]);
      }
    }, 400);
    return () => clearTimeout(timerId);
  }, [victimPt?.lat, victimPt?.lng, rescuePt?.lat, rescuePt?.lng]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-brand-muted">
        Đang tải dữ liệu sự cố…
      </div>
    );
  }

  if (!sos) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-brand-muted">
        <p>Không tìm thấy sự cố.</p>
        <button
          type="button"
          onClick={() => navigate('/admin/incidents')}
          className="text-sm font-semibold text-brand-blue underline"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const code = formatSosCode(sos._id);
  const stKey = normalizeStatusKey(sos.status);
  const st = STATUS_MAP[stKey] || { text: sos.status, dot: 'bg-gray-400' };
  const { label: typeLabel, Icon: TypeIcon } = getIncidentTypeDisplay(sos.incident_type);

  const victimCoords =
    extractCoords(tracking?.victim_location) || extractCoords(sos.location);
  const userPos = victimCoords ? { ...victimCoords, label: 'NẠN NHÂN' } : null;

  const rescue = typeof sos.assigned_rescue_id === 'object' ? sos.assigned_rescue_id : null;
  const rescueCoords = extractCoords(tracking?.rescue_location);
  const teamPos = rescueCoords
    ? {
        ...rescueCoords,
        label: tracking?.rescue_name || rescue?.full_name || 'CỨU HỘ',
      }
    : null;

  const assignmentStageLabel = tracking?.stage
    ? ASSIGNMENT_STAGE_LABEL[tracking.stage] || tracking.stage
    : null;

  const distanceStr = formatKm(tracking?.distance_km);
  const etaStr = formatEtaMinutes(tracking?.eta_minutes);

  const desc = sos.description?.replace(/\[Địa chỉ:.*?\]/g, '').trim() || '—';

  const createdDate = sos.created_at ? new Date(sos.created_at) : null;
  const timeStr = createdDate
    ? createdDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
    : '—';
  const isToday = createdDate && new Date().toDateString() === createdDate.toDateString();
  const dateStr = isToday
    ? 'Hôm nay'
    : createdDate
      ? createdDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

  return (
    <div className="flex h-full">
      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          userPosition={userPos}
          teamPosition={teamPos}
          routePositions={routeCoords}
          height="100%"
        />
      </div>

      {/* Right panel */}
      <div className="w-[380px] shrink-0 overflow-y-auto border-l border-[#E8E8EC] bg-white">
        <div className="p-5 space-y-5">
          {/* Back link */}
          <button
            type="button"
            onClick={() => navigate('/admin/incidents')}
            className="flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
          >
            <ArrowLeft className="size-4" />
            Quay lại danh sách
          </button>

          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-gray-900">Theo dõi sự cố</h2>
            <span className="rounded-lg bg-gray-100 px-2.5 py-1 font-mono text-xs font-semibold text-gray-500">
              {code}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Radio
              className={`size-3.5 ${socketConnected ? 'text-green-500' : 'text-gray-300'}`}
              aria-hidden
            />
            <span>{socketConnected ? 'Realtime đã kết nối' : 'Đang chờ kết nối realtime…'}</span>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${st.dot}`} />
              <span className="text-sm font-semibold text-gray-800">{st.text}</span>
            </div>
            {assignmentStageLabel && (
              <p className="pl-4 text-xs font-medium text-brand-blue">
                Tiến độ đội: {assignmentStageLabel}
              </p>
            )}
          </div>

          {/* Incident type */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Loại sự cố
            </p>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                <TypeIcon className="size-5" />
              </div>
              <span className="text-sm font-bold text-gray-900">{typeLabel}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Mô tả
            </p>
            <p className="text-sm leading-relaxed text-gray-600">{desc}</p>
          </div>

          {/* Time */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Thời gian gửi
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {timeStr}{dateStr ? `, ${dateStr}` : ''}
            </p>
          </div>

          {/* Rescue team info — đồng bộ realtime giống màn rescue */}
          {(rescue || tracking?.rescue_id) && (
            <div className="space-y-3">
              {(tracking?.rescue_name || rescue?.full_name) && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">Đội phụ trách: </span>
                  {tracking?.rescue_name || rescue?.full_name}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 p-3 text-center">
                  <MapPin className="mx-auto mb-1 size-5 text-gray-400" />
                  <p className="text-[10px] font-bold uppercase text-gray-400">Khoảng cách</p>
                  <p className="text-lg font-bold text-gray-900">{distanceStr}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3 text-center">
                  <Clock className="mx-auto mb-1 size-5 text-gray-400" />
                  <p className="text-[10px] font-bold uppercase text-gray-400">Dự kiến (ETA)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {etaStr === '—' ? '—' : `${etaStr} phút`}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-gray-900 px-5 py-4 text-center text-white">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Thời gian đến dự kiến
                </p>
                <p className="mt-1 text-3xl font-extrabold">{etaStr === '—' ? '—' : etaStr}</p>
                <p className="text-sm font-medium text-gray-300">Phút</p>
              </div>
            </div>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              Promise.all([
                fetchSos({ suppressLoadingState: true }),
                fetchTracking(),
              ]).finally(() => setLoading(false));
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            <RefreshCw className="size-4" />
            Làm mới dữ liệu
          </button>
        </div>
      </div>
    </div>
  );
}
