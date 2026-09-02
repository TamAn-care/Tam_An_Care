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
    '/residents': {
      title: 'Người cao tuổi',
      description:
        'Tra cứu hồ sơ và truy cập không gian chăm sóc theo phân quyền.',
    },
    '/health-reports': {
      title: 'Báo cáo sức khỏe',
      description:
        'Lập, khóa dữ liệu, rà soát, phê duyệt và gửi báo cáo sức khỏe định kỳ.',
    },
    '/staff-access': {
      title: 'Nhân sự & phân quyền',
      description:
        'Quản lý quyền tiếp cận hồ sơ người cao tuổi.',
    },
    '/operations': {
    title: 'Công việc vận hành',
    description:
      'Ghi nhận và rà soát bằng chứng công việc chăm sóc.',
  },
  '/system-status': {
      title: 'Trạng thái hệ thống',
      description:
        'Theo dõi kết nối frontend và backend.',
    },
  };
