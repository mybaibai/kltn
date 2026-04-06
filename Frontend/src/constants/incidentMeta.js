import { AlertTriangle, Car, CloudRain, Flame, MapPin, Stethoscope } from 'lucide-react';

/** Khớp id loại sự cố từ SOSform */
export const INCIDENT_TYPE_META = {
  thienTai: { label: 'Thiên tai', Icon: CloudRain },
  chayNo: { label: 'Cháy nổ', Icon: Flame },
  phuongTien: { label: 'Tai nạn giao thông', Icon: Car },
  sucKhoe: { label: 'Hỗ trợ y tế', Icon: Stethoscope },
  lacDuong: { label: 'Lạc đường', Icon: MapPin },
  khac: { label: 'Khác', Icon: AlertTriangle },
};

export function getIncidentTypeDisplay(incidentType) {
  if (!incidentType) {
    return { label: 'Chưa xác định', Icon: AlertTriangle };
  }
  const meta = INCIDENT_TYPE_META[incidentType];
  if (meta) return meta;
  return { label: String(incidentType), Icon: AlertTriangle };
}

export function formatSosCode(id) {
  if (!id) return '#GR-—';
  const s = String(id).replace(/\W/g, '');
  const tail = s.slice(-5).toUpperCase().padStart(5, '0');
  return `#GR-${tail}`;
}
