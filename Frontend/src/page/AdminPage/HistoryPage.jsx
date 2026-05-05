import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Clock, CheckCircle2, Search } from 'lucide-react';
import { getAdminPaginationItems } from '@/lib/adminPagination';
import { cn } from '@/lib/utils';
import { formatSosCode, getIncidentTypeDisplay } from '@/constants/incidentMeta';
import { getAllSos } from '@/services/api/apiSos';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'RESOLVED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const PAGE_SIZE = 10;

function normalizeStatus(s) {
  const x = String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (x === 'resolved') return 'RESOLVED';
  if (x === 'cancelled' || x === 'canceled') return 'CANCELLED';
  return String(s ?? '').toUpperCase();
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateTimeShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
    '\n' +
    d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  );
}

/** Tính thời điểm kết thúc từ status_history */
function getEndTime(sos) {
  const hist = sos.status_history;
  if (!Array.isArray(hist) || hist.length === 0) return null;
  const last = [...hist].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
  return last?.updated_at ?? null;
}

/** Tính tổng thời gian xử lý (phút → hiển thị) */
function getDuration(sos) {
  const start = sos.created_at;
  const end = getEndTime(sos);
  if (!start || !end) return '—';
  const mins = Math.round((new Date(end) - new Date(start)) / 60_000);
  if (mins < 0) return '—';
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}g ${m}p` : `${h} giờ`;
}

function StatusBadge({ status }) {
  const k = normalizeStatus(status);
  if (k === 'RESOLVED')
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
        Hoàn thành
      </span>
    );
  if (k === 'CANCELLED')
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
        Đã hủy
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
      {status}
    </span>
  );
}

function StatCard({ icon, label, value, sub, subColor, extra }) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-2xl border border-[#E8E8EC] bg-white px-6 py-5 shadow-sm">
      <div>
        <p className="mb-1 text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {sub && (
          <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', subColor ?? 'text-gray-500')}>
            {sub}
          </p>
        )}
        {extra}
      </div>
      <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
        {icon}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [idFilter, setIdFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    id: '', type: '', date: '', status: '',
  });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch cả RESOLVED + CANCELLED; lọc phía FE để linh hoạt với bộ lọc
      const [resA, resB] = await Promise.all([
        getAllSos('RESOLVED'),
        getAllSos('CANCELLED'),
      ]);
      const listA = resA?.data?.data ?? [];
      const listB = resB?.data?.data ?? [];
      const merged = [...listA, ...listB].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      setRows(merged);
    } catch (e) {
      setError(e?.message || 'Không tải được dữ liệu');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleApplyFilter() {
    setAppliedFilters({ id: idFilter, type: typeFilter, date: dateFilter, status: statusFilter });
    setPage(1);
  }

  const typeOptions = useMemo(() => {
    const seen = new Set();
    const opts = [{ value: '', label: 'Tất cả loại' }];
    rows.forEach((r) => {
      const key = typeof r.incident_type === 'object' ? r.incident_type?._id : r.incident_type;
      const label = typeof r.incident_type === 'object' ? r.incident_type?.name : r.incident_type;
      if (key && !seen.has(key)) {
        seen.add(key);
        opts.push({ value: String(key), label: label || String(key) });
      }
    });
    return opts;
  }, [rows]);

  const filtered = useMemo(() => {
    const { id, type, date, status } = appliedFilters;
    return rows.filter((r) => {
      if (status) {
        const k = normalizeStatus(r.status);
        const target = normalizeStatus(status);
        if (k !== target) return false;
      }
      if (id) {
        const q = id.toLowerCase();
        const code = formatSosCode(r._id).toLowerCase();
        if (!code.includes(q) && !String(r._id).toLowerCase().includes(q)) return false;
      }
      if (type) {
        const key = typeof r.incident_type === 'object' ? String(r.incident_type?._id) : String(r.incident_type ?? '');
        if (key !== type) return false;
      }
      if (date) {
        const d = new Date(date);
        const c = new Date(r.created_at);
        if (
          d.getFullYear() !== c.getFullYear() ||
          d.getMonth() !== c.getMonth() ||
          d.getDate() !== c.getDate()
        ) return false;
      }
      return true;
    });
  }, [rows, appliedFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  // Stats
  const resolvedRows = useMemo(() => rows.filter((r) => normalizeStatus(r.status) === 'RESOLVED'), [rows]);
  const cancelledRows = useMemo(() => rows.filter((r) => normalizeStatus(r.status) === 'CANCELLED'), [rows]);
  const completionRate = rows.length > 0 ? Math.round((resolvedRows.length / rows.length) * 1000) / 10 : 0;

  const avgMinutes = useMemo(() => {
    const durations = resolvedRows
      .map((r) => {
        const end = getEndTime(r);
        if (!r.created_at || !end) return null;
        return (new Date(end) - new Date(r.created_at)) / 60_000;
      })
      .filter((v) => v != null && v >= 0);
    if (!durations.length) return null;
    return Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10;
  }, [resolvedRows]);

  const pagesArr = useMemo(
    () => getAdminPaginationItems(safePage, totalPages),
    [safePage, totalPages],
  );

  return (
    <div className="w-full px-6 py-8 space-y-6">
      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900">Lịch sử sự cố</h1>

      {/* Stats */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <StatCard
          icon={<ClipboardList className="size-6" />}
          label="Tổng số nhiệm vụ"
          value={loading ? '—' : rows.length.toLocaleString('vi-VN')}
          subColor="text-green-600"
        />
        <StatCard
          icon={<Clock className="size-6 text-green-500" />}
          label="T.gian phản hồi TB"
          value={avgMinutes != null ? `${avgMinutes}` : '—'}
          sub={avgMinutes != null ? 'phút (đã hoàn thành)' : 'Chưa có dữ liệu'}
          subColor="text-green-600"
        />
        <StatCard
          icon={<CheckCircle2 className="size-6 text-blue-500" />}
          label="Tỷ lệ hoàn thành"
          value={`${completionRate}%`}
          sub={`${resolvedRows.length} hoàn thành / ${cancelledRows.length} đã hủy`}
          subColor="text-blue-600"
          extra={
            <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          }
        />
      </div>

      {/* Filter */}
      <div className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Search className="size-4 text-gray-400" />
          Bộ lọc tìm kiếm
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              ID sự cố
            </label>
            <input
              type="text"
              placeholder="VD: SOS-2023..."
              value={idFilter}
              onChange={(e) => setIdFilter(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Loại sự cố
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-200"
            >
              {typeOptions.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Khoảng thời gian
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-200"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleApplyFilter}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            <Search className="size-4" />
            Áp dụng bộ lọc
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E8E8EC] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E8E8EC] bg-gray-50 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Loại sự cố</th>
                <th className="px-5 py-3.5">Vị trí</th>
                <th className="px-5 py-3.5">Đội cứu trợ</th>
                <th className="px-5 py-3.5">Bắt đầu</th>
                <th className="px-5 py-3.5">Kết thúc</th>
                <th className="px-5 py-3.5">Tổng TG</th>
                <th className="px-5 py-3.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-sm text-gray-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-sm text-red-500">{error}</td>
                </tr>
              )}
              {!loading && !error && pageSlice.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-sm text-gray-400">
                    Không có dữ liệu phù hợp.
                  </td>
                </tr>
              )}
              {!loading && !error && pageSlice.map((sos) => {
                const code = formatSosCode(sos._id);
                const { label: typeLabel, Icon, emoji } = getIncidentTypeDisplay(sos.incident_type);
                const rescue = typeof sos.assigned_rescue_id === 'object'
                  ? sos.assigned_rescue_id?.full_name
                  : null;
                const endTime = getEndTime(sos);
                const duration = getDuration(sos);
                return (
                  <tr
                    key={sos._id}
                    className="border-b border-[#E8E8EC] last:border-0 hover:bg-gray-50/80"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-bold text-blue-600">{code}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                          {emoji ? (
                            <span className="text-sm leading-none">{emoji}</span>
                          ) : (
                            <Icon className="size-3.5" aria-hidden />
                          )}
                        </span>
                        <span className="text-sm text-gray-700">{typeLabel}</span>
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate px-5 py-4 text-sm text-gray-600" title={sos.address}>
                      {sos.address || '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {rescue || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="whitespace-pre px-5 py-4 text-xs leading-relaxed text-gray-600">
                      {formatDateTimeShort(sos.created_at)}
                    </td>
                    <td className="whitespace-pre px-5 py-4 text-xs leading-relaxed text-gray-600">
                      {formatDateTimeShort(endTime)}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-800">
                      {duration}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={sos.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-[#E8E8EC] px-5 py-3.5 sm:flex-row">
          <p className="text-sm text-gray-500">
            {filtered.length === 0
              ? 'Không có dữ liệu'
              : `Hiển thị ${(safePage - 1) * PAGE_SIZE + 1} - ${Math.min(safePage * PAGE_SIZE, filtered.length)} trong tổng số ${filtered.length.toLocaleString('vi-VN')} sự cố`}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-w-9 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              aria-label="Trang trước"
            >
              {'<'}
            </button>
            {pagesArr.map((item, i) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${i}`} className="min-w-9 px-1 text-center text-sm text-gray-400 select-none">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={cn(
                    'min-w-9 rounded-lg px-2.5 py-1.5 text-sm font-medium transition',
                    item === safePage
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100',
                  )}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="min-w-9 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              aria-label="Trang sau"
            >
              {'>'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center justify-between gap-2 px-1 pb-2 text-[11px] text-gray-400 sm:flex-row">
        <span>© 2024 GUARDIAN RESPONSE SYSTEM • BẢO MẬT TUYỆT ĐỐI</span>
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-green-500 inline-block" />
          HỆ THỐNG ỔN ĐỊNH · V.1.0.0
        </span>
      </div>
    </div>
  );
}
