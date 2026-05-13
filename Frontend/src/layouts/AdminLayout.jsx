import { useState, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import SOSForm from "@/page/Requester/SOSform";
import { sendSos } from "@/services/api/apiSos";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [showSos, setShowSos] = useState(false);
  const [position, setPosition] = useState(null);
  const [sending, setSending] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleReportClick = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Trình duyệt không hỗ trợ GPS");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "vi" } }
          );
          const data = await res.json();
          if (data.display_name) address = data.display_name;
        } catch {
          /* keep coords */
        }
        setPosition({ lat, lng, address });
        setGpsLoading(false);
        setShowSos(true);
      },
      () => {
        alert("Không lấy được vị trí. Hãy cho phép GPS.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  const handleConfirmSos = useCallback(
    async (payload) => {
      const description =
        typeof payload === "string" ? payload : payload?.description ?? "";
      const incidentType =
        typeof payload === "object" && payload?.type != null
          ? payload.type
          : null;

      let staffUser = null;
      try {
        staffUser = JSON.parse(localStorage.getItem("auth_user"));
      } catch {
        /* ignore */
      }

      setSending(true);
      try {
        const res = await sendSos({
          requester_id: staffUser?._id,
          latitude: position?.lat,
          longitude: position?.lng,
          address: position?.address,
          description,
          incident_type: incidentType,
        });
        const sosId = res.data.data._id;
        setShowSos(false);
        setSending(false);
        // Tạm tắt trang tracking admin — bật lại: navigate(`/admin/tracking/${sosId}`);
        navigate("/admin/incidents");
      } catch (err) {
        alert(`Gửi thất bại: ${err?.response?.data?.message || err?.message}`);
        setSending(false);
      }
    },
    [position, navigate]
  );

  return (
    <div className="flex min-h-dvh bg-brand-gray-bg">
      <AdminSidebar onReportClick={handleReportClick} gpsLoading={gpsLoading} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {showSos && (
        <SOSForm
          position={position}
          onConfirm={handleConfirmSos}
          onCancel={() => setShowSos(false)}
          sending={sending}
        />
      )}
    </div>
  );
}
