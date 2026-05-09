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
  if (key === 'urgent') return 'bg-rose-100 text-rose-700 ring-1 ring-rose-200';
  if (key === 'high') return 'bg-orange-100 text-orange-700 ring-1 ring-orange-200';
  if (key === 'medium') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
  if (key === 'low') return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
  if (key === 'unclassified') return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

export function incidentPriorityDetailTextClass(key) {
  if (key === 'urgent') return 'text-rose-700';
  if (key === 'high') return 'text-orange-600';
  if (key === 'medium') return 'text-amber-700';
  if (key === 'low') return 'text-emerald-700';
  if (key === 'unclassified') return 'text-slate-600';
  return 'text-slate-600';
}
