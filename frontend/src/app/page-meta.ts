export interface PageMeta {
  title: string;
  description: string;
}

export const PAGE_META:
  Record<string, PageMeta> = {
    '/dashboard': {
      title: 'Tổng quan',
      description:
        'Theo dõi nhanh tình trạng vận hành và công việc cần chú ý.',
    },
    '/accommodation': {
      title: 'Sơ đồ Phòng & Giường',
      description:
        'Quản lý toà nhà, tầng, phòng và điều phối phân bổ giường nằm.',
    },
    '/residents': {
      title: 'Người cao tuổi',
      description:
        'Tra cứu hồ sơ và truy cập không gian chăm sóc theo phân quyền.',
    },
    '/resident-lifecycle': {
      title: 'Vòng đời & Bàn giao cư dân',
      description:
        'Cập nhật kế hoạch chăm sóc và kết thúc dịch vụ có kiểm soát.',
    },
    '/resident-leave': {
      title: 'Nghỉ phép & Tạm vắng',
      description:
        'Quản lý tạm vắng, quy tắc giảm trừ tiền ăn RLA-BR-01 và trở lại Tâm An.',
    },
    '/workforce': {
      title: 'Lịch trực & Ca kíp',
      description:
        'Phân ca trực nhân sự, điểm danh vào/ra ca và bàn giao ca chuẩn y khoa.',
    },
    '/operations': {
      title: 'Chăm sóc & Vận hành',
      description:
        'Ghi nhận và rà soát bằng chứng công việc chăm sóc hàng ngày.',
    },
    '/admissions': {
      title: 'Tiếp nhận & Đánh giá',
      description:
        'Quy trình tiếp nhận và đánh giá sức khỏe ban đầu người cao tuổi.',
    },
    '/health-reports': {
      title: 'Báo cáo sức khỏe',
      description:
        'Lập, khóa dữ liệu, rà soát, phê duyệt và gửi báo cáo sức khỏe định kỳ.',
    },
    '/staff-access': {
      title: 'Nhân sự & Phân quyền',
      description:
        'Quản lý danh sách nhân sự và quyền tiếp cận hồ sơ người cao tuổi.',
    },
    '/family-portal': {
      title: 'Cổng thông tin Thân nhân',
      description:
        'Theo dõi sức khỏe, xem báo cáo y khoa định kỳ, đăng ký tạm vắng và đặt lịch thăm người cao tuổi.',
    },
    '/medication-inventory': {
      title: 'Dược phẩm & Vật tư y tế',
      description:
        'Quản lý y lệnh thuốc eMAR, điểm danh cấp phát thuốc 5 Đúng và kiểm kê vật tư y tế tiêu hao.',
    },
    '/kitchen-operations': {
      title: 'Bếp Ăn & Dinh Dưỡng',
      description:
        'Tiếp nhận thực phẩm theo hợp đồng, kiểm đếm khối lượng đối soát, đánh giá chất lượng HACCP, phân loại lưu kho và lưu mẫu 24h.',
    },
    '/billing-invoicing': {
      title: 'Quản lý Phí & Kế toán',
      description:
        'Bảng kê thu phí hàng tháng, tự động giảm trừ tiền ăn tạm vắng RLA-BR-01, chi phí vật tư và quản lý hóa đơn thu phí.',
    },
    '/analytics-intelligence': {
      title: 'Phân tích & Quản trị',
      description:
        'Báo cáo phân tích quản trị thông minh, công suất lấp đầy phòng giường, xu hướng lâm sàng, tài chính và hiệu suất nhân sự.',
    },
    '/audit-trail': {
      title: 'Nhật Ký Truy Vết & Kiểm Toán',
      description:
        'Lịch sử thay đổi dữ liệu toàn hệ thống gắn với định danh nhân sự (ID), thời gian và nội dung điều chỉnh phục vụ công tác quy trách nhiệm.',
    },
    '/system-status': {
      title: 'Trạng thái hệ thống',
      description:
        'Theo dõi kết nối frontend và backend.',
    },
  };
