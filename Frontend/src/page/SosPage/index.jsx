import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';   // ← thêm
import MapView from '@/components/Map';
import { getSosDetail } from '@/services/api/apiSos';

const STATUS_LABEL = {
  pending:     { text: 'Đang chờ xử lý',      color: 'text-yellow-600 bg-yellow-50' },
  assigned:    { text: 'Đã phân công đội',     color: 'text-blue-600 bg-blue-50' },
  in_progress: { text: 'Đội đang trên đường',  color: 'text-orange-600 bg-orange-50' },
  resolved:    { text: 'Đã hoàn thành',        color: 'text-green-600 bg-green-50' },
  cancelled:   { text: 'Đã huỷ',              color: 'text-gray-600 bg-gray-50' },
};

export default function TrackingPage() {
  const { sosId } = useParams();   // ← lấy ID từ URL /tracking/:sosId
  const [sos, setSos] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <p className="p-4 text-center">Đang tải...</p>;
  if (!sos)    return <p className="p-4 text-center text-red-500">Không tìm thấy yêu cầu</p>;

  const statusInfo = STATUS_LABEL[sos.status] || { text: sos.status, color: '' };
  const userPos = { lat: sos.latitude, lng: sos.longitude, label: '📍 Vị trí sự cố' };
  const teamPos = sos.assigned_team_id?.location?.coordinates
    ? {
        lat: sos.assigned_team_id.location.coordinates[1],
        lng: sos.assigned_team_id.location.coordinates[0],
        label: `🚑 ${sos.assigned_team_id.name}`,
      }
    : null;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-medium">Theo dõi yêu cầu hỗ trợ</h1>

      <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.text}
      </div>

      <MapView userPosition={userPos} teamPosition={teamPos} height="380px" />

      {sos.assigned_team_id && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
          <p className="font-medium text-blue-700">🚑 Đội đang hỗ trợ bạn</p>
          <p className="text-blue-600">{sos.assigned_team_id.name}</p>
          <p className="text-blue-500">📞 {sos.assigned_team_id.phone_contact}</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
        <p><span className="text-gray-500">Địa chỉ:</span> {sos.address}</p>
        {sos.description && (
          <p><span className="text-gray-500">Mô tả:</span> {sos.description}</p>
        )}
        {sos.ai_suggestion && (
          <p><span className="text-gray-500">AI đề xuất:</span> {sos.ai_suggestion}</p>
        )}
      </div>
    </div>
  );
}