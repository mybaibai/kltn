import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TrackingMissionView from "@/components/tracking/TrackingMissionView";
import { buildTrackingViewModel } from "@/components/tracking/tracking-utils";
import { getSosDetail, updateSosStatus } from "@/services/api/apiSos";

export default function TrackingMissionPage() {
  const navigate = useNavigate();
  const { sosId } = useParams();

  const [sos, setSos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [arrivedLoading, setArrivedLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchDetail = useCallback(async () => {
    if (!sosId) {
      setError("Thiếu mã yêu cầu SOS");
      setLoading(false);
      return;
    }

    try {
      const response = await getSosDetail(sosId);
      setSos(response?.data?.data || null);
      setError("");
    } catch (err) {
      setSos(null);
      setError(err?.response?.data?.message || "Không tải được thông tin cứu hộ");
    } finally {
      setLoading(false);
    }
  }, [sosId]);

  useEffect(() => {
    setLoading(true);
    fetchDetail();

    const timer = window.setInterval(fetchDetail, 10000);
    return () => window.clearInterval(timer);
  }, [fetchDetail]);

  const model = useMemo(() => {
    if (!sos) return null;
    return buildTrackingViewModel(sos);
  }, [sos]);

  const handleArrived = useCallback(async () => {
    if (!sosId || arrivedLoading) return;

    try {
      setArrivedLoading(true);
      await updateSosStatus(sosId, "RESOLVED");
      await fetchDetail();
    } catch (err) {
      setError(err?.response?.data?.message || "Cập nhật trạng thái thất bại");
    } finally {
      setArrivedLoading(false);
    }
  }, [arrivedLoading, fetchDetail, sosId]);

  return (
    <TrackingMissionView
      loading={loading}
      error={error}
      data={model}
      onBack={() => navigate(-1)}
      onRetry={() => {
        setLoading(true);
        fetchDetail();
      }}
      onArrived={handleArrived}
      arrivedLoading={arrivedLoading}
    />
  );
}
