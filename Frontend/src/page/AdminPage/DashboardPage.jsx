import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAllSos } from '@/services/api/apiSos';
import { getIncidentTypeDisplay } from '@/constants/incidentMeta';

function normalizeStatus(s) {
  const x = String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (x === 'pending') return 'PENDING';
  if (x === 'assigned') return 'ASSIGNED';
  if (x === 'in_progress' || x === 'inprogress') return 'IN_PROGRESS';
  if (x === 'resolved') return 'RESOLVED';
  if (x === 'cancelled' || x === 'canceled') return 'CANCELLED';
  return String(s ?? '').toUpperCase();
}

function getEndTime(sos) {
  const hist = sos.status_history;
  if (!Array.isArray(hist) || hist.length === 0) return null;
  const last = [...hist].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
  return last?.updated_at ?? null;
}

function calculateDuration(sos) {
  const start = sos.created_at;
  const end = getEndTime(sos);
  if (!start || !end) return null;
  const mins = Math.round((new Date(end) - new Date(start)) / 60_000);
  return mins >= 0 ? mins : null;
}

/** Tên đội cứu trợ đã gán (populate `full_name` như History / backend) */
const DATE_RANGE_PRESETS = [
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'all', label: 'Tất cả thời gian' },
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDayLabel(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

function formatRangeLabel(start, endExclusive) {
  const end = new Date(endExclusive.getTime() - 1);
  return `${formatDayLabel(start)}-${formatDayLabel(end)}`;
}

function formatMonthLabel(date) {
  return `T${date.getMonth() + 1}/${String(date.getFullYear()).slice(-2)}`;
}

function filterSosByDatePreset(list, preset) {
  if (!Array.isArray(list) || preset === 'all') return list;
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();

  if (preset === 'today') {
    return list.filter((s) => s.created_at && new Date(s.created_at).getTime() >= t0);
  }
  const days = preset === '30d' ? 30 : 7;
  const ms = days * 24 * 60 * 60 * 1000;
  return list.filter((s) => s.created_at && now - new Date(s.created_at).getTime() <= ms);
}

/** Có kết quả phân tích AI lưu trên bản ghi (đồng bộ với BE: score / nhãn / tóm tắt). */
function hasAiAnalysisResult(s) {
  if (s == null) return false;
  if (s.ai_priority_score != null && s.ai_priority_score !== '') {
    const n = Number(s.ai_priority_score);
    if (!Number.isNaN(n)) return true;
  }
  if (typeof s.ai_priority_label === 'string' && s.ai_priority_label.trim().length > 0) return true;
  if (typeof s.ai_situation_summary === 'string' && s.ai_situation_summary.trim().length > 0) return true;
  return false;
}

function computeAiAnalysisRatePercentInRange(list, startMs, endMs, endInclusive) {
  let total = 0;
  let withAi = 0;
  for (const s of list) {
    if (!s.created_at) continue;
    const t = new Date(s.created_at).getTime();
    if (!Number.isFinite(t) || t < startMs) continue;
    if (endInclusive ? t > endMs : t >= endMs) continue;
    total += 1;
    if (hasAiAnalysisResult(s)) withAi += 1;
  }
  return {
    total,
    withAi,
    rate: total > 0 ? Math.round((withAi / total) * 1000) / 10 : 0,
  };
}

/** Chênh lệch ppt % giữa kỳ hiện tại và kỳ trước; cùng cửa sổ với ô "Sự cố đang hoạt động". */
function computeAiAnalysisRateSubtitle(allSos, preset) {
  if (preset === 'all') return null;

  const list = Array.isArray(allSos) ? allSos : [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();

  let cur;
  let prev;
  let suffix;

  if (preset === 'today') {
    cur = computeAiAnalysisRatePercentInRange(list, t0, now, true);
    prev = computeAiAnalysisRatePercentInRange(list, t0 - dayMs, t0, false);
    suffix = 'so với hôm qua';
  } else if (preset === '7d') {
    const curStart = now - 7 * dayMs;
    const prevStart = now - 14 * dayMs;
    const prevEnd = curStart;
    cur = computeAiAnalysisRatePercentInRange(list, curStart, now, true);
    prev = computeAiAnalysisRatePercentInRange(list, prevStart, prevEnd, false);
    suffix = 'so với tuần trước';
  } else if (preset === '30d') {
    const curStart = now - 30 * dayMs;
    const prevStart = now - 60 * dayMs;
    const prevEnd = curStart;
    cur = computeAiAnalysisRatePercentInRange(list, curStart, now, true);
    prev = computeAiAnalysisRatePercentInRange(list, prevStart, prevEnd, false);
    suffix = 'so với tháng trước';
  } else {
    return null;
  }

  if (prev.total === 0) {
    if (cur.total === 0) return 'Không có dữ liệu để so sánh';
    return 'Chưa có sự cố kỳ trước để so sánh';
  }

  const delta = Math.round((cur.rate - prev.rate) * 10) / 10;
  if (Math.abs(delta) < 0.05) {
    return `Không đổi ${suffix}`;
  }
  const sign = delta > 0 ? '+' : '';
  const deltaStr = delta.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${sign}${deltaStr}% ${suffix}`;
}

function isActiveIncidentStatus(s) {
  return ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(normalizeStatus(s?.status));
}

/**
 * Xu hướng cho ô "Sự cố đang hoạt động": cùng chỉ số với số lớn — đếm phiếu **đang xử lý theo trạng thái hiện tại**
 * có `created_at` thuộc kỳ hiện tại vs kỳ ngay trước (đồng nhất với logic filter của card).
 */
function computeDashboardIncidentTrend(allSos, preset) {
  const list = Array.isArray(allSos) ? allSos : [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();

  const countActiveCreated = (startMs, endMs, endInclusive = true) =>
    list.filter((s) => {
      if (!s.created_at || !isActiveIncidentStatus(s)) return false;
      const t = new Date(s.created_at).getTime();
      if (t < startMs) return false;
      return endInclusive ? t <= endMs : t < endMs;
    }).length;

  let cur = 0;
  let prev = 0;
  let suffix = 'so với tuần trước';

  if (preset === 'today') {
    cur = countActiveCreated(t0, now, true);
    prev = countActiveCreated(t0 - dayMs, t0, false);
    suffix = 'so với hôm qua';
  } else if (preset === '7d') {
    const curStart = now - 7 * dayMs;
    const prevStart = now - 14 * dayMs;
    const prevEnd = curStart;
    cur = countActiveCreated(curStart, now, true);
    prev = countActiveCreated(prevStart, prevEnd, false);
    suffix = 'so với tuần trước';
  } else if (preset === '30d') {
    const curStart = now - 30 * dayMs;
    const prevStart = now - 60 * dayMs;
    const prevEnd = curStart;
    cur = countActiveCreated(curStart, now, true);
    prev = countActiveCreated(prevStart, prevEnd, false);
    suffix = 'so với tháng trước';
  } else {
    const curStart = now - 30 * dayMs;
    const prevStart = now - 60 * dayMs;
    const prevEnd = curStart;
    cur = countActiveCreated(curStart, now, true);
    prev = countActiveCreated(prevStart, prevEnd, false);
    suffix = 'so với 30 ngày trước đó';
  }

  if (prev === 0 && cur === 0) {
    return `0% ${suffix}`;
  }
  if (prev === 0) {
    return `+100% ${suffix}`;
  }
  const pct = Math.round(((cur - prev) / prev) * 100);
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}% ${suffix}`;
}

function getAssignedRescueLabel(sos) {
  const ar = sos?.assigned_rescue_id;
  if (ar && typeof ar === 'object') {
    const name = ar.full_name?.trim();
    if (name) return name;
  }
  if (typeof ar === 'string' && ar.trim().length > 0) {
    const id = ar.trim();
    return `Đội (…${id.slice(-6)})`;
  }
  return 'Chưa phân công';
}

function StatCard({ icon, title, value, subtitle, trend, color = 'blue' }) {
  const bgMap = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    yellow: 'bg-yellow-50',
    red: 'bg-red-50',
  };
  const textMap = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
  };
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {title}
        </p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        {trend && (
          <p className={cn('mt-1 flex items-center gap-1 text-xs font-semibold', textMap[color])}>
            {trend}
          </p>
        )}
      </div>
      <div className={cn('flex size-12 items-center justify-center rounded-xl', bgMap[color], textMap[color])}>
        {icon}
      </div>
    </div>
  );
}

/** Màu cung donut + chú thích (đồng bộ với bảng phân loại) */
const DISTRIBUTION_CHART_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#64748b',
];

/** Vòng khuyên từ góc a0 → a1 (radian), bắt đầu từ đỉnh (-π/2), chiều kim đồng hồ trên màn hình */
function describeDonutSlicePath(cx, cy, rInner, rOuter, a0, a1) {
  const sweep = a1 - a0;
  const large = sweep > Math.PI ? 1 : 0;
  const xos = cx + rOuter * Math.cos(a0);
  const yos = cy + rOuter * Math.sin(a0);
  const xoe = cx + rOuter * Math.cos(a1);
  const yoe = cy + rOuter * Math.sin(a1);
  const xis = cx + rInner * Math.cos(a1);
  const yis = cy + rInner * Math.sin(a1);
  const xie = cx + rInner * Math.cos(a0);
  const yie = cy + rInner * Math.sin(a0);
  return [
    `M ${xos} ${yos}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${xoe} ${yoe}`,
    `L ${xis} ${yis}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${xie} ${yie}`,
    'Z',
  ].join(' ');
}

/** Cột: loại/đội — phần trăm — số lượng (đồng bộ với DistributionRow) */
const METRIC_TABLE_GRID =
  'grid grid-cols-[minmax(0,9.5rem)_minmax(6.5rem,1fr)_minmax(5.5rem,7.25rem)] items-center gap-x-3';

function DistributionMetricHeader({ firstColumnLabel }) {
  return (
    <div
      className={cn(
        METRIC_TABLE_GRID,
        'border-b border-gray-100 pb-2 text-[11px] font-semibold text-gray-500',
      )}
    >
      <span className="min-w-0 truncate">{firstColumnLabel}</span>
      <span className="text-center">Phần trăm %</span>
      <span className="text-right">Số lượng</span>
    </div>
  );
}

function DistributionRow({ label, emoji, count, percent, barColor }) {
  return (
    <div className={cn(METRIC_TABLE_GRID, 'py-2')}>
      <div className="flex min-w-0 items-center gap-2">
        {emoji && <span className="shrink-0 text-lg leading-none">{emoji}</span>}
        <span className="truncate text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${percent}%`, backgroundColor: barColor }}
          />
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900">{percent}%</span>
      </div>
      <span className="text-right text-sm font-bold text-gray-900 tabular-nums">{count}</span>
    </div>
  );
}

function ReportRow({ title, date, size, onDownload }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-gray-100">
      <div className="flex items-center gap-3">
        <FileText className="size-5 text-blue-500" />
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-400">
            Ngày tạo: {date} • {size}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDownload}
        className="rounded-lg p-2 text-blue-500 transition hover:bg-blue-50"
        title="Tải xuống"
      >
        <Download className="size-4" />
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const [allSos, setAllSos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendWindow, setTrendWindow] = useState('current');
  const [dateRangePreset, setDateRangePreset] = useState('7d');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllSos();
      const list = res?.data?.data ?? [];
      setAllSos(Array.isArray(list) ? list : []);
    } catch {
      setAllSos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredSos = useMemo(
    () => filterSosByDatePreset(allSos, dateRangePreset),
    [allSos, dateRangePreset],
  );

  const activeIncidentsTrendText = useMemo(
    () => computeDashboardIncidentTrend(allSos, dateRangePreset),
    [allSos, dateRangePreset],
  );

  const aiAnalysisRateSubtitle = useMemo(
    () => computeAiAnalysisRateSubtitle(allSos, dateRangePreset),
    [allSos, dateRangePreset],
  );

  const stats = useMemo(() => {
    const total = filteredSos.length;
    const resolved = filteredSos.filter((s) => normalizeStatus(s.status) === 'RESOLVED');
    const active = filteredSos.filter((s) =>
      ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(normalizeStatus(s.status)),
    );
    const cancelled = filteredSos.filter((s) => normalizeStatus(s.status) === 'CANCELLED');

    const durations = resolved
      .map((s) => calculateDuration(s))
      .filter((d) => d != null && d >= 0);
    const avgResponse = durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : 0;

    const withAi = filteredSos.filter(hasAiAnalysisResult).length;
    const aiAnalysisRate = total > 0 ? Math.round((withAi / total) * 1000) / 10 : 0;

    return {
      total,
      active: active.length,
      resolved: resolved.length,
      cancelled: cancelled.length,
      avgResponse,
      aiAnalysisRate,
    };
  }, [filteredSos]);

  const distribution = useMemo(() => {
    const typeMap = new Map();
    filteredSos.forEach((s) => {
      const { label, emoji } = getIncidentTypeDisplay(s.incident_type);
      const key = label;
      if (!typeMap.has(key)) typeMap.set(key, { label, emoji, count: 0 });
      typeMap.get(key).count += 1;
    });
    const sorted = Array.from(typeMap.values()).sort((a, b) => b.count - a.count);
    const total = filteredSos.length || 1;
    return sorted.map((item) => ({
      ...item,
      percent: Math.round((item.count / total) * 100),
    }));
  }, [filteredSos]);

  /** Số sự cố theo đội được phân công (không dùng phân loại loại sự cố) */
  const rescueTeamDistribution = useMemo(() => {
    const teamMap = new Map();
    filteredSos.forEach((s) => {
      const label = getAssignedRescueLabel(s);
      if (!teamMap.has(label)) teamMap.set(label, { label, emoji: null, count: 0 });
      teamMap.get(label).count += 1;
    });
    const sorted = Array.from(teamMap.values()).sort((a, b) => b.count - a.count);
    const total = filteredSos.length || 1;
    return sorted.map((item) => ({
      ...item,
      percent: Math.round((item.count / total) * 100),
    }));
  }, [filteredSos]);

  const donutSlices = useMemo(() => {
    const total = filteredSos.length;
    if (total === 0 || distribution.length === 0) return [];
    const cx = 50;
    const cy = 50;
    const rInner = 34;
    const rOuter = 46;

    if (distribution.length === 1) {
      const item = distribution[0];
      return [
        {
          key: `${item.label}-0`,
          fullRing: true,
          fill: DISTRIBUTION_CHART_COLORS[0],
          label: item.label,
          emoji: item.emoji,
          count: item.count,
          percent: item.percent,
        },
      ];
    }

    let acc = 0;
    return distribution.map((item, i) => {
      const frac = item.count / total;
      const a0 = acc * 2 * Math.PI - Math.PI / 2;
      acc += frac;
      const a1 = acc * 2 * Math.PI - Math.PI / 2;
      const fill = DISTRIBUTION_CHART_COLORS[i % DISTRIBUTION_CHART_COLORS.length];
      const d = describeDonutSlicePath(cx, cy, rInner, rOuter, a0, a1);
      return {
        key: `${item.label}-${i}`,
        fullRing: false,
        d,
        fill,
        label: item.label,
        emoji: item.emoji,
        count: item.count,
        percent: item.percent,
      };
    });
  }, [filteredSos.length, distribution]);

  const donutChartRef = useRef(null);
  const [donutHover, setDonutHover] = useState(null);

  const updateDonutTooltipPos = useCallback((e) => {
    const wrap = donutChartRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setDonutHover((prev) =>
      prev
        ? {
            ...prev,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          }
        : null,
    );
  }, []);

  const showDonutTooltip = useCallback((e, slice) => {
    const wrap = donutChartRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setDonutHover({
      key: slice.key,
      label: slice.label,
      emoji: slice.emoji,
      count: slice.count,
      percent: slice.percent,
      color: slice.fill,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const hideDonutTooltipIfLeavingChart = useCallback((e) => {
    const rel = e.relatedTarget;
    if (rel instanceof Node && donutChartRef.current?.contains(rel)) return;
    setDonutHover(null);
  }, []);

  const trendSeries = useMemo(() => {
    const trendSource = Array.isArray(allSos) ? allSos : [];
    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nowMs = now.getTime();
    const todayMs = startOfToday.getTime();

    const buildFixedBuckets = (startMs, bucketCount, bucketSizeMs, labelFn) => {
      const counts = Array(bucketCount).fill(0);
      trendSource.forEach((s) => {
        if (!s.created_at) return;
        const t = new Date(s.created_at).getTime();
        if (!Number.isFinite(t)) return;
        if (t < startMs || t >= startMs + bucketCount * bucketSizeMs) return;
        const idx = Math.min(bucketCount - 1, Math.floor((t - startMs) / bucketSizeMs));
        counts[idx] += 1;
      });
      return counts.map((count, idx) => ({
        label: labelFn(idx, startMs, bucketSizeMs),
        count,
        height: 0,
      }));
    };

    const buildMonthlyBuckets = (startMonth, monthsCount) => {
      const counts = Array(monthsCount).fill(0);
      const startYear = startMonth.getFullYear();
      const startMonthIndex = startMonth.getMonth();
      trendSource.forEach((s) => {
        if (!s.created_at) return;
        const createdAt = new Date(s.created_at);
        const t = createdAt.getTime();
        if (!Number.isFinite(t)) return;
        const monthIndex =
          (createdAt.getFullYear() - startYear) * 12 + (createdAt.getMonth() - startMonthIndex);
        if (monthIndex < 0 || monthIndex >= monthsCount) return;
        counts[monthIndex] += 1;
      });
      return counts.map((count, idx) => {
        const labelDate = new Date(startYear, startMonthIndex + idx, 1);
        return {
          label: formatMonthLabel(labelDate),
          count,
          height: 0,
        };
      });
    };

    let currentLabel = 'Kỳ này';
    let previousLabel = 'Kỳ trước';
    let current = [];
    let previous = [];

    if (dateRangePreset === 'today') {
      const bucketCount = 6;
      const bucketSizeMs = 4 * 60 * 60 * 1000;
      const labelFn = (idx) => {
        const startHour = idx * 4;
        const endHour = Math.min(24, (idx + 1) * 4);
        return `${pad2(startHour)}-${pad2(endHour)}`;
      };
      current = buildFixedBuckets(todayMs, bucketCount, bucketSizeMs, labelFn);
      previous = buildFixedBuckets(todayMs - dayMs, bucketCount, bucketSizeMs, labelFn);
      currentLabel = 'Hôm nay';
      previousLabel = 'Hôm qua';
    } else if (dateRangePreset === '7d') {
      const bucketCount = 7;
      const bucketSizeMs = dayMs;
      const currentStart = todayMs - 6 * dayMs;
      const previousStart = currentStart - 7 * dayMs;
      const labelFn = (idx, startMs) => formatDayLabel(new Date(startMs + idx * dayMs));
      current = buildFixedBuckets(currentStart, bucketCount, bucketSizeMs, labelFn);
      previous = buildFixedBuckets(previousStart, bucketCount, bucketSizeMs, labelFn);
      currentLabel = '7 ngày gần nhất';
      previousLabel = '7 ngày trước đó';
    } else if (dateRangePreset === '30d') {
      const bucketCount = 6;
      const bucketSizeMs = 5 * dayMs;
      const currentStart = todayMs - 29 * dayMs;
      const previousStart = currentStart - 30 * dayMs;
      const labelFn = (idx, startMs, sizeMs) =>
        formatRangeLabel(new Date(startMs + idx * sizeMs), new Date(startMs + (idx + 1) * sizeMs));
      current = buildFixedBuckets(currentStart, bucketCount, bucketSizeMs, labelFn);
      previous = buildFixedBuckets(previousStart, bucketCount, bucketSizeMs, labelFn);
      currentLabel = '30 ngày gần nhất';
      previousLabel = '30 ngày trước đó';
    } else {
      const monthsCount = 12;
      const startOfCurrentMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
      const currentStart = new Date(startOfCurrentMonth);
      currentStart.setMonth(currentStart.getMonth() - (monthsCount - 1));
      const previousStart = new Date(currentStart);
      previousStart.setMonth(previousStart.getMonth() - monthsCount);

      current = buildMonthlyBuckets(currentStart, monthsCount);
      previous = buildMonthlyBuckets(previousStart, monthsCount);
      currentLabel = '12 tháng gần nhất';
      previousLabel = '12 tháng trước đó';
    }

    const max = Math.max(
      ...current.map((c) => c.count),
      ...previous.map((c) => c.count),
      1,
    );
    const withHeight = (items) => items.map((item) => ({ ...item, height: (item.count / max) * 100 }));
    return {
      currentLabel,
      previousLabel,
      current: withHeight(current),
      previous: withHeight(previous),
    };
  }, [allSos, dateRangePreset]);

  const activeTrendData = trendWindow === 'previous' ? trendSeries.previous : trendSeries.current;

  const recentReports = useMemo(() => {
    const now = new Date();
    const thisMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    return [
      { title: `Báo cáo tháng ${thisMonth}.pdf`, date: `${String(now.getDate()).padStart(2, '0')}/${thisMonth}`, size: '4.2 MB' },
    ];
  }, []);

  return (
    <div className="w-full space-y-6 px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thống kê & Báo cáo</h1>
          <p className="mt-1 text-sm text-gray-500">
            Phân tích dữ liệu thời gian thực và báo cáo định kỳ.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value)}
              aria-label="Lọc theo khoảng thời gian"
              className={cn(
                'h-10 min-w-[11.5rem] cursor-pointer appearance-none rounded-lg border border-gray-200',
                'bg-white py-2 pl-10 pr-9 text-sm font-medium text-gray-700 shadow-sm',
                'outline-none transition hover:border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
              )}
            >
              {DATE_RANGE_PRESETS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Download className="size-4 shrink-0" />
            Xuất báo cáo PDF
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Activity className="size-6" />}
          title="Tổng số sự cố"
          value={loading ? '—' : stats.total.toLocaleString('vi-VN')}
          subtitle="Tất cả trạng thái"
          color="blue"
        />
        <StatCard
          icon={<AlertTriangle className="size-6" />}
          title="Sự cố đang hoạt động"
          value={loading ? '—' : stats.active.toLocaleString('vi-VN')}
          trend={loading || dateRangePreset === 'all' ? null : activeIncidentsTrendText}
          color="yellow"
        />
        <StatCard
          icon={<Clock className="size-6" />}
          title="T.gian phản hồi TB"
          value={loading ? '—' : `${stats.avgResponse}`}
          subtitle={stats.avgResponse > 0 ? 'phút' : 'Chưa có dữ liệu'}
          color="green"
        />
        <StatCard
          icon={<CheckCircle2 className="size-6" />}
          title="Tỷ lệ AI phân tích thành công"
          value={loading ? '—' : `${stats.aiAnalysisRate}%`}
          subtitle={loading ? null : aiAnalysisRateSubtitle}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Xu hướng sự cố theo thời gian */}
        <div className="rounded-2xl border border-[#E8E8EC] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Xu hướng sự cố theo thời gian</h2>
              <div className="mt-2 flex items-center gap-5 text-xs text-gray-600">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="trend-window"
                    checked={trendWindow === 'current'}
                    onChange={() => setTrendWindow('current')}
                    className="size-3.5 accent-blue-600"
                  />
                  <span className="gap-1.5">{trendSeries.currentLabel}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="trend-window"
                    checked={trendWindow === 'previous'}
                    onChange={() => setTrendWindow('previous')}
                    className="size-3.5 accent-blue-600"
                  />
                  <span className="gap-1.5">{trendSeries.previousLabel}</span>
                </label>
              </div>
            </div>
          </div>
          <div className="flex h-48 items-end justify-between gap-2">
            {activeTrendData.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="group relative w-full">
                  <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {d.count} sự cố
                  </div>
                  <div
                    className="w-full rounded-t-lg bg-blue-600 transition-all"
                    style={{ height: `${Math.max(d.height, 4)}px` }}
                  />
                </div>
                <p className="text-[10px] font-semibold text-gray-400">{d.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Phân loại sự cố */}
        <div className="rounded-2xl border border-[#E8E8EC] bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold text-gray-900">Phân loại sự cố</h2>
          <div className="mb-4 flex items-center justify-center">
            <div ref={donutChartRef} className="relative size-40 overflow-visible">
              <svg
                viewBox="0 0 100 100"
                className="size-full"
                onMouseLeave={hideDonutTooltipIfLeavingChart}
              >
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                {donutSlices.map((slice) =>
                  slice.fullRing ? (
                    <circle
                      key={slice.key}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={slice.fill}
                      strokeWidth="12"
                      className="cursor-pointer opacity-100 transition-opacity hover:opacity-90"
                      onMouseEnter={(e) => showDonutTooltip(e, slice)}
                      onMouseMove={updateDonutTooltipPos}
                    />
                  ) : (
                    <path
                      key={slice.key}
                      d={slice.d}
                      fill={slice.fill}
                      stroke={slice.fill}
                      strokeWidth={0.35}
                      strokeLinejoin="round"
                      className="cursor-pointer transition-opacity hover:opacity-85"
                      onMouseEnter={(e) => showDonutTooltip(e, slice)}
                      onMouseMove={updateDonutTooltipPos}
                    />
                  ),
                )}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? '—' : stats.total.toLocaleString('vi-VN')}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">TỔNG SỐ</p>
              </div>
              {donutHover && (
                <div
                  className="pointer-events-none absolute z-10 min-w-[11rem] max-w-[14rem] rounded-lg border border-gray-200 bg-white px-3 py-2 text-left shadow-md"
                  style={{
                    left: `clamp(4px, ${donutHover.x + 8}px, calc(100% - 7.5rem))`,
                    top: `clamp(4px, ${donutHover.y + 8}px, calc(100% - 5rem))`,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-0.5 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: donutHover.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900">
                        {donutHover.emoji ? `${donutHover.emoji} ` : ''}
                        {donutHover.label}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-gray-600">
                        <span className="font-medium text-gray-800">{donutHover.count}</span> sự cố
                        <span className="mx-1 text-gray-300">•</span>
                        <span className="font-medium text-gray-800">{donutHover.percent}%</span> tổng
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="max-h-48 space-y-0 overflow-y-auto border-t border-gray-100 pt-4">
            {distribution.length === 0 && !loading ? (
              <p className="text-center text-xs text-gray-400">Chưa có dữ liệu phân loại</p>
            ) : (
              <>
                <DistributionMetricHeader firstColumnLabel="Loại" />
                <div className="divide-y divide-gray-50">
                  {distribution.map((item, i) => (
                    <div
                      key={item.label + String(i)}
                      className={cn(METRIC_TABLE_GRID, 'py-2 text-xs')}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-gray-700">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              DISTRIBUTION_CHART_COLORS[i % DISTRIBUTION_CHART_COLORS.length],
                          }}
                        />
                        {item.emoji && (
                          <span className="shrink-0 text-base leading-none">{item.emoji}</span>
                        )}
                        <span className="truncate font-medium">{item.label}</span>
                      </span>
                      <span className="text-center font-semibold tabular-nums text-gray-800">
                        {item.percent}%
                      </span>
                      <span className="text-right font-semibold tabular-nums text-gray-800">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Hiệu suất phản ứng theo Đội cứu trợ  */}
        <div className="rounded-2xl border border-[#E8E8EC] bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold text-gray-900">
            Hiệu suất phản ứng theo Đội cứu trợ
          </h2>
          <div className="space-y-0">
            {loading && (
              <p className="text-sm text-gray-400">Đang tải…</p>
            )}
            {!loading && rescueTeamDistribution.length === 0 && (
              <p className="text-sm text-gray-400">Chưa có dữ liệu phân công đội.</p>
            )}
            {!loading && rescueTeamDistribution.length > 0 && (
              <>
                <DistributionMetricHeader firstColumnLabel="Loại" />
                <div className="divide-y divide-gray-50">
                  {rescueTeamDistribution.slice(0, 5).map((item, i) => (
                    <DistributionRow
                      key={item.label + String(i)}
                      label={item.label}
                      emoji={item.emoji}
                      count={item.count}
                      percent={item.percent}
                      barColor={DISTRIBUTION_CHART_COLORS[i % DISTRIBUTION_CHART_COLORS.length]}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tần suất sự cố theo khung giờ */}
        <div className="rounded-2xl border border-[#E8E8EC] bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold text-gray-900">
            Tần suất sự cố theo khung giờ
          </h2>
          <div className="flex h-48 items-end justify-between gap-2">
            {Array.from({ length: 12 }, (_, i) => {
              const hourStart = i * 2;
              const hourEnd = hourStart + 2;
              const count = filteredSos.filter((s) => {
                if (!s.created_at) return false;
                const h = new Date(s.created_at).getHours();
                return h >= hourStart && h < hourEnd;
              }).length;
              const max = Math.max(
                ...Array.from({ length: 12 }, (_, j) => {
                  const hs = j * 2;
                  const he = hs + 2;
                  return filteredSos.filter((x) => {
                    if (!x.created_at) return false;
                    const hh = new Date(x.created_at).getHours();
                    return hh >= hs && hh < he;
                  }).length;
                }),
                1,
              );
              const height = (count / max) * 100;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="relative w-full">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 transition-all"
                      style={{ height: `${Math.max(height, 4)}px` }}
                    />
                  </div>
                  <p className="text-[9px] font-semibold text-gray-400">
                    {String(hourStart).padStart(2, '0')}:00
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Báo cáo gần đây */}
      <div className="rounded-2xl border border-[#E8E8EC] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Báo cáo gần đây</h2>
          <button
            type="button"
            className="text-xs font-semibold text-blue-600 transition hover:underline"
          >
            Tất cả
          </button>
        </div>
        <div className="space-y-2">
          {recentReports.map((r, i) => (
            <ReportRow
              key={i}
              title={r.title}
              date={r.date}
              size={r.size}
              onDownload={() => alert('Chức năng đang phát triển')}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center justify-between gap-2 px-1 pb-2 text-[11px] text-gray-400 sm:flex-row">
        <span>© 2024 GUARDIAN RESPONSE SYSTEM • BẢO MẬT TUYỆT ĐỐI</span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-1.5 rounded-full bg-green-500" />
          HỆ THỐNG ỔN ĐỊNH · V.2.4.0-STABLE
        </span>
      </div>
    </div>
  );
}