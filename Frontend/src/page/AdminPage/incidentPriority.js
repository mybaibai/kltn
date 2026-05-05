/**
 * Ưu tiên theo AI (`ai_priority_label`, `ai_priority_score` thang 1–10).
 * Dùng chung: bộ lọc (`PRIORITY_FILTER_OPTIONS[].value`), bảng, modal chi tiết.
 */

export function deriveIncidentPriority(sos) {
  const rawLabel = String(sos.ai_priority_label || '').trim();
  const L = rawLabel.toLowerCase();

  if (rawLabel) {
    if (L.includes('cực') || L.includes('cuc ') || L.includes('khẩn cấp')) {
      return { key: 'urgent', label: rawLabel };
    }
    if (L.includes('thấp')) return { key: 'low', label: rawLabel };
    if (L.includes('trung')) return { key: 'medium', label: rawLabel };
    if (L.includes('cao')) return { key: 'high', label: rawLabel };
  }

  const s = sos.ai_priority_score;
  if (s != null && !Number.isNaN(Number(s))) {
    const n = Number(s);
    if (n >= 9) return { key: 'urgent', label: 'Cực kì cao' };
    if (n >= 7) return { key: 'high', label: 'Cao' };
    if (n >= 4) return { key: 'medium', label: 'Trung bình' };
    return { key: 'low', label: 'Thấp' };
  }

  return { key: 'unclassified', label: 'Chưa phân loại' };
}

export function incidentPriorityTableBadgeClass(key) {
  if (key === 'urgent') return 'bg-brand-red/10 text-brand-red ring-1 ring-brand-red/25';
  if (key === 'high') return 'bg-brand-gray-bg text-brand-brown ring-1 ring-brand-muted/25';
  if (key === 'low') return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200';
  if (key === 'unclassified') return 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80';
  return 'bg-white text-brand-muted ring-1 ring-[#E5E7EB]';
}

export function incidentPriorityDetailTextClass(key) {
  if (key === 'urgent') return 'text-brand-red';
  if (key === 'high') return 'text-orange-600';
  if (key === 'low') return 'text-slate-600';
  if (key === 'unclassified') return 'text-amber-800';
  return 'text-brand-muted';
}
