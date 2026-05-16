import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { formatSosCode, getIncidentTypeDisplay } from '@/constants/incidentMeta';

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  const x = String(st ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (x === 'pending') return 'PENDING';
  if (x === 'assigned') return 'ASSIGNED';
  if (x === 'in_progress' || x === 'inprogress') return 'IN_PROGRESS';
  if (x === 'resolved') return 'RESOLVED';
  if (x === 'cancelled' || x === 'canceled') return 'CANCELLED';
  return String(st ?? '').toUpperCase();
}

function statusVi(status) {
  const map = {
    PENDING: 'Chờ xử lý',
    ASSIGNED: 'Đã phân công',
    IN_PROGRESS: 'Đang xử lý',
    RESOLVED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
  };
  return map[normalizeStatus(status)] || String(status ?? '').toUpperCase();
}

function getAssignedRescueLabel(sos) {
  const ar = sos?.assigned_rescue_id;
  if (ar && typeof ar === 'object') {
    const name = ar.full_name?.trim();
    if (name) return name;
  }
  if (typeof ar === 'string' && ar.trim().length > 0) {
    return `Đội (…${ar.trim().slice(-6)})`;
  }
  return 'Chưa phân công';
}

function formatDt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('vi-VN'); } catch { return String(iso); }
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
    totalAll: sorted.length,
  };
}

// ─── Chart colors (đồng bộ với dashboard) ───────────────────────────────────

const CHART_COLORS = [
  '#22c55e', '#3b82f6', '#eab308', '#f97316',
  '#ef4444', '#8b5cf6', '#06b6d4', '#64748b',
];

// ─── SVG: Bar chart (tần suất theo khung giờ 2h) ────────────────────────────

function buildBarChartSvg(filteredSos) {
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const hourStart = i * 2;
    const hourEnd = hourStart + 2;
    const count = (filteredSos || []).filter((s) => {
      if (!s.created_at) return false;
      const h = new Date(s.created_at).getHours();
      return h >= hourStart && h < hourEnd;
    }).length;
    return { label: `${String(hourStart).padStart(2, '0')}:00`, count };
  });

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const W = 680;
  const H = 180;
  const padL = 32;
  const padR = 12;
  const padT = 20;
  const padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const slotW = chartW / buckets.length;
  const barW = Math.max(Math.floor(slotW * 0.6), 8);

  // Gridlines
  const gridLines = [0.25, 0.5, 0.75, 1].map((frac) => {
    const y = padT + chartH - frac * chartH;
    const val = Math.round(frac * maxCount);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"
      stroke="#e5e7eb" stroke-width="1" stroke-dasharray="3,3"/>
      <text x="${padL - 4}" y="${(y + 4).toFixed(1)}" text-anchor="end"
        font-size="9" fill="#9ca3af">${val}</text>`;
  }).join('');

  // Base line
  const baseY = padT + chartH;
  const baseLine = `<line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}"
    stroke="#d1d5db" stroke-width="1"/>`;

  // Bars
  const bars = buckets.map((b, i) => {
    const slotCenterX = padL + i * slotW + slotW / 2;
    const x = slotCenterX - barW / 2;
    const barH = Math.max((b.count / maxCount) * chartH, b.count > 0 ? 4 : 0);
    const y = padT + chartH - barH;

    // Gradient-like: darker base, lighter top — simulated with two rects
    const barColor = '#3b82f6';
    const barColorTop = '#93c5fd';

    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${barH.toFixed(1)}"
        fill="${barColor}" rx="3" ry="3"/>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${Math.min(barH * 0.35, 8).toFixed(1)}"
        fill="${barColorTop}" rx="3" ry="3"/>
      ${b.count > 0
        ? `<text x="${slotCenterX.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle"
            font-size="9" fill="#374151" font-weight="600">${b.count}</text>`
        : ''}
      <text x="${slotCenterX.toFixed(1)}" y="${(baseY + 14).toFixed(1)}" text-anchor="middle"
        font-size="8" fill="#9ca3af">${escapeHtml(b.label)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
    width="${W}" height="${H}" style="display:block;overflow:visible;">
    ${gridLines}
    ${baseLine}
    ${bars}
  </svg>`;
}

// ─── SVG: Donut chart (phân loại sự cố) ─────────────────────────────────────

function buildDonutSvg(distribution, total) {
  const W = 680;
  const H = 200;
  const cx = 100;
  const cy = H / 2;
  const rOuter = 76;
  const rInner = 50;
  const strokeW = rOuter - rInner;

  if (!distribution || distribution.length === 0 || total === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
      width="${W}" height="${H}" style="display:block;">
      <circle cx="${cx}" cy="${cy}" r="${(rOuter + rInner) / 2}"
        fill="none" stroke="#e5e7eb" stroke-width="${strokeW}"/>
      <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="12" fill="#9ca3af">Không có dữ liệu</text>
    </svg>`;
  }

  function polarToXY(angle, r) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function slicePath(a0, a1) {
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const p1 = polarToXY(a0, rOuter);
    const p2 = polarToXY(a1, rOuter);
    const p3 = polarToXY(a1, rInner);
    const p4 = polarToXY(a0, rInner);
    return [
      `M${p1.x.toFixed(2)},${p1.y.toFixed(2)}`,
      `A${rOuter},${rOuter} 0 ${large} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`,
      `L${p3.x.toFixed(2)},${p3.y.toFixed(2)}`,
      `A${rInner},${rInner} 0 ${large} 0 ${p4.x.toFixed(2)},${p4.y.toFixed(2)}`,
      'Z',
    ].join(' ');
  }

  // Background track
  const track = `<circle cx="${cx}" cy="${cy}" r="${(rOuter + rInner) / 2}"
    fill="none" stroke="#f3f4f6" stroke-width="${strokeW}"/>`;

  // Slices
  let acc = 0;
  const slices = distribution.map((item, i) => {
    const frac = item.count / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    if (distribution.length === 1) {
      return `<circle cx="${cx}" cy="${cy}" r="${(rOuter + rInner) / 2}"
        fill="none" stroke="${color}" stroke-width="${strokeW}"/>`;
    }
    // Gap between slices: shrink slice slightly
    const gap = 0.015;
    return `<path d="${slicePath(a0 + gap, a1 - gap)}" fill="${color}"/>`;
  }).join('');

  // Center text
  const centerText = `
    <text x="${cx}" y="${cy - 8}" text-anchor="middle"
      font-size="24" font-weight="700" fill="#111827">${total}</text>
    <text x="${cx}" y="${cy + 10}" text-anchor="middle"
      font-size="9" fill="#9ca3af" letter-spacing="1">TỔNG SỐ</text>`;

  // Legend panel (right of donut)
  const legendX = cx + rOuter + 28;
  const legendColW = W - legendX - 8;

  // 2-column layout if >4 items
  const items = distribution.slice(0, 8);
  const useDouble = items.length > 4;
  const colItemCount = useDouble ? Math.ceil(items.length / 2) : items.length;
  const col2X = useDouble ? legendX + legendColW / 2 + 8 : null;
  const itemH = useDouble ? Math.floor((H - 16) / colItemCount) : 28;

  const legendItems = items.map((item, i) => {
    const col = useDouble && i >= colItemCount ? 1 : 0;
    const row = useDouble && i >= colItemCount ? i - colItemCount : i;
    const lx = col === 0 ? legendX : col2X;
    const ly = 12 + row * itemH;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const barMaxW = (useDouble ? legendColW / 2 - 52 : legendColW - 40);
    const barW = Math.max(2, (item.percent / 100) * barMaxW);

    return `
      <rect x="${lx}" y="${ly + 1}" width="9" height="9" rx="2" fill="${color}"/>
      <text x="${lx + 13}" y="${ly + 9}" font-size="10" fill="#374151" font-weight="500"
        >${escapeHtml(item.label)}</text>
      <rect x="${lx + 13}" y="${ly + 13}" width="${barMaxW}" height="3" rx="2" fill="#f3f4f6"/>
      <rect x="${lx + 13}" y="${ly + 13}" width="${barW.toFixed(1)}" height="3" rx="2" fill="${color}"/>
      <text x="${lx + 13 + barMaxW + 4}" y="${ly + 9}" font-size="10" fill="#374151"
        font-weight="700">${item.percent}%</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
    width="${W}" height="${H}" style="display:block;overflow:visible;">
    ${track}
    ${slices}
    ${centerText}
    ${legendItems}
  </svg>`;
}

// ─── SVG: Horizontal bar chart (hiệu suất đội cứu trợ) ──────────────────────

function buildTeamBarChartSvg(rescueTeamDistribution) {
  const items = (rescueTeamDistribution || []).slice(0, 12);

  if (items.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 60"
      width="680" height="60" style="display:block;">
      <text x="340" y="35" text-anchor="middle" font-size="12" fill="#9ca3af">Không có dữ liệu</text>
    </svg>`;
  }

  const W = 680;
  const rowH = 30;
  const padT = 20;      // chừa chỗ cho header row
  const padB = 8;
  const padL = 8;
  const padR = 8;
  const labelW = 170;   // cột tên đội
  const pctW = 44;      // cột % (text-anchor end)
  const countW = 36;    // cột số lượng
  const gapCols = 8;    // khoảng cách giữa bar và cột số
  const barAreaX = padL + labelW + 10;
  const barAreaW = W - barAreaX - gapCols - countW - gapCols - pctW - padR;
  const H = padT + items.length * rowH + padB;
  const maxCount = Math.max(...items.map((i) => i.count), 1);

  // Vị trí X các cột bên phải
  const countX = barAreaX + barAreaW + gapCols;       // số lượng
  const pctX   = countX + countW + 4;                 // %

  const rows = items.map((item, i) => {
    const y = padT + i * rowH;
    const barW = Math.max((item.count / maxCount) * barAreaW, item.count > 0 ? 4 : 0);
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const barY = y + rowH / 2 - 7;
    const barH = 14;
    const textY = y + rowH / 2 + 4.5;

    const maxLabelChars = 24;
    const labelText = item.label.length > maxLabelChars
      ? item.label.slice(0, maxLabelChars - 1) + '…'
      : item.label;

    const rowBg = i % 2 === 0
      ? `<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="#f9fafb"/>`
      : `<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="#ffffff"/>`;

    return `
      ${rowBg}
      <text x="${padL}" y="${textY}" font-size="10" fill="#374151" font-weight="500"
        >${escapeHtml(labelText)}</text>
      <rect x="${barAreaX}" y="${barY}" width="${barAreaW}" height="${barH}"
        rx="4" fill="#e5e7eb"/>
      <rect x="${barAreaX}" y="${barY}" width="${barW.toFixed(1)}" height="${barH}"
        rx="4" fill="${color}"/>
      <text x="${countX}" y="${textY}" font-size="10" fill="#111827"
        font-weight="700" text-anchor="middle">${item.count}</text>
      <text x="${pctX + pctW - 4}" y="${textY}" font-size="10" fill="#6b7280"
        text-anchor="end">${item.percent}%</text>`;
  }).join('');

  // Header
  const headerY = padT - 6;
  const header = `
    <text x="${padL}" y="${headerY}" font-size="9" fill="#9ca3af" font-weight="600"
      letter-spacing="0.5">ĐỘI CỨU TRỢ</text>
    <text x="${barAreaX}" y="${headerY}" font-size="9" fill="#9ca3af" font-weight="600"
      letter-spacing="0.5">SỐ SỰ CỐ</text>
    <text x="${countX}" y="${headerY}" font-size="9" fill="#9ca3af" font-weight="600"
      text-anchor="middle">SL</text>
    <text x="${pctX + pctW - 4}" y="${headerY}" font-size="9" fill="#9ca3af" font-weight="600"
      text-anchor="end">%</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
    width="${W}" height="${H}" style="display:block;">
    ${header}
    ${rows}
  </svg>`;
}

// ─── HTML builder ────────────────────────────────────────────────────────────

function sectionTitle(text) {
  return `<h2 style="font-size:14px;margin:22px 0 10px;font-weight:700;color:#111827;
    letter-spacing:0.01em;border-left:3px solid #3b82f6;padding-left:8px;">${text}</h2>`;
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
  const total = filteredSos?.length ?? 0;

  const thStyle =
    'padding:9px 12px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;letter-spacing:0.02em;line-height:1.5;';
  const thStyleSm =
    'padding:8px 10px;border:1px solid #e5e7eb;font-size:10px;font-weight:600;letter-spacing:0.02em;line-height:1.5;';

  const statsRows = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;line-height:1.5;"><strong>Tổng số sự cố</strong></td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:12px;line-height:1.5;">${escapeHtml(String(stats.total))}</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;line-height:1.5;"><strong>Đang hoạt động</strong></td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:12px;line-height:1.5;">${escapeHtml(String(stats.active))}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;line-height:1.5;"><strong>Hoàn thành</strong></td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:12px;line-height:1.5;">${escapeHtml(String(stats.resolved))}</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;line-height:1.5;"><strong>Đã hủy</strong></td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:12px;line-height:1.5;">${escapeHtml(String(stats.cancelled))}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;line-height:1.5;"><strong>T.gian phản hồi TB (phút)</strong></td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:12px;line-height:1.5;">${escapeHtml(String(stats.avgResponse))}</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;line-height:1.5;"><strong>Tỷ lệ AI phân tích (%)</strong></td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:12px;line-height:1.5;">${escapeHtml(String(stats.aiAnalysisRate))}</td>
      </tr>
    </table>`;

  const distRows = (distribution || []).map((item) => `
    <tr>
      <td style="padding:9px 12px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;">${escapeHtml(item.label)}</td>
      <td style="padding:9px 12px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;text-align:center;">${escapeHtml(String(item.percent))}%</td>
      <td style="padding:9px 12px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;text-align:right;">${escapeHtml(String(item.count))}</td>
    </tr>`).join('');

  const teamRows = (rescueTeamDistribution || []).slice(0, 12).map((item) => `
    <tr>
      <td style="padding:9px 12px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;">${escapeHtml(item.label)}</td>
      <td style="padding:9px 12px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;text-align:center;">${escapeHtml(String(item.percent))}%</td>
      <td style="padding:9px 12px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;text-align:right;">${escapeHtml(String(item.count))}</td>
    </tr>`).join('');

  const incidentRows = rows.map((r) => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;">${escapeHtml(r.code)}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;">${escapeHtml(r.typeLabel)}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;">${escapeHtml(r.statusLabel)}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;">${escapeHtml(r.team)}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;line-height:1.6;">${escapeHtml(r.createdAt)}</td>
    </tr>`).join('');

  const noteTrunc = truncated
    ? `<p style="font-size:10px;color:#6b7280;margin:6px 0 8px;line-height:1.5;">* Hiển thị 45 bản ghi mới nhất trong tổng ${escapeHtml(String(totalAll))} sự cố.</p>`
    : '';

  return `
<div style="font-family:'Be Vietnam Pro','Segoe UI',system-ui,sans-serif;color:#111827;line-height:1.6;letter-spacing:0.01em;">

  <!-- Header -->
  <div style="border-bottom:2px solid #3b82f6;padding-bottom:12px;margin-bottom:18px;">
    <h1 style="font-size:20px;margin:0 0 6px;font-weight:700;">Báo cáo thống kê — SOS Guardian</h1>
    <p style="margin:0 0 3px;font-size:12px;color:#374151;">
      Khoảng thời gian: <strong>${escapeHtml(dateRangeLabel)}</strong>
    </p>
    <p style="margin:0;font-size:11px;color:#6b7280;">Xuất lúc: ${escapeHtml(generatedAtLabel)}</p>
  </div>

  ${sectionTitle('Tổng quan')}
  ${statsRows}

  ${sectionTitle('Phân loại sự cố')}
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:10px;">
    ${buildDonutSvg(distribution, total)}
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="${thStyle}text-align:left;">Loại</th>
        <th style="${thStyle}text-align:center;">%</th>
        <th style="${thStyle}text-align:right;">Số lượng</th>
      </tr>
    </thead>
    <tbody>${distRows || `<tr><td colspan="3" style="padding:10px 12px;font-size:11px;color:#9ca3af;">Không có dữ liệu</td></tr>`}</tbody>
  </table>

  ${sectionTitle('Hiệu suất theo đội cứu trợ (top 12)')}
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:10px;">
    ${buildTeamBarChartSvg(rescueTeamDistribution)}
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="${thStyle}text-align:left;">Đội</th>
        <th style="${thStyle}text-align:center;">%</th>
        <th style="${thStyle}text-align:right;">Số lượng</th>
      </tr>
    </thead>
    <tbody>${teamRows || `<tr><td colspan="3" style="padding:10px 12px;font-size:11px;color:#9ca3af;">Không có dữ liệu</td></tr>`}</tbody>
  </table>

  ${sectionTitle('Tần suất sự cố theo khung giờ (2h)')}
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:4px;">
    ${buildBarChartSvg(filteredSos)}
  </div>

  ${sectionTitle('Danh sách sự cố (mới nhất)')}
  ${noteTrunc}
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="${thStyleSm}text-align:left;">Mã</th>
        <th style="${thStyleSm}text-align:left;">Loại</th>
        <th style="${thStyleSm}text-align:left;">Trạng thái</th>
        <th style="${thStyleSm}text-align:left;">Đội</th>
        <th style="${thStyleSm}text-align:left;">Thời gian tạo</th>
      </tr>
    </thead>
    <tbody>${incidentRows || `<tr><td colspan="5" style="padding:10px;font-size:11px;color:#9ca3af;">Không có dữ liệu</td></tr>`}</tbody>
  </table>

  <p style="margin-top:20px;font-size:10px;color:#9ca3af;line-height:1.6;
    border-top:1px solid #f3f4f6;padding-top:10px;">
    © SOS Guardian — Báo cáo nội bộ
  </p>
</div>`;
}

// ─── Iframe mount ────────────────────────────────────────────────────────────

function mountPdfHtmlInIsolatedIframe(htmlMarkup) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'pdf-export';
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:760px;height:28000px;border:0;opacity:0;pointer-events:none';
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
      margin: 0; padding: 0; background: #ffffff; color: #111827;
      font-family: system-ui, "Segoe UI", Roboto, sans-serif;
    }
  </style></head><body></body></html>`);
  idoc.close();

  idoc.body.style.margin = '0';
  idoc.body.style.padding = '20px';
  idoc.body.style.width = '720px';
  idoc.body.style.background = '#ffffff';
  idoc.body.innerHTML = htmlMarkup;

  return { iframe, root: idoc.body };
}

// ─── Export ──────────────────────────────────────────────────────────────────

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
    // Chờ SVG render xong trong iframe trước khi chụp
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