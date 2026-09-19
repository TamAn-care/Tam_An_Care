import { ShiftItem, ShiftStatus } from '../api/workforce';
import { ROLE_LABELS } from '../auth/role-policy';

export interface ExportWorkforceExcelOptions {
  items: ShiftItem[];
  selectedDate?: string;
  creatorName?: string;
  creatorRole?: string;
  statusFilter?: string;
  typeFilter?: string;
}

const SHIFT_TYPE_LABELS: Record<string, string> = {
  MORNING: 'Ca Sáng (06:00 - 14:00)',
  AFTERNOON: 'Ca Chiều (14:00 - 22:00)',
  NIGHT: 'Ca Đêm (22:00 - 06:00)',
  CUSTOM: 'Ca Linh Hoạt',
};

const STATUS_TEXT: Record<ShiftStatus, string> = {
  SCHEDULED: 'Đã phân ca',
  IN_PROGRESS: 'Đang trực ca',
  COMPLETED: 'Hoàn thành',
  ABSENT: 'Vắng mặt',
  CANCELLED: 'Đã hủy ca',
};

const STATUS_STYLE: Record<ShiftStatus, { bg: string; color: string; border: string }> = {
  COMPLETED: { bg: '#DCFCE7', color: '#15803D', border: '#86EFAC' },
  IN_PROGRESS: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  SCHEDULED: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
  ABSENT: { bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' },
  CANCELLED: { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
};

export function exportWorkforceScheduleExcel(options: ExportWorkforceExcelOptions): void {
  const { items, selectedDate, creatorName = 'Hệ thống Tâm An Care', creatorRole = 'Quản lý Nhân sự', statusFilter = 'ALL', typeFilter = 'ALL' } = options;

  if (!items || items.length === 0) {
    alert('Không có dữ liệu ca trực để xuất báo cáo Excel.');
    return;
  }

  const nowStr = new Date().toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const exportDateStr = selectedDate ? selectedDate : new Date().toISOString().slice(0, 10);

  // Statistics calculation
  const totalShifts = items.length;
  const completedCount = items.filter((x) => x.status === 'COMPLETED').length;
  const inProgressCount = items.filter((x) => x.status === 'IN_PROGRESS').length;
  const scheduledCount = items.filter((x) => x.status === 'SCHEDULED').length;
  const absentOrCancelledCount = items.filter((x) => x.status === 'ABSENT' || x.status === 'CANCELLED').length;
  const completionRate = totalShifts > 0 ? Math.round((completedCount / totalShifts) * 100) : 0;

  // Build HTML formatted content for MS Excel
  let html = `
  <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel"
        xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <!--[if gte mso 9]>
    <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>Lịch Trực Nhân Sự</x:Name>
            <x:WorksheetOptions>
              <x:DisplayGridlines/>
              <x:Print>
                <x:ValidPrinterInfo/>
                <x:Orientation>Landscape</x:Orientation>
              </x:Print>
            </x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
      body {
        font-family: Arial, sans-serif;
        font-size: 11pt;
        color: #1E293B;
      }
      .facility-header {
        font-size: 11pt;
        font-weight: bold;
        color: #0F172A;
        text-transform: uppercase;
      }
      .report-title {
        font-size: 16pt;
        font-weight: bold;
        color: #166534;
        text-align: center;
        margin-top: 10px;
        margin-bottom: 5px;
      }
      .report-subtitle {
        font-size: 10.5pt;
        color: #475569;
        text-align: center;
        font-style: italic;
        margin-bottom: 15px;
      }
      .meta-box {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        padding: 10px;
        font-size: 10pt;
        color: #334155;
      }
      .stat-header {
        background-color: #F0FDF4;
        border: 1px solid #86EFAC;
        font-weight: bold;
        color: #166534;
        text-align: center;
        padding: 6px;
      }
      .stat-val {
        border: 1px solid #CBD5E1;
        text-align: center;
        font-weight: bold;
        font-size: 11pt;
      }
      table.data-table {
        border-collapse: collapse;
        width: 100%;
        margin-top: 15px;
      }
      table.data-table th {
        background-color: #166534;
        color: #FFFFFF;
        font-weight: bold;
        font-size: 10.5pt;
        text-align: center;
        vertical-align: middle;
        border: 1px solid #0F5128;
        padding: 8px 6px;
        height: 35px;
      }
      table.data-table td {
        border: 1px solid #CBD5E1;
        padding: 6px 8px;
        vertical-align: middle;
        font-size: 10pt;
      }
      .row-even {
        background-color: #FFFFFF;
      }
      .row-odd {
        background-color: #F8FAFC;
      }
      .text-center { text-align: center; }
      .text-left { text-align: left; }
      .text-right { text-align: right; }
      .font-bold { font-weight: bold; }
      .text-code {
        mso-number-format: '\\@';
        font-family: 'Courier New', monospace;
      }
      .badge-status {
        padding: 4px 8px;
        font-weight: bold;
        border-radius: 4px;
        text-align: center;
        display: inline-block;
      }
      .summary-footer-row td {
        background-color: #E2E8F0;
        font-weight: bold;
        border-top: 2px solid #0F172A;
      }
      .signature-table {
        margin-top: 30px;
        width: 100%;
        border-collapse: collapse;
      }
      .signature-table td {
        border: none;
        text-align: center;
        vertical-align: top;
        font-size: 10.5pt;
      }
    </style>
  </head>
  <body>
    <!-- Top Facility Header -->
    <table style="width:100%; border:none;">
      <tr>
        <td colspan="12" className="facility-header" style="font-size: 12pt; font-weight: bold; color: #166534;">
          HỆ THỐNG DƯỠNG LÃO & CHĂM SÓC SỨC KHỎE TÂM AN CARE
        </td>
      </tr>
      <tr>
        <td colspan="12" style="font-size: 9.5pt; color: #64748B;">
          Địa chỉ: Trung tâm Chăm sóc & Dưỡng lão Tâm An Care | Hotline: 1900-TamanCare
        </td>
      </tr>
      <tr>
        <td colspan="12" className="report-title">
          BÁO CÁO LỊCH TRỰC VÀ PHÂN CÔNG NHÂN SỰ
        </td>
      </tr>
      <tr>
        <td colspan="12" className="report-subtitle">
          (Ngày áp dụng: <b>${exportDateStr}</b> | Thời gian xuất file: <b>${nowStr}</b>)
        </td>
      </tr>
    </table>

    <br/>

    <!-- Summary Box Table -->
    <table style="width:100%; border-collapse:collapse; margin-bottom: 15px;">
      <tr>
        <td colspan="2" className="stat-header">Tổng Ca Trực</td>
        <td colspan="2" className="stat-header" style="background-color:#DCFCE7; color:#15803D;">Đã Hoàn Thành</td>
        <td colspan="2" className="stat-header" style="background-color:#FEF3C7; color:#B45309;">Đang Trực Ca</td>
        <td colspan="2" className="stat-header" style="background-color:#DBEAFE; color:#1D4ED8;">Đã Phân Ca</td>
        <td colspan="2" className="stat-header" style="background-color:#FEE2E2; color:#B91C1C;">Vắng / Hủy Ca</td>
        <td colspan="2" className="stat-header" style="background-color:#F3E8FF; color:#6B21A8;">Tỷ Lệ Hoàn Thành</td>
      </tr>
      <tr>
        <td colspan="2" className="stat-val" style="color:#0F172A;">${totalShifts} ca</td>
        <td colspan="2" className="stat-val" style="color:#15803D;">${completedCount} ca</td>
        <td colspan="2" className="stat-val" style="color:#B45309;">${inProgressCount} ca</td>
        <td colspan="2" className="stat-val" style="color:#1D4ED8;">${scheduledCount} ca</td>
        <td colspan="2" className="stat-val" style="color:#B91C1C;">${absentOrCancelledCount} ca</td>
        <td colspan="2" className="stat-val" style="color:#6B21A8;">${completionRate}%</td>
      </tr>
    </table>

    <!-- Main Schedule Data Table -->
    <table className="data-table">
      <thead>
        <tr>
          <th style="width: 40px;">STT</th>
          <th style="width: 100px;">Mã Ca</th>
          <th style="width: 90px;">Ngày Trực</th>
          <th style="width: 170px;">Khung Ca & Loại Ca</th>
          <th style="width: 100px;">Mã NV</th>
          <th style="width: 170px;">Họ Và Tên Nhân Viên</th>
          <th style="width: 130px;">Chức Danh / Vai Trò</th>
          <th style="width: 160px;">Phân Công Khu Vực</th>
          <th style="width: 130px;">Giờ Bắt Đầu</th>
          <th style="width: 130px;">Giờ Kết Thúc</th>
          <th style="width: 120px;">Trạng Thái</th>
          <th style="width: 220px;">Ghi Chú / Bàn Giao Ca</th>
        </tr>
      </thead>
      <tbody>
  `;

  items.forEach((item, index) => {
    const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
    const statusInfo = STATUS_STYLE[item.status as ShiftStatus] || { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' };
    const statusLabel = STATUS_TEXT[item.status as ShiftStatus] || item.status;
    const shiftTypeDesc = SHIFT_TYPE_LABELS[item.shiftType] || item.shiftType;
    const roleTitle = ROLE_LABELS[item.staffRole as keyof typeof ROLE_LABELS] || item.staffRole || 'Chăm sóc viên';

    const startTimeFormatted = item.startTime
      ? new Date(item.startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
      : '-';
    const endTimeFormatted = item.endTime
      ? new Date(item.endTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
      : '-';

    html += `
      <tr className="${rowClass}">
        <td className="text-center font-bold">${index + 1}</td>
        <td className="text-center text-code font-bold" style="color:#0F172A;">${item.shiftId}</td>
        <td className="text-center">${item.shiftDate}</td>
        <td className="text-left font-bold" style="color:#1E293B;">${shiftTypeDesc}</td>
        <td className="text-center text-code">${item.staffCode || '-'}</td>
        <td className="text-left font-bold" style="color:#0F172A;">${item.staffName}</td>
        <td className="text-left">${roleTitle}</td>
        <td className="text-left">${item.notes || 'Chăm sóc nội trú túc trực'}</td>
        <td className="text-center" style="font-size:9.5pt;">${startTimeFormatted}</td>
        <td className="text-center" style="font-size:9.5pt;">${endTimeFormatted}</td>
        <td className="text-center">
          <span style="background-color:${statusInfo.bg}; color:${statusInfo.color}; border:1px solid ${statusInfo.border}; padding:3px 6px; font-weight:bold; font-size:9pt; border-radius:3px;">
            ${statusLabel}
          </span>
        </td>
        <td className="text-left" style="color:#475569; font-size:9.5pt;">
          ${item.handovers && item.handovers.length > 0 ? `<b>[Giao ca]</b> ${item.handovers[0].summaryNote}` : (item.notes || '-')}
        </td>
      </tr>
    `;
  });

  // Footer Summary Row
  html += `
      <tr className="summary-footer-row">
        <td colspan="4" className="text-center">TỔNG CỘNG DANH SÁCH: ${totalShifts} CA TRỰC</td>
        <td colspan="8" className="text-left">
          Trong đó: <span style="color:#15803D;">Hoàn thành: ${completedCount}</span> | 
          <span style="color:#B45309;">Đang trực: ${inProgressCount}</span> | 
          <span style="color:#1D4ED8;">Đã phân ca: ${scheduledCount}</span> | 
          <span style="color:#B91C1C;">Vắng/Hủy: ${absentOrCancelledCount}</span>
        </td>
      </tr>
      </tbody>
    </table>

    <br/>
    <br/>

    <!-- Signature Section -->
    <table className="signature-table">
      <tr>
        <td style="width: 33%;">
          <b>NGƯỜI LẬP BÁO CÁO</b><br/>
          <i>(Ký và ghi rõ họ tên)</i>
          <br/><br/><br/><br/>
          <b>${creatorName}</b><br/>
          <span style="font-size:9pt; color:#64748B;">${creatorRole}</span>
        </td>
        <td style="width: 34%;">
          <b>QUẢN LÝ CA TRỰC / TRƯỞNG CA</b><br/>
          <i>(Ký và ghi rõ họ tên)</i>
          <br/><br/><br/><br/>
          <b>........................................................</b><br/>
          <span style="font-size:9pt; color:#64748B;">Phê duyệt danh sách ca</span>
        </td>
        <td style="width: 33%;">
          <b>BAN GIÁM ĐỐC / ĐIỀU HÀNH</b><br/>
          <i>(Ký tên & Đóng dấu)</i>
          <br/><br/><br/><br/>
          <b>........................................................</b><br/>
          <span style="font-size:9pt; color:#64748B;">Tâm An Care System</span>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  // Create Blob & trigger browser download with UTF-8 BOM
  const blob = new Blob(['\uFEFF' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });

  const fileName = `Bao_Cao_Lich_Truc_TamAnCare_${exportDateStr.replace(/-/g, '')}.xls`;

  if (typeof window !== 'undefined') {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}
