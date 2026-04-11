import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Map,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatSosCode, getIncidentTypeDisplay } from '@/constants/incidentMeta';
import { getAllSos } from '@/services/api/apiSos';
import IncidentDetailModal from './IncidentDetailModal';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: 'Đang chờ' },
  { value: 'ASSIGNED', label: 'Đã phân công' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả mức độ' },
  { value: 'urgent', label: 'Khẩn cấp' },
  { value: 'high', label: 'Cao' },
  { value: 'medium', label: 'Trung bình' },
];

const TIME_FILTER_OPTIONS = [
  { value: '', label: 'Mọi lúc' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: '7 ngày qua' },
  { value: 'month', label: '30 ngày qua' },
];

/** Chuẩn hóa status từ DB (Pending / PENDING / …) */
function normalizeStatusKey(raw) {
  const x = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (x === 'pending') return 'PENDING';
  if (x === 'assigned') return 'ASSIGNED';
  if (x === 'in_progress' || x === 'inprogress') return 'IN_PROGRESS';
  if (x === 'resolved') return 'RESOLVED';
  if (x === 'cancelled' || x === 'canceled') return 'CANCELLED';
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

/** Mức độ: chỉ theo `ai_priority_score` từ backend — không suy từ PENDING. */
function derivePriority(sos) {
  const s = sos.ai_priority_score;
  if (s != null && !Number.isNaN(Number(s))) {
    const n = Number(s);
    if (n >= 70) return { key: 'urgent', label: 'KHẨN CẤP' };
    if (n >= 40) return { key: 'high', label: 'CAO' };
    return { key: 'medium', label: 'TRUNG BÌNH' };
  }
  return { key: 'medium', label: 'TRUNG BÌNH' };
}

function statusRow(raw) {
  const s = normalizeStatusKey(raw);
  switch (s) {
    case 'PENDING':
      return { text: 'Đang chờ', dot: 'bg-brand-muted' };
    case 'ASSIGNED':
    case 'IN_PROGRESS':
      return { text: 'Đang xử lý', dot: 'bg-brand-red' };
    case 'RESOLVED':
      return { text: 'Hoàn thành', dot: 'bg-brand-blue' };
    case 'CANCELLED':
      return { text: 'Đã hủy', dot: 'bg-brand-muted/60' };
    default:
      return { text: raw || '—', dot: 'bg-brand-muted' };
  }
}

function priorityBadgeClass(key) {
  if (key === 'urgent') return 'bg-brand-red/10 text-brand-red ring-1 ring-brand-red/25';
  if (key === 'high') return 'bg-brand-gray-bg text-brand-brown ring-1 ring-brand-muted/25';
  return 'bg-white text-brand-muted ring-1 ring-[#E5E7EB]';
}

function inTimeRange(createdAt, range) {
  if (!range || !createdAt) return true;
  const t = new Date(createdAt).getTime();
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (range === 'today') return t >= startOfToday.getTime();
  if (range === 'week') return t >= now - 7 * 24 * 60 * 60 * 1000;
  if (range === 'month') return t >= now - 30 * 24 * 60 * 60 * 1000;
  return true;
}

/** Ngày giờ gửi: dd/mm/yyyy, HH:mm */
function formatIncidentDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date}, ${time}`;
}

const PAGE_SIZE = 10;

export default function IncidentManagement() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detailSos, setDetailSos] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllSos(statusFilter || undefined);
      const list = res?.data?.data;
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.message || 'Không tải được danh sách');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((sos) => {
      if (priorityFilter) {
        const { key } = derivePriority(sos);
        if (key !== priorityFilter) return false;
      }
      if (!inTimeRange(sos.created_at, timeFilter)) return false;
      if (!q) return true;
      const id = String(sos._id || '').toLowerCase();
      const addr = (sos.address || '').toLowerCase();
      const name =
        typeof sos.victim_id === 'object' && sos.victim_id?.full_name
          ? sos.victim_id.full_name.toLowerCase()
          : '';
      const code = formatSosCode(sos._id).toLowerCase();
      return (
        id.includes(q) ||
        addr.includes(q) ||
        name.includes(q) ||
        code.includes(q)
      );
    });
  }, [rows, search, priorityFilter, timeFilter]);

  const activeCount = useMemo(
    () =>
      rows.filter(
        (s) => !['RESOLVED', 'CANCELLED'].includes(normalizeStatusKey(s.status))
      ).length,
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, timeFilter]);

  const rawLoad = Math.round((activeCount / Math.max(rows.length, 1)) * 100);
  const systemLoad = Math.min(100, rawLoad || 75);

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-none space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-black">
              Quản lý sự cố khẩn cấp
            </h1>
            <p className="mt-1 text-sm text-brand-brown">
              Theo dõi và điều phối các yêu cầu cứu hộ thời gian thực.
            </p>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-brand-red">
                Đang hoạt động
              </span>
              <p className="text-right leading-tight">
                <span className="text-3xl font-bold text-black tabular-nums">
                  {activeCount}
                </span>
                <span className="text-base font-normal text-brand-brown">
                  {' '}
                  sự cố khẩn
                </span>
              </p>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-brand-gray-bg">
              <div
                className="h-full rounded-full bg-brand-red transition-all duration-300"
                style={{ width: `${systemLoad}%` }}
              />
            </div>
            <p className="mt-2 text-right text-sm text-brand-brown">
              Tải hệ thống: {systemLoad}%
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#E8E8EC] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-brown/70" />
              <input
                type="search"
                placeholder="Tìm kiếm sự cố, địa chỉ hoặc mã số..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-transparent bg-brand-gray-bg pl-10 pr-3 text-sm text-brand-brown outline-none ring-offset-background placeholder:text-brand-muted focus-visible:ring-2 focus-visible:ring-brand-blue/30"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:flex lg:items-center lg:gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium uppercase text-brand-brown">
                Trạng thái
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 min-w-[140px] rounded-lg border border-transparent bg-brand-gray-bg px-2 text-sm font-normal normal-case text-brand-brown outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
                >
                  {STATUS_FILTER_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium uppercase text-brand-brown">
                Mức độ ưu tiên
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-10 min-w-[140px] rounded-lg border border-transparent bg-brand-gray-bg px-2 text-sm font-normal normal-case text-brand-brown outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
                >
                  {PRIORITY_FILTER_OPTIONS.map((o) => (
                    <option key={o.value || 'allp'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium uppercase text-brand-brown">
                Khoảng thời gian
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="h-10 min-w-[140px] rounded-lg border border-transparent bg-brand-gray-bg px-2 text-sm font-normal normal-case text-brand-brown outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
                >
                  {TIME_FILTER_OPTIONS.map((o) => (
                    <option key={o.value || 'allt'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button
              type="button"
              className="h-10 gap-2 bg-black text-white hover:bg-neutral-900"
              onClick={() => load()}
            >
              <Filter className="size-4" />
              Áp dụng lọc
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E8E8EC] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E8E8EC] bg-brand-gray-bg text-xs font-semibold uppercase tracking-wide text-brand-brown">
                  <th className="px-4 py-3">ID sự cố</th>
                  <th className="px-4 py-3">Loại sự cố</th>
                  <th className="px-4 py-3">Người gửi</th>
                  <th className="px-4 py-3">Địa chỉ</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Mức độ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-brand-muted">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-brand-red">
                      {error}
                    </td>
                  </tr>
                )}
                {!loading &&
                  !error &&
                  pageSlice.map((sos) => {
                    const { label: typeLabel, Icon, emoji: typeEmoji } = getIncidentTypeDisplay(
                      sos.incident_type
                    );
                    const victimName =
                      typeof sos.victim_id === 'object' && sos.victim_id?.full_name
                        ? sos.victim_id.full_name
                        : '—';
                    const pr = derivePriority(sos);
                    const st = statusRow(sos.status);
                    return (
                      <tr
                        key={sos._id}
                        className="border-b border-[#E8E8EC] last:border-0 hover:bg-brand-gray-bg/80"
                      >
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-brand-red">
                          {formatSosCode(sos._id)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gray-bg text-brand-brown">
                              {typeEmoji ? (
                                <span className="text-lg leading-none" aria-hidden>{typeEmoji}</span>
                              ) : (
                                <Icon className="size-4" aria-hidden />
                              )}
                            </span>
                            <span className="font-medium text-brand-brown">{typeLabel}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-brand-brown">{victimName}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-brand-muted" title={sos.address}>
                          {sos.address || '—'}
                        </td>
                        <td className="min-w-[180px] whitespace-nowrap px-4 py-3 text-brand-muted">
                          {formatIncidentDateTime(sos.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                              priorityBadgeClass(pr.key)
                            )}
                          >
                            {pr.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('size-2 rounded-full', st.dot)} />
                            <span className="text-brand-brown">{st.text}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailSos(sos)}
                              className="inline-flex size-8 items-center justify-center rounded-lg text-brand-muted transition hover:bg-brand-gray-bg hover:text-brand-brown"
                              title="Xem chi tiết"
                            >
                              <Eye className="size-4" />
                            </button>
                            <span className="inline-flex size-8 items-center justify-center">
                              {['ASSIGNED', 'IN_PROGRESS'].includes(normalizeStatusKey(sos.status)) ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/admin/tracking/${sos._id}`)}
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-brand-muted transition hover:bg-blue-50 hover:text-blue-600"
                                  title="Xem trên bản đồ"
                                >
                                  <Map className="size-4" />
                                </button>
                              ) : null}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {!loading && !error && pageSlice.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-brand-muted">
                      Không có sự cố nào phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-[#E8E8EC] px-4 py-3 sm:flex-row">
            <p className="text-sm text-brand-brown">
              Hiển thị{' '}
              {filtered.length === 0
                ? '0'
                : `${(safePage - 1) * PAGE_SIZE + 1} - ${Math.min(
                    safePage * PAGE_SIZE,
                    filtered.length
                  )}`}{' '}
              của {filtered.length} sự cố
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg p-2 text-brand-muted hover:bg-brand-gray-bg disabled:opacity-40"
                aria-label="Trang trước"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    'min-w-9 rounded-lg px-2 py-1.5 text-sm font-medium transition',
                    n === safePage
                      ? 'bg-brand-red text-white'
                      : 'text-brand-muted hover:bg-brand-gray-bg'
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg p-2 text-brand-muted hover:bg-brand-gray-bg disabled:opacity-40"
                aria-label="Trang sau"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {detailSos && (
        <IncidentDetailModal
          sos={detailSos}
          onClose={() => setDetailSos(null)}
          onStatusChanged={() => load()}
        />
      )}
    </div>
  );
}
