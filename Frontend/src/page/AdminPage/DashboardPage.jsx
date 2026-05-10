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
  const [trendWindow, setTrendWindow] = useState('this_week');
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

    const completionRate = total > 0 ? Math.round((resolved.length / total) * 1000) / 10 : 0;

    const now = Date.now();
    const last7days = filteredSos.filter(
      (s) => s.created_at && now - new Date(s.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000,
    );
    const prev7days = filteredSos.filter(
      (s) =>
        s.created_at &&
        now - new Date(s.created_at).getTime() > 7 * 24 * 60 * 60 * 1000 &&
        now - new Date(s.created_at).getTime() <= 14 * 24 * 60 * 60 * 1000,
    );
    const trendPercent =
      prev7days.length > 0
        ? Math.round(((last7days.length - prev7days.length) / prev7days.length) * 100)
        : 0;

    return {
      total,
      active: active.length,
      resolved: resolved.length,
      cancelled: cancelled.length,
      avgResponse,
      completionRate,
      trendPercent,
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
    const dayLabels = ['THỨ 2', 'THỨ 3', 'THỨ 4', 'THỨ 5', 'THỨ 6', 'THỨ 7', 'CHỦ NHẬT'];
    const thisWeekCounts = Array(7).fill(0);
    const prevWeekCounts = Array(7).fill(0);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = startOfToday.getDay(); // 0: CN, 1: T2 ... 6: T7
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfThisWeek = new Date(startOfToday);
    startOfThisWeek.setDate(startOfThisWeek.getDate() - diffToMonday);
    const startOfNextWeek = new Date(startOfThisWeek);
    startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);
    const startOfPrevWeek = new Date(startOfThisWeek);
    startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

    const mapDateToWeekIndex = (dateObj) => {
      const d = dateObj.getDay();
      return d === 0 ? 6 : d - 1; // T2..CN => 0..6
    };

    filteredSos.forEach((s) => {
      if (!s.created_at) return;
      const createdAt = new Date(s.created_at);
      if (Number.isNaN(createdAt.getTime())) return;
      const createdDay = new Date(
        createdAt.getFullYear(),
        createdAt.getMonth(),
        createdAt.getDate(),
      );

      if (createdDay >= startOfThisWeek && createdDay < startOfNextWeek) {
        const idx = mapDateToWeekIndex(createdDay);
        thisWeekCounts[idx] += 1;
        return;
      }
      if (createdDay >= startOfPrevWeek && createdDay < startOfThisWeek) {
        const idx = mapDateToWeekIndex(createdDay);
        prevWeekCounts[idx] += 1;
      }
    });
    const max = Math.max(...thisWeekCounts, ...prevWeekCounts, 1);
    return {
      this_week: thisWeekCounts.map((c, i) => ({ label: dayLabels[i], count: c, height: (c / max) * 100 })),
      prev_week: prevWeekCounts.map((c, i) => ({ label: dayLabels[i], count: c, height: (c / max) * 100 })),
    };
  }, [filteredSos]);

  const activeTrendData = trendWindow === 'prev_week' ? trendSeries.prev_week : trendSeries.this_week;

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
          trend={stats.trendPercent > 0 ? `+${stats.trendPercent}% so với tuần trước` : stats.trendPercent < 0 ? `${stats.trendPercent}% so với tuần trước` : null}
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
          value={`${stats.completionRate}%`}
          subtitle={`+1.2% so với tháng trước`}
          trend="Xử lý từ đồng thời gian thực"
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
                    checked={trendWindow === 'this_week'}
                    onChange={() => setTrendWindow('this_week')}
                    className="size-3.5 accent-blue-600"
                  />
                  <span className="gap-1.5">
                    
                    Tuần này
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="trend-window"
                    checked={trendWindow === 'prev_week'}
                    onChange={() => setTrendWindow('prev_week')}
                    className="size-3.5 accent-blue-600"
                  />
                  <span className="gap-1.5">
                    
                    Tuần trước
                  </span>
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
