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
    '/staff-access': {
      title: 'Nhân sự & phân quyền',
      description:
        'Quản lý quyền tiếp cận hồ sơ người cao tuổi.',
    },
    '/system-status': {
      title: 'Trạng thái hệ thống',
      description:
        'Theo dõi kết nối frontend và backend.',
    },
  };
