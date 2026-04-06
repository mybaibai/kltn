import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MapView from "@/components/Map";
import { getSosDetail } from "@/services/api/apiSos";

const STATUS_LABEL = {
  PENDING: { text: "Đang chờ xử lý", color: "text-yellow-600 bg-yellow-50" },
  ASSIGNED: { text: "Đã phân công cứu hộ", color: "text-blue-600 bg-blue-50" },
  IN_PROGRESS: { text: "Cứu hộ đang di chuyển", color: "text-orange-600 bg-orange-50" },
  RESOLVED: { text: "Đã hoàn thành", color: "text-green-600 bg-green-50" },
  CANCELLED: { text: "Đã hủy", color: "text-gray-600 bg-gray-50" },
};

export default function TrackingPage() {
  const { sosId } = useParams();
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
  if (!sos) return <p className="p-4 text-center text-red-500">Không tìm thấy yêu cầu</p>;

  const statusInfo = STATUS_LABEL[sos.status] || { text: sos.status, color: "" };

  const coords = sos.location?.coordinates;
  const userPos = coords?.length === 2
    ? { lat: coords[1], lng: coords[0], label: "Vị trí sự cố" }
    : null;

  const teamPos = null;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-medium">Theo dõi yêu cầu hỗ trợ</h1>

      <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.text}
      </div>

      <MapView userPosition={userPos} teamPosition={teamPos} height="380px" />

      {sos.assigned_rescue_id && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
          <p className="font-medium text-blue-700">Người/đội đang hỗ trợ bạn</p>
          <p className="text-blue-600">{sos.assigned_rescue_id.full_name}</p>
          <p className="text-blue-500">{sos.assigned_rescue_id.phone}</p>
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