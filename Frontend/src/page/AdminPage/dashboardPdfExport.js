import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { formatSosCode, getIncidentTypeDisplay } from '@/constants/incidentMeta';

/** Chụp DOM → PDF nhiều trang (không dùng `doc.html` — tránh import động html2canvas lỗi trên Vite). */
function addCanvasToPdfPages(doc, canvas, imgData, marginMm) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * marginMm;
  const pageInner = pageHeight - 2 * marginMm;

  const imgHeightMm = (canvas.height * contentWidth) / canvas.width;
  let heightLeft = imgHeightMm;
  let y = marginMm;

  doc.addImage(imgData, 'JPEG', marginMm, y, contentWidth, imgHeightMm, undefined, 'FAST');
  heightLeft -= pageInner;

  while (heightLeft > 0) {
    y = heightLeft - imgHeightMm + marginMm;
    doc.addPage();
    doc.addImage(imgData, 'JPEG', marginMm, y, contentWidth, imgHeightMm, undefined, 'FAST');
    heightLeft -= pageInner;
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeStatus(st) {
  const x = String(st ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (x === 'pending') return 'PENDING';
  if (x === 'assigned') return 'ASSIGNED';
  if (x === 'in_progress' || x === 'inprogress') return 'IN_PROGRESS';
  if (x === 'resolved') return 'RESOLVED';
  if (x === 'cancelled' || x === 'canceled') return 'CANCELLED';
  return String(st ?? '').toUpperCase();
}

function statusVi(status) {
  const u = normalizeStatus(status);
  const map = {
    PENDING: 'Chờ xử lý',
    ASSIGNED: 'Đã phân công',
    IN_PROGRESS: 'Đang xử lý',
    RESOLVED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
  };
  return map[u] || u;
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

function formatDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return String(iso);
  }
}

function buildIncidentRows(filteredSos, limit) {
  const sorted = [...(filteredSos || [])].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  const slice = sorted.slice(0, limit);
  return {
    rows: slice.map((s) => {
      const { label: typeLabel } = getIncidentTypeDisplay(s.incident_type);
      return {
        code: formatSosCode(s._id),
        typeLabel,
        statusLabel: statusVi(s.status),
        createdAt: formatDt(s.created_at),
        team: getAssignedRescueLabel(s),
      };
    }),
    truncated: sorted.length > limit,
    totalListed: slice.length,
    totalAll: sorted.length,
  };
}

function hourBucketsHtml(filteredSos) {
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const hourStart = i * 2;
    const hourEnd = hourStart + 2;
    const count = (filteredSos || []).filter((s) => {
      if (!s.created_at) return false;
      const h = new Date(s.created_at).getHours();
      return h >= hourStart && h < hourEnd;
    }).length;
    return { label: `${String(hourStart).padStart(2, '0')}:00–${String(hourEnd).padStart(2, '0')}:00`, count };
  });
  const cells = buckets
    .map(
      (b) =>
        `<td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;font-size:9px;">${b.count}</td>`,
    )
    .join('');
  const labels = buckets
    .map(
      (b) =>
        `<td style="padding:2px;border:1px solid #f3f4f6;text-align:center;font-size:8px;color:#6b7280;">${escapeHtml(b.label)}</td>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin-top:6px;"><tr>${cells}</tr><tr>${labels}</tr></table>`;
}

function buildHtml({
  generatedAtLabel,
  dateRangeLabel,
  stats,
  distribution,
  rescueTeamDistribution,
  filteredSos,
}) {
  const { rows, truncated, totalAll } = buildIncidentRows(filteredSos, 45);

  const statsRows = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:11px;"><strong>Tổng số sự cố</strong></td>
        <td style="padding:8px;border:1px solid #e5e7eb;font-size:11px;">${escapeHtml(String(stats.total))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:11px;"><strong>Đang hoạt động</strong></td>
        <td style="padding:8px;border:1px solid #e5e7eb;font-size:11px;">${escapeHtml(String(stats.active))}</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:11px;"><strong>Hoàn thành</strong></td>
        <td style="padding:8px;border:1px solid #e5e7eb;font-size:11px;">${escapeHtml(String(stats.resolved))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:11px;"><strong>Đã hủy</strong></td>
        <td style="padding:8px;border:1px solid #e5e7eb;font-size:11px;">${escapeHtml(String(stats.cancelled))}</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:11px;"><strong>T.gian phản hồi TB (phút)</strong></td>
        <td style="padding:8px;border:1px solid #e5e7eb;font-size:11px;">${escapeHtml(String(stats.avgResponse))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:11px;"><strong>Tỷ lệ AI phân tích (%)</strong></td>
        <td style="padding:8px;border:1px solid #e5e7eb;font-size:11px;">${escapeHtml(String(stats.aiAnalysisRate))}</td>
      </tr>
    </table>`;

  const distRows = (distribution || [])
    .map(
      (item) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;">${escapeHtml(item.label)}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:center;">${escapeHtml(String(item.percent))}%</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:right;">${escapeHtml(String(item.count))}</td>
    </tr>`,
    )
    .join('');

  const teamRows = (rescueTeamDistribution || [])
    .slice(0, 12)
    .map(
      (item) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;">${escapeHtml(item.label)}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:center;">${escapeHtml(String(item.percent))}%</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:right;">${escapeHtml(String(item.count))}</td>
    </tr>`,
    )
    .join('');

  const incidentRows = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;">${escapeHtml(r.code)}</td>
      <td style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;">${escapeHtml(r.typeLabel)}</td>
      <td style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;">${escapeHtml(r.statusLabel)}</td>
      <td style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;">${escapeHtml(r.team)}</td>
      <td style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;">${escapeHtml(r.createdAt)}</td>
    </tr>`,
    )
    .join('');

  const noteTrunc = truncated
    ? `<p style="font-size:9px;color:#6b7280;margin:6px 0 0;">* Danh sách hiển thị 45 bản ghi mới nhất trong tổng ${escapeHtml(String(totalAll))} sự cố theo bộ lọc.</p>`
    : '';

  return `
<div style="font-family:'Be Vietnam Pro','Segoe UI',system-ui,sans-serif;color:#111;line-height:1.45;">
  <h1 style="font-size:17px;margin:0 0 6px;font-weight:700;">Báo cáo thống kê — SOS Guardian</h1>
  <p style="margin:0 0 4px;font-size:11px;color:#374151;">Khoảng thời gian: <strong>${escapeHtml(dateRangeLabel)}</strong></p>
  <p style="margin:0 0 14px;font-size:10px;color:#6b7280;">Xuất lúc: ${escapeHtml(generatedAtLabel)}</p>
  ${statsRows}

  <h2 style="font-size:13px;margin:16px 0 8px;">Phân loại sự cố</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:left;">Loại</th>
        <th style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;">%</th>
        <th style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:right;">Số lượng</th>
      </tr>
    </thead>
    <tbody>${distRows || `<tr><td colspan="3" style="padding:8px;font-size:10px;color:#9ca3af;">Không có dữ liệu</td></tr>`}</tbody>
  </table>

  <h2 style="font-size:13px;margin:16px 0 8px;">Hiệu suất theo đội cứu trợ (top 12)</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:left;">Đội</th>
        <th style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;">%</th>
        <th style="padding:6px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:right;">Số lượng</th>
      </tr>
    </thead>
    <tbody>${teamRows || `<tr><td colspan="3" style="padding:8px;font-size:10px;color:#9ca3af;">Không có dữ liệu</td></tr>`}</tbody>
  </table>

  <h2 style="font-size:13px;margin:16px 0 8px;">Tần suất sự cố theo khung giờ (2h)</h2>
  ${hourBucketsHtml(filteredSos)}

  <h2 style="font-size:13px;margin:16px 0 8px;">Danh sách sự cố (mới nhất)</h2>
  ${noteTrunc}
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;text-align:left;">Mã</th>
        <th style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;text-align:left;">Loại</th>
        <th style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;text-align:left;">Trạng thái</th>
        <th style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;text-align:left;">Đội</th>
        <th style="padding:5px 6px;border:1px solid #e5e7eb;font-size:9px;text-align:left;">Thời gian tạo</th>
      </tr>
    </thead>
    <tbody>${incidentRows || `<tr><td colspan="5" style="padding:8px;font-size:10px;color:#9ca3af;">Không có dữ liệu</td></tr>`}</tbody>
  </table>

  <p style="margin-top:14px;font-size:9px;color:#9ca3af;">© SOS Guardian — Báo cáo nội bộ</p>
</div>`;
}

/**
 * Tách khỏi CSS app (Tailwind 4 dùng oklch — html2canvas không parse được).
 */
function mountPdfHtmlInIsolatedIframe(htmlMarkup) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'pdf-export';
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:760px;height:24000px;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument;
  if (!idoc) {
    document.body.removeChild(iframe);
    throw new Error('Không tạo được iframe xuất PDF');
  }

  idoc.open();
  idoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family: system-ui, "Segoe UI", Roboto, sans-serif;
    }
  </style></head><body></body></html>`);
  idoc.close();

  idoc.body.style.margin = '0';
  idoc.body.style.padding = '16px';
  idoc.body.style.width = '720px';
  idoc.body.style.background = '#ffffff';
  idoc.body.innerHTML = htmlMarkup;

  return { iframe, root: idoc.body };
}

/**
 * Xuất PDF báo cáo dashboard (tiếng Việt qua render HTML + canvas).
 * Trình duyệt sẽ tải file `.pdf` (thư mục Download mặc định).
 */
export async function downloadDashboardPdf({
  dateRangeLabel,
  stats,
  distribution,
  rescueTeamDistribution,
  filteredSos,
}) {
  const generatedAtLabel = new Date().toLocaleString('vi-VN');
  const html = buildHtml({
    generatedAtLabel,
    dateRangeLabel,
    stats,
    distribution,
    rescueTeamDistribution,
    filteredSos,
  });

  const { iframe, root } = mountPdfHtmlInIsolatedIframe(html);

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const safeName = `bao-cao-dashboard-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.pdf`;
  const marginMm = 10;

  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const w = Math.max(root.scrollWidth, 720);
    const h = Math.max(root.scrollHeight, 1);

    const canvas = await html2canvas(root, {
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
      foreignObjectRendering: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    addCanvasToPdfPages(doc, canvas, imgData, marginMm);
    doc.save(safeName);
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }
}
