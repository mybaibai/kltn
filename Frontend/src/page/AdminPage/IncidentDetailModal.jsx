import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Clock, AlertTriangle, MapPin, Phone, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSosCode, getIncidentTypeDisplay } from '@/constants/incidentMeta';
import { updateSosStatus } from '@/services/api/apiSos';

function normalizeStatusKey(s) {
  const x = String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (x === 'pending') return 'PENDING';
  if (x === 'assigned') return 'ASSIGNED';
  if (x === 'in_progress' || x === 'inprogress') return 'IN_PROGRESS';
  if (x === 'resolved') return 'RESOLVED';
  if (x === 'cancelled' || x === 'canceled') return 'CANCELLED';
  return String(s ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function statusLabel(s) {
  const k = normalizeStatusKey(s);
  switch (k) {
    case 'PENDING': return 'Đang chờ';
    case 'ASSIGNED': return 'Đã phân công';
    case 'IN_PROGRESS': return 'Đang xử lý';
    case 'RESOLVED': return 'Hoàn thành';
    case 'CANCELLED': return 'Đã hủy';
    default: return s || '—';
  }
}

function statusBadgeClass(s) {
  const k = normalizeStatusKey(s);
  switch (k) {
    case 'PENDING': return 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200';
    case 'ASSIGNED':
    case 'IN_PROGRESS': return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
    case 'RESOLVED': return 'bg-green-50 text-green-700 ring-1 ring-green-200';
    case 'CANCELLED': return 'bg-gray-100 text-gray-500 ring-1 ring-gray-200';
    default: return 'bg-gray-100 text-gray-500 ring-1 ring-gray-200';
  }
}

function derivePriority(sos) {
  const s = sos.ai_priority_score;
  if (s != null && !Number.isNaN(Number(s))) {
    const n = Number(s);
    if (n >= 70) return { label: 'Khẩn cấp', cls: 'text-brand-red' };
    if (n >= 40) return { label: 'Cao', cls: 'text-orange-600' };
    return { label: 'Trung bình', cls: 'text-brand-muted' };
  }
  return { label: 'Trung bình', cls: 'text-brand-muted' };
}

function formatTimeFull(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).toUpperCase();
}

function ConfirmCancelDialog({ onConfirm, onDismiss, loading }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-gray-900">Xác nhận hủy xử lý</h3>
        <p className="mb-6 text-sm text-gray-500">
          Bạn có chắc chắn muốn hủy xử lý sự cố này?
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onDismiss} disabled={loading} className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold">
            Không
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="flex-1 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-semibold text-white">
            {loading ? '…' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IncidentDetailModal({ sos, onClose, onStatusChanged }) {
  const navigate = useNavigate();
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!sos) return null;

  const victim = typeof sos.victim_id === 'object' ? sos.victim_id : null;
  const victimName = victim?.full_name?.trim() || victim?.phone || '—';
  const victimPhone = victim?.phone || '—';

  const { label: typeLabel } = getIncidentTypeDisplay(sos.incident_type);
  const priority = derivePriority(sos);
  const code = formatSosCode(sos._id);
  const lat = sos.location?.coordinates?.[1] ?? sos.location?.latitude;
  const lng = sos.location?.coordinates?.[0] ?? sos.location?.longitude;
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const mapUrl = hasCoords ? `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed` : null;

  const rescue = sos.assigned_rescue_id;
  const rescueName = typeof rescue === 'object' && rescue?.full_name ? rescue.full_name : null;

  const canCancel = !['RESOLVED', 'CANCELLED'].includes(normalizeStatusKey(sos.status));

  async function handleCancelConfirm() {
    setCancelling(true);
    try {
      await updateSosStatus(sos._id, 'CANCELLED');
      onStatusChanged?.();
      onClose();
    } catch {
      /* ignore */
    } finally {
      setCancelling(false);
      setShowConfirmCancel(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Chi tiết sự cố</h2>
              <span className="rounded-lg bg-gray-100 px-3 py-1 font-mono text-sm text-gray-500">{code}</span>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="size-5" /></button>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-brand-red px-3 py-1 text-xs font-bold uppercase text-white">{typeLabel}</span>
              <span className={cn('rounded-md px-3 py-1 text-xs font-bold uppercase', statusBadgeClass(sos.status))}>{statusLabel(sos.status)}</span>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-1 text-sm font-bold">Mô tả chi tiết</h3>
                  <p className="text-sm text-gray-600">{sos.description?.replace(/\[Địa chỉ:.*?\]/g, '').trim() || '—'}</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-3 rounded-xl border px-4 py-3">
                    <Clock className="size-4 text-gray-400" />
                    <div>
                      <p className="text-[11px] font-bold uppercase text-gray-400">Thời gian gửi</p>
                      <p className="text-sm font-semibold">{formatTimeFull(sos.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border px-4 py-3">
                    <AlertTriangle className={cn('size-4', priority.cls)} />
                    <div>
                      <p className="text-[11px] font-bold uppercase text-gray-400">Độ ưu tiên</p>
                      <p className={cn('text-sm font-bold', priority.cls)}>{priority.label}</p>
                    </div>
                  </div>
                </div>
                {hasCoords && (
                  <div className="overflow-hidden rounded-xl border">
                    <iframe title="map" src={mapUrl} className="h-40 w-full border-0" loading="lazy" />
                    <button
                      type="button"
                      onClick={() => { onClose(); navigate(`/admin/tracking/${sos._id}`); }}
                      className="flex w-full items-center gap-2 border-t px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                    >
                      <MapPin className="size-4" /> Xem trên bản đồ
                    </button>
                  </div>
                )}
                {sos.address && (
                  <p className="flex items-start gap-2 text-sm text-gray-500">
                    <Navigation className="mt-0.5 size-4 shrink-0" />{sos.address}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border p-4">
                  <p className="mb-2 text-[11px] font-bold uppercase text-gray-400">Thông tin người gửi</p>
                  <p className="text-sm font-bold">{victimName}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Phone className="size-3" />{victimPhone}</p>
                </div>
                {rescueName && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                    <p className="mb-2 text-[11px] font-bold uppercase text-blue-400">Đội cứu hộ</p>
                    <p className="text-sm font-bold">{rescueName}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t px-6 py-4">
            {canCancel && (
              <button type="button" onClick={() => setShowConfirmCancel(true)} className="rounded-xl border px-5 py-2.5 text-sm font-semibold">
                Hủy xử lý
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white">
              Đóng
            </button>
          </div>
        </div>
      </div>

      {showConfirmCancel && (
        <ConfirmCancelDialog onConfirm={handleCancelConfirm} onDismiss={() => setShowConfirmCancel(false)} loading={cancelling} />
      )}
    </>
  );
}
