import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
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

function DistributionRow({ label, emoji, count, percent, color }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {emoji && <span className="text-lg">{emoji}</span>}
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
          <div className={cn('h-full rounded-full', color)} style={{ width: `${percent}%` }} />
        </div>
        <span className="w-12 text-right text-sm font-bold text-gray-900">{percent}%</span>
        <span className="w-8 text-right text-xs text-gray-500">{count}</span>
      </div>
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

  const stats = useMemo(() => {
    const total = allSos.length;
    const resolved = allSos.filter((s) => normalizeStatus(s.status) === 'RESOLVED');
    const active = allSos.filter((s) =>
      ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(normalizeStatus(s.status)),
    );
    const cancelled = allSos.filter((s) => normalizeStatus(s.status) === 'CANCELLED');

    const durations = resolved
      .map((s) => calculateDuration(s))
      .filter((d) => d != null && d >= 0);
    const avgResponse = durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : 0;

    const completionRate = total > 0 ? Math.round((resolved.length / total) * 1000) / 10 : 0;

    const now = Date.now();
    const last7days = allSos.filter(
      (s) => s.created_at && now - new Date(s.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000,
    );
    const prev7days = allSos.filter(
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
  }, [allSos]);

  const distribution = useMemo(() => {
    const typeMap = new Map();
    allSos.forEach((s) => {
      const { label, emoji } = getIncidentTypeDisplay(s.incident_type);
      const key = label;
      if (!typeMap.has(key)) typeMap.set(key, { label, emoji, count: 0 });
      typeMap.get(key).count += 1;
    });
    const sorted = Array.from(typeMap.values()).sort((a, b) => b.count - a.count);
    const total = allSos.length || 1;
    return sorted.map((item) => ({
      ...item,
      percent: Math.round((item.count / total) * 100),
    }));
  }, [allSos]);

  const trendData = useMemo(() => {
    const dayLabels = ['THỨ 2', 'THỨ 3', 'THỨ 4', 'THỨ 5', 'THỨ 6', 'THỨ 7', 'CHỦ NHẬT'];
    const counts = Array(7).fill(0);
    const now = new Date();
    allSos.forEach((s) => {
      if (!s.created_at) return;
      const diff = now - new Date(s.created_at);
      if (diff < 0 || diff > 7 * 24 * 60 * 60 * 1000) return;
      const daysAgo = Math.floor(diff / (24 * 60 * 60 * 1000));
      const idx = 6 - daysAgo;
      if (idx >= 0 && idx < 7) counts[idx] += 1;
    });
    const max = Math.max(...counts, 1);
    return counts.map((c, i) => ({ label: dayLabels[i], count: c, height: (c / max) * 100 }));
  }, [allSos]);

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
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Download className="size-4" />
          Xuất báo cáo PDF
        </button>
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
          title="Đang hoạt động"
          value={loading ? '—' : stats.active.toLocaleString('vi-VN')}
          subtitle="Pending + Assigned + In Progress"
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
          title="Chỉ số tin cậy AI"
          value={`${stats.completionRate}%`}
          subtitle={`+1.2% so với tháng trước`}
          trend="Xử lý từ đồng thời gian thực"
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Xu hướng sự cố theo thời gian */}
        <div className="rounded-2xl border border-[#E8E8EC] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Xu hướng sự cố theo thời gian</h2>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-600" />
                  Tuần nay
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-gray-300" />
                  Tuần trước
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:bg-gray-50"
              >
                7 ngày qua
              </button>
            </div>
          </div>
          <div className="flex h-48 items-end justify-between gap-2">
            {trendData.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative w-full">
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
            <div className="relative size-40">
              <svg viewBox="0 0 100 100" className="rotate-[-90deg]">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="12"
                  strokeDasharray={`${(stats.resolved / Math.max(stats.total, 1)) * 251.2} 251.2`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? '—' : stats.total.toLocaleString('vi-VN')}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">TỔNG SỐ</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-gray-600">
                <span className="size-2 rounded-full bg-green-500" />
                Giao thông ({Math.round((distribution[0]?.count ?? 0) / Math.max(stats.total, 1) * 100)}%)
              </span>
              <span className="font-semibold text-gray-800">{distribution[0]?.count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-gray-600">
                <span className="size-2 rounded-full bg-blue-500" />
                Hỏa hoạn ({Math.round((distribution[1]?.count ?? 0) / Math.max(stats.total, 1) * 100)}%)
              </span>
              <span className="font-semibold text-gray-800">{distribution[1]?.count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-gray-600">
                <span className="size-2 rounded-full bg-yellow-500" />
                Y tế ({Math.round((distribution[2]?.count ?? 0) / Math.max(stats.total, 1) * 100)}%)
              </span>
              <span className="font-semibold text-gray-800">{distribution[2]?.count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-gray-600">
                <span className="size-2 rounded-full bg-gray-400" />
                Khác ({Math.round((distribution.slice(3).reduce((a, b) => a + b.count, 0)) / Math.max(stats.total, 1) * 100)}%)
              </span>
              <span className="font-semibold text-gray-800">
                {distribution.slice(3).reduce((a, b) => a + b.count, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Hiệu suất phản ứng theo Phường */}
        <div className="rounded-2xl border border-[#E8E8EC] bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold text-gray-900">
            Hiệu suất phản ứng theo Phường
          </h2>
          <div className="space-y-3">
            {distribution.slice(0, 5).map((item, i) => {
              const colors = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
              return (
                <DistributionRow
                  key={item.label}
                  label={item.label}
                  emoji={item.emoji}
                  count={item.count}
                  percent={item.percent}
                  color={colors[i % colors.length]}
                />
              );
            })}
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
              const count = allSos.filter((s) => {
                if (!s.created_at) return false;
                const h = new Date(s.created_at).getHours();
                return h >= hourStart && h < hourEnd;
              }).length;
              const max = Math.max(
                ...Array.from({ length: 12 }, (_, j) => {
                  const hs = j * 2;
                  const he = hs + 2;
                  return allSos.filter((x) => {
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
